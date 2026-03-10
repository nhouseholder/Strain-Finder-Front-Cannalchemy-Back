# Agent Handoff — MyStrain.AI

**Date**: March 9, 2026
**Current Version**: v5.32.0 (dev) / v5.29.1 (production)
**Branch**: `dev`

---

## Project Overview

MyStrain.AI is a cannabis strain recommendation platform. React 19 + Vite 7 frontend deployed to Cloudflare Pages, with Cloudflare Pages Functions as the API layer. SQLite database with 21,071 strains (690 full, 3,005 partial, 17,376 search-only).

See `MEMORY.md` in this directory's parent for full architecture and key paths.

---

## Current State

### What's Live (main = production)
- v5.29.1 — AI Chat NLP engine, location-aware quiz, floating chat removal
- Production does NOT have: location services expansion, strain imports, strain detail page

### What's on Dev (preview only)
- v5.30.0 — Location services across all pages (Search, Explore, Autocomplete)
- v5.30.1 — Positive-only location badges, Discover page regional sorting
- v5.31.0 — Leafly open dataset import (488 new strains, 1,968 enriched)
- v5.31.1 — DB audit + enrichment from verified sources (Kushy, Cannabis Intelligence)
  - Removed 101 bad entries (mojibake, meaningless names)
  - Demoted 941 "full" strains to "partial" (only had estimated terpenes)
  - Enriched 953 strains from Kushy, 5,258 from Cannabis Intelligence
  - Promoted 198 partial→full (now have verified data)
- v5.32.0 — Dedicated strain detail page with URL routing
  - New `/strain/:slug` route (e.g., `/strain/blue-dream`)
  - Autocomplete dropdown items navigate to strain detail page
  - "Try instead" links on incomplete profiles go to `/strain/:slug`

### Build Fix (permanent)
Vite build deadlocked on Node 25.6.1 due to Rollup parse workers. Fix is now baked into `package.json`: `"build": "ROLLUP_PARSE_WORKERS=0 vite build"`.

### Git Note
The `.git` directory was replaced with a fresh clone (March 9) due to iCloud-induced pack file corruption. Everything is clean now.

---

## 3-Tier Data Quality System

| Tier | DB value | JSON value | Used in |
|------|----------|------------|---------|
| Full | `'full'` | `"full"` | Quiz, Discover, Explore, Search, Compare |
| Partial | `'partial'` | `"partial"` | Search, Autocomplete, Strain Detail only |
| Search-only | `'search-only'` | `"search-only"` | Search, Autocomplete, Strain Detail only |

**Quiz gating**: `isQuizEligible()` requires `dataCompleteness !== 'partial'` and `effects.length > 0`
**Discover gating**: Uses `fullStrains` from `useStrainSearch()` (filters to `dataCompleteness === 'full'`)
**Search**: Uses `allStrains` — shows everything
**Strain Detail**: `/strain/:slug` — works for all quality tiers, shows disclaimer banners for partial/search-only

### Current Strain Counts
- **Total**: 21,071
- **Full** (quiz/discover eligible): 690
- **Partial** (search only, has some data): 3,005
- **Search-only** (name + type only): 17,376

---

## Key Files

| File | Purpose |
|------|---------|
| `frontend/src/App.jsx` | All routes (including new `/strain/:slug`) |
| `frontend/src/routes/StrainDetailPage.jsx` | Standalone strain detail page |
| `frontend/src/components/shared/SearchAutocomplete.jsx` | Autocomplete with navigation |
| `frontend/src/utils/strainSlug.js` | Name→slug conversion |
| `frontend/src/hooks/useStrainSearch.js` | Loads strains.json, provides allStrains/fullStrains |
| `frontend/src/utils/normalizeStrain.js` | Snake_case→camelCase + computed fields |
| `frontend/src/components/results/StrainCard.jsx` | Collapsed strain card |
| `frontend/src/components/results/StrainCardExpanded.jsx` | Full expanded detail view |
| `data/processed/cannalchemy.db` | SQLite database (21,071 strains) |
| `scripts/export_strain_data.py` | Exports DB → strains.json + strain-data.js |
| `scripts/generate_regional_availability.py` | Generates reg arrays |
| `scripts/audit_and_enrich.py` | DB cleanup + multi-source enrichment |
| `scripts/import_leafly_open.py` | Leafly open dataset import |
| `frontend/wrangler.toml` | Cloudflare Pages config |

---

## Database Schema (key tables)

```sql
strains: id, name, normalized_name, strain_type, description, image_url, source, source_id, data_quality
effect_reports: id, strain_id, effect_id, report_count, confidence, source
strain_compositions: id, strain_id, molecule_id, percentage, measurement_type, source
strain_metadata: id, strain_id, consumption_suitability, price_range, best_for, not_ideal_for, genetics, lineage, description_extended
strain_flavors: id, strain_id, flavor
strain_regions: id, strain_id, region_code, availability_score, source, confidence
strain_aliases: id, alias_strain_id, canonical_strain_id, match_score
effects: id, name, category, description
```

To delete a strain safely (must cascade all FK tables):
```python
def delete_strain(conn, strain_id):
    conn.execute("DELETE FROM effect_reports WHERE strain_id = ?", (strain_id,))
    conn.execute("DELETE FROM strain_compositions WHERE strain_id = ?", (strain_id,))
    conn.execute("DELETE FROM strain_metadata WHERE strain_id = ?", (strain_id,))
    conn.execute("DELETE FROM strain_flavors WHERE strain_id = ?", (strain_id,))
    conn.execute("DELETE FROM strain_regions WHERE strain_id = ?", (strain_id,))
    conn.execute("DELETE FROM strain_aliases WHERE alias_strain_id = ? OR canonical_strain_id = ?",
                 (strain_id, strain_id))
    conn.execute("DELETE FROM strains WHERE id = ?", (strain_id,))
```

---

## Scoring Algorithm (5-Layer)

- L1: Receptor Pathway (40%) — binding affinity × effect importance
- L2: Effect Reports (25%) — community report frequency
- L3: Avoid Penalty (15%) — penalize strains with avoided effects
- L4: Cannabinoid Fit (10%) — THC/CBD range matching
- L5: Preference Fit (10%) — subtype, method, budget

---

## Environment Notes

- **Node**: v25.6.1 (build fix is baked into package.json)
- **Python**: `python3` — scripts use sqlite3, rapidfuzz, csv, json
- **Deploy**: Cloudflare Pages via GitHub Actions (auto on push to `main` or `dev`)
- **iCloud Drive**: Project lives on iCloud — can cause slow file ops and occasional git corruption
- **Build**: `cd frontend && npm run build` (ROLLUP_PARSE_WORKERS=0 is baked in)

---

## Untracked/Future Files

| File | Notes |
|------|-------|
| `frontend/src/components/shared/PaywallOverlay.jsx` | Future paywall feature |
| `frontend/src/hooks/useSubscription.js` | Future subscription feature |
| `frontend/src/routes/CheckoutSuccessPage.jsx` | Future checkout feature |
| `docs/MyStrainAI-Synopsis.md` | Project synopsis doc |

Do not modify or delete these.
