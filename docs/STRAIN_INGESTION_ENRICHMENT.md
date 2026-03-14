# Strain Ingestion & Enrichment Pipeline

> Complete technical reference for how strains enter the system, get enriched
> with external data, and surface to users through the request flow.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Data Sources](#data-sources)
3. [Batch Ingestion Pipeline](#batch-ingestion-pipeline)
4. [Enrichment Pipeline](#enrichment-pipeline)
5. [User-Facing Request Flow](#user-facing-request-flow)
6. [Cloudflare Functions (Production)](#cloudflare-functions-production)
7. [Frontend Search & Request UI](#frontend-search--request-ui)
8. [Database Schema](#database-schema)
9. [API Reference](#api-reference)
10. [Environment & Configuration](#environment--configuration)
11. [Running the Pipelines](#running-the-pipelines)
12. [Future Work & TODOs](#future-work--todos)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                       USER SEARCHES                         │
│                                                             │
│  LandingPage  ──→  SearchAutocomplete  ──→  Local JSON DB  │
│  SearchPage   ──→  SearchAutocomplete  ──→  Local JSON DB  │
│  Dashboard    ──→  SearchAutocomplete  ──→  Local JSON DB  │
│                         │                                   │
│                   NO MATCH FOUND                            │
│                         │                                   │
│                  "Request This Strain"                       │
│                         │                                   │
│               ┌─────────▼─────────┐                         │
│               │  POST /api/v1/    │                         │
│               │  strains/request  │                         │
│               └────────┬──────────┘                         │
│                        │                                    │
│          ┌─────────────┼─────────────┐                      │
│          ▼             ▼             ▼                       │
│     Local DB      Otreeba API   Cannlytics API              │
│     (fuzzy)       (metadata)    (lab chemistry)             │
│          └─────────────┼─────────────┘                      │
│                        ▼                                    │
│              Merged Strain Profile                           │
│              → Navigate to /strain/:slug                     │
└─────────────────────────────────────────────────────────────┘
```

### Two Execution Contexts

| Context | When | Files |
|---------|------|-------|
| **Backend (FastAPI)** | Local dev, self-hosted | `backend/app/routers/strains.py`, `backend/app/services/strain_enricher.py` |
| **Cloudflare Functions** | Production (Pages) | `frontend/functions/api/v1/strains/request.js`, `frontend/functions/api/v1/strains/lookup/[name].js` |

Both implement the same logic: local lookup → external API enrichment → return merged profile.

---

## Data Sources

### Otreeba (Open Cannabis Data)
- **URL**: `https://api.otreeba.com/v1/strains`
- **Provides**: Name, type (indica/sativa/hybrid), description, genetics/lineage, effects, flavors, THC/CBD
- **Quality**: Good metadata coverage, moderate chemical accuracy
- **Rate limit**: 1 request/second
- **Adapter**: `scripts/sources/otreeba_adapter.py`

### Cannlytics (Lab-Tested Data)
- **URL**: `https://cannlytics.com/api/data/strains`
- **Provides**: Lab-tested terpene percentages (23 terpenes), cannabinoid levels (11 cannabinoids)
- **Quality**: Highest fidelity chemical data — real lab results
- **Rate limit**: 1 request/second
- **Adapter**: `scripts/sources/cannlytics_adapter.py`

### Data Priority
When merging from multiple sources:
1. **Lab-tested data** (Cannlytics) always takes priority over estimated data
2. **Reported data** (Otreeba user reports) takes priority over inferred data
3. **Inferred data** (terpene→effect rules) fills gaps only

---

## Batch Ingestion Pipeline

### Purpose
Import strains in bulk from external sources into the SQLite database. Used for initial population and periodic updates.

### Entry Point
```bash
python scripts/ingest_strains.py --source otreeba --limit 500
python scripts/ingest_strains.py --source cannlytics --limit 200
```

### Flow

```
Source Adapter (fetch_strains)
    │
    ▼  yields StrainRecord dicts
ingest_strain()
    │
    ├── Exact name match? → _enrich_existing()
    ├── Fuzzy match ≥85%? → _enrich_existing()
    └── New strain → INSERT into strains table
                    → Insert effects, terpenes, cannabinoids
                    → Insert metadata, flavors
                    → Log to enrichment_log
```

### Key Files

| File | Purpose |
|------|---------|
| `scripts/ingest_strains.py` | Main ingestion orchestrator |
| `scripts/sources/otreeba_adapter.py` | Fetches + normalizes Otreeba data |
| `scripts/sources/cannlytics_adapter.py` | Fetches + normalizes Cannlytics lab data |
| `scripts/lib/ingest_helpers.py` | Shared helpers (effect mapping, terpene insertion, etc.) |

### Source Adapters

Each adapter implements `fetch_strains(limit)` as a generator yielding normalized `StrainRecord` dicts:

```python
{
    "name": "Blue Dream",
    "type": "hybrid",
    "description": "A sativa-dominant hybrid...",
    "genetics": "Blueberry x Haze",
    "effects": [("relaxed", "positive"), ("happy", "positive"), ...],
    "flavors": ["blueberry", "sweet", "vanilla"],
    "terpenes": [("myrcene", 0.45), ("pinene", 0.28), ...],
    "cannabinoids": [("thc", 21.0), ("cbd", 0.1)],
    "source": "otreeba",
    "source_id": "12345"
}
```

### Deduplication
- **Exact match**: `normalize_strain_name(name)` lowercases, strips whitespace, removes special chars
- **Fuzzy match**: Uses `match_strain_names()` with 85% similarity threshold
- Existing strains get enriched (gaps filled) rather than duplicated

### Caching
Raw API responses are cached to `data/raw/{source}/page_N.json` to avoid re-fetching during development.

---

## Enrichment Pipeline

### Purpose
Multi-pass post-processing that fills data gaps in existing strains. Idempotent — safe to re-run.

### Entry Point
```bash
python scripts/enrich_pipeline.py --all
python scripts/enrich_pipeline.py --pass terpenes
python scripts/enrich_pipeline.py --pass metadata
python scripts/enrich_pipeline.py --pass quality
```

### Passes

#### Pass 1: `terpenes`
Upgrades estimated terpene profiles with Cannlytics lab data from the `lab_results` table.
- Only upgrades `estimated` → `lab_tested` (never downgrades)
- Preserves existing `reported` data

#### Pass 2: `metadata`
Fills missing metadata using terpene→effect inference rules:
- **Descriptions**: Generated from strain type + top effects
- **Flavors**: Inferred from terpene profile (`TERPENE_FLAVORS` map)
- **Effects**: Boosted from terpene→effect rules (`TERPENE_EFFECTS` map)
- **Best-for / Not-ideal**: Inferred from effect profile

#### Pass 3: `quality`
Recomputes `data_quality` field based on actual data coverage:

| Quality | Criteria |
|---------|----------|
| `full` | 5+ effects, 3+ terpenes, 50+ char description, cannabinoid data, metadata |
| `partial` | At least 1 effect OR 1 terpene |
| `search-only` | Name and type only |

### Idempotency
Each pass checks `enrichment_log` before processing a strain. If already enriched for that pass, it skips.

---

## User-Facing Request Flow

### What Happens When a User Requests a Strain

1. **User searches** in `SearchAutocomplete` — no local matches found
2. **"Request This Strain" button** appears in the dropdown
3. User clicks → `POST /api/v1/strains/request` with `{ name: "Strain Name" }`
4. **Backend / Cloudflare Function**:
   a. Checks local DB (exact → substring → fuzzy match)
   b. If not found, queries **Otreeba** and **Cannlytics** in parallel
   c. Merges results into a unified strain profile
   d. Returns `{ found, strain, enrichmentStatus, message }`
5. **Frontend** receives the strain and navigates to `/strain/{slug}`
6. If `enrichmentStatus === 'pending'`, polls `GET /lookup/{name}` every 5s for up to 30s

### Enrichment Status Values

| Status | Meaning |
|--------|---------|
| `complete` | Full profile with effects, terpenes, cannabinoids, description |
| `partial` | Some data found (e.g., type and effects but no lab data) |
| `pending` | Background enrichment in progress (backend only) |
| `search-only` | Only name/type known — minimal placeholder |

### Backend Flow (FastAPI)

```
POST /api/v1/strains/request
    │
    ├── Strain exists with good data? → Return immediately
    ├── Strain exists but sparse? → Trigger async enrichment → Return with status=pending
    └── Strain not found? → INSERT minimal record → Trigger async enrichment → Return
```

The async enricher (`strain_enricher.py`) runs in a thread pool executor so it doesn't block the response.

### Cloudflare Function Flow

```
POST /api/v1/strains/request
    │
    ├── Check local strain-data.js (exact/fuzzy)
    ├── Fetch Otreeba API (8s timeout)
    ├── Fetch Cannlytics API (8s timeout)  ← in parallel
    └── Merge all data → Return enriched profile
```

No background processing — everything resolves in a single request since Cloudflare Workers are stateless.

---

## Cloudflare Functions (Production)

### Lookup: `GET /api/v1/strains/lookup/:name`

**File**: `frontend/functions/api/v1/strains/lookup/[name].js`

Three-level matching against the pre-exported strain database:
1. **Exact match** on normalized name
2. **Substring/startsWith** match
3. **Fuzzy match** using Levenshtein distance (≥80% similarity)

### Request: `POST /api/v1/strains/request`

**File**: `frontend/functions/api/v1/strains/request.js`

Full enrichment pipeline in a single serverless function:
- Queries Otreeba + Cannlytics in parallel
- Normalizes terpene names (23 variants → canonical)
- Normalizes cannabinoid names (11 variants → canonical)
- Infers effects from strain type if none found
- Infers best-for use cases from effects
- Returns complete strain profile

---

## Frontend Search & Request UI

### SearchAutocomplete Component

**File**: `frontend/src/components/shared/SearchAutocomplete.jsx`

Used on: Landing page, Search page, Dashboard

Features:
- Real-time filtering against local strain database (name, type, effects, flavors)
- Max 8 dropdown results, ranked by: exact match → availability → regional → sentiment
- **"Request This Strain" button** when no matches found
- Mobile-optimized: hides bottom nav when keyboard opens, calculates dropdown height dynamically
- Keyboard navigation (Arrow Up/Down, Escape, Enter)

### StrainSearchPage

**File**: `frontend/src/routes/StrainSearchPage.jsx`

Dedicated search results page with:
- Full-page search with sort controls
- "Request This Strain" button + enrichment polling in the results area
- Displays requested strain via StrainCard with enrichment status banner
- Auto-expands single results

### Mobile Keyboard Handling

**NavBar** (`frontend/src/components/layout/NavBar.jsx`):
- Detects virtual keyboard via `visualViewport` API
- Hides bottom nav bar when keyboard is open (viewport < 75% of window height)
- Prevents nav bar from overlapping search dropdown

**SearchAutocomplete**:
- Dynamically calculates dropdown `maxHeight` based on available viewport space
- Reserves 64px for bottom nav when keyboard is closed (mobile only)

---

## Database Schema

### Core Tables

```sql
strains              -- name, normalized_name, type, description, source, data_quality
strain_compositions  -- terpene/cannabinoid % per strain (source: lab_tested|reported|estimated)
strain_metadata      -- consumption_suitability, best_for, not_ideal_for, genetics, lineage
strain_flavors       -- flavor associations
strain_regions       -- regional availability (7 US regions, 0-100 scores)
strain_reviews       -- aggregated review data (rating, sentiment, pros/cons)
```

### Effects System

```sql
effects              -- name, category (positive|negative|medical|other)
effect_reports       -- report_count per strain-effect pair with confidence
canonical_effects    -- pharmacology-grounded effect definitions
effect_mappings      -- raw effect name → canonical effect
```

### Chemical Data

```sql
molecules            -- terpenes + cannabinoids with SMILES, molecular data
strain_compositions  -- per-strain percentages
lab_results          -- high-fidelity lab test results
binding_affinities   -- molecule → receptor interactions (Ki, IC50, EC50)
```

### Tracking

```sql
enrichment_log       -- strain_id, pass_name, status, run_at (idempotency)
data_sources         -- source metadata (name, URL, last_updated, record_count)
```

---

## API Reference

### `POST /api/v1/strains/request`

Request a strain to be looked up and enriched.

**Request Body:**
```json
{ "name": "Blue Dream" }
```

**Response:**
```json
{
  "found": true,
  "strain": {
    "name": "Blue Dream",
    "type": "hybrid",
    "description": "A sativa-dominant hybrid...",
    "thc": 21.0,
    "cbd": 0.1,
    "effects": [
      { "name": "Relaxed", "category": "positive", "reportCount": 120 }
    ],
    "terpenes": [
      { "name": "Myrcene", "percentage": 0.45 }
    ],
    "cannabinoids": [
      { "name": "THC", "percentage": 21.0 }
    ],
    "flavors": ["Blueberry", "Sweet", "Vanilla"],
    "bestFor": ["Evening relaxation", "Stress relief"],
    "notIdealFor": ["Morning productivity"],
    "genetics": "Blueberry x Haze",
    "dataCompleteness": "complete"
  },
  "enrichmentStatus": "complete",
  "message": "Found enriched strain data from external sources."
}
```

### `GET /api/v1/strains/lookup/:name`

Look up a strain by name (exact, substring, or fuzzy match).

**Response:** Same shape as the request endpoint.

---

## Environment & Configuration

### External API Endpoints
| API | URL | Rate Limit |
|-----|-----|------------|
| Otreeba | `https://api.otreeba.com/v1/strains` | 1 req/sec |
| Cannlytics | `https://cannlytics.com/api/data/strains` | 1 req/sec |

### Key Constants (ingest_helpers.py)
- `EFFECT_MAP` — 40+ effect name normalizations
- `TERPENE_NAME_MAP` — 30+ terpene name variants
- `DEFAULT_TERPENES` — Type-based default profiles (indica/sativa/hybrid)
- `DEFAULT_CANNABINOIDS` — Type-based THC/CBD defaults
- `BEST_FOR_RULES` — 10 effect → use-case mappings
- `NOT_IDEAL_RULES` — 6 effect → contraindication mappings

### Database
- Path: `data/processed/cannalchemy.db` (SQLite)
- Journal mode: WAL
- Foreign keys enforced

---

## Running the Pipelines

### Batch Ingestion (populate DB from external sources)
```bash
# Ingest from Otreeba (metadata-rich)
python scripts/ingest_strains.py --source otreeba --limit 1000

# Ingest from Cannlytics (lab-tested chemistry)
python scripts/ingest_strains.py --source cannlytics --limit 500

# Enrich with --enrich flag to also run post-processing
python scripts/ingest_strains.py --source otreeba --limit 1000 --enrich
```

### Post-Processing Enrichment
```bash
# Run all enrichment passes
python scripts/enrich_pipeline.py --all

# Run specific passes
python scripts/enrich_pipeline.py --pass terpenes   # Upgrade estimated → lab-tested
python scripts/enrich_pipeline.py --pass metadata    # Fill descriptions, flavors, best-for
python scripts/enrich_pipeline.py --pass quality     # Recompute data_quality scores
```

### Export for Frontend
```bash
# Export enriched data to JSON for frontend consumption
python scripts/export_strain_data.py
```

---

## Future Work & TODOs

### Search & Request Flow
- [ ] Add request rate limiting (per-IP) to prevent API abuse
- [ ] Cache external API responses in KV/D1 for Cloudflare production
- [ ] Add "strain requested" analytics event tracking
- [ ] Show enrichment progress bar in UI (not just polling)
- [ ] Allow users to submit corrections to enriched data
- [ ] Add strain request queue/notification when enrichment completes

### Ingestion Pipeline
- [ ] Add Leafly adapter for broader strain coverage
- [ ] Add WeedMaps adapter for dispensary-linked strain data
- [ ] Implement incremental ingestion (only fetch new/updated strains)
- [ ] Add data validation pass to catch outlier terpene/cannabinoid values
- [ ] Schedule periodic re-enrichment for strains with `search-only` quality

### Enrichment
- [ ] Integrate PubChem for molecular property verification
- [ ] Use receptor binding data to improve effect inference
- [ ] Add confidence scores to inferred vs reported data
- [ ] Cross-reference terpene profiles across sources for consistency
- [ ] Add strain image ingestion from external sources

### Mobile UX
- [ ] Improve search dropdown animation on keyboard open/close
- [ ] Add haptic feedback on strain request button tap
- [ ] Support offline strain requests (queue for when online)
- [ ] Add voice search for strain names
