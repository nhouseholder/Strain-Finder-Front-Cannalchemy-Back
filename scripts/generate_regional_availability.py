"""Generate regional availability scores for all strains.

Uses a 5-layer heuristic to estimate how available each strain is
in each of 7 US cannabis regions:

  PAC (Pacific)      - CA, OR, WA, HI, AK
  MTN (Mountain)     - CO, NV, AZ, NM, UT, MT, ID, WY
  MWE (Midwest)      - IL, MI, MO, OH, MN, WI, IN, IA, KS, NE, ND, SD
  GLK (Great Lakes)  - NY-upstate, PA, OH overlap
  SOU (South)        - FL, GA, TX, NC, VA, LA, SC, TN, AL, MS, AR, KY, WV, OK, MD, DC
  NEN (New England)  - MA, CT, ME, VT, NH, RI
  MAT (Mid-Atlantic) - NY-metro, NJ, PA-east, DE, MD

Layers:
  1. Lab data ground truth (lab_results.state → region boost)
  2. Genetics/name signals (regional cultivar keywords)
  3. Popularity/ubiquity (high-report strains are nationally available)
  4. Type regional bias (subtle ±5 point adjustments)
  5. Data quality modifier (search-only ×0.6, partial ×0.8, full ×1.0)

All scores tagged source='heuristic'. Future dispensary API data
can override with source='dispensary'.

Usage:
    python scripts/generate_regional_availability.py
"""
import sqlite3
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB = ROOT / "data" / "processed" / "cannalchemy.db"

REGIONS = ["PAC", "MTN", "MWE", "GLK", "SOU", "NEN", "MAT"]

# ── Layer 1: State → Region mapping ─────────────────────────────────────
STATE_TO_REGION = {
    "CA": "PAC", "OR": "PAC", "WA": "PAC", "HI": "PAC", "AK": "PAC",
    "CO": "MTN", "NV": "MTN", "AZ": "MTN", "NM": "MTN", "UT": "MTN",
    "MT": "MTN", "ID": "MTN", "WY": "MTN",
    "IL": "MWE", "MI": "MWE", "MO": "MWE", "MN": "MWE", "WI": "MWE",
    "IN": "MWE", "IA": "MWE", "KS": "MWE", "NE": "MWE", "ND": "MWE", "SD": "MWE",
    "OH": "GLK", "PA": "GLK",
    "FL": "SOU", "GA": "SOU", "TX": "SOU", "NC": "SOU", "VA": "SOU",
    "LA": "SOU", "SC": "SOU", "TN": "SOU", "AL": "SOU", "MS": "SOU",
    "AR": "SOU", "KY": "SOU", "WV": "SOU", "OK": "SOU", "MD": "SOU", "DC": "SOU",
    "MA": "NEN", "CT": "NEN", "ME": "NEN", "VT": "NEN", "NH": "NEN", "RI": "NEN",
    "NY": "MAT", "NJ": "MAT", "DE": "MAT",
}

# ── Layer 2: Name/genetics keyword → regional boosts ────────────────────
# Format: (pattern, {region: boost})
# These are well-known regional cultivars or name signals
REGIONAL_KEYWORDS = [
    # Pacific / West Coast origins
    (r"\bcali\b", {"PAC": 20, "MTN": 10}),
    (r"\bla\b", {"PAC": 18, "MTN": 8}),
    (r"\bsf\b", {"PAC": 15}),
    (r"\boakland\b", {"PAC": 15}),
    (r"\bwest\s*coast\b", {"PAC": 20, "MTN": 10}),
    (r"\bsunset\b", {"PAC": 8}),
    (r"\bocean\b", {"PAC": 8}),
    (r"\bpacific\b", {"PAC": 15}),
    (r"\bhawaii", {"PAC": 20}),
    (r"\bmaui\b", {"PAC": 20}),
    (r"\bkona\b", {"PAC": 18}),
    (r"\bsocal\b", {"PAC": 18}),
    (r"\bhollywood\b", {"PAC": 15}),
    (r"\bsfv\b", {"PAC": 15}),  # San Fernando Valley
    (r"\bhumboldt\b", {"PAC": 20}),
    (r"\bmendo\b", {"PAC": 18}),  # Mendocino
    (r"\bemerald\b", {"PAC": 12}),  # Emerald Triangle
    (r"\bportland\b", {"PAC": 12}),
    (r"\bseattle\b", {"PAC": 12}),

    # Mountain / Colorado
    (r"\bcolorado\b", {"MTN": 18, "PAC": 5}),
    (r"\bdenver\b", {"MTN": 18}),
    (r"\bboulder\b", {"MTN": 15}),
    (r"\brocky\b", {"MTN": 12}),
    (r"\bvegas\b", {"MTN": 15, "PAC": 5}),
    (r"\bdesert\b", {"MTN": 10, "SOU": 5}),
    (r"\barizona\b", {"MTN": 15}),

    # East Coast / New York / Mid-Atlantic
    (r"\bnyc\b", {"MAT": 20, "NEN": 10}),
    (r"\bnew\s*york\b", {"MAT": 18, "NEN": 8}),
    (r"\bbrooklyn\b", {"MAT": 15}),
    (r"\bbronx\b", {"MAT": 15}),
    (r"\bmanhattan\b", {"MAT": 15}),
    (r"\beast\s*coast\b", {"MAT": 15, "NEN": 15}),
    (r"\bjersey\b", {"MAT": 12}),
    (r"\bphilly\b", {"MAT": 12, "GLK": 8}),

    # New England
    (r"\bboston\b", {"NEN": 15, "MAT": 5}),
    (r"\bmaine\b", {"NEN": 15}),
    (r"\bvermont\b", {"NEN": 15}),

    # South
    (r"\batlanta\b", {"SOU": 18}),
    (r"\bmiami\b", {"SOU": 18}),
    (r"\bflorida\b", {"SOU": 15}),
    (r"\btexas\b", {"SOU": 12}),
    (r"\bsouthern\b", {"SOU": 10}),
    (r"\bdixie\b", {"SOU": 10}),
    (r"\bgeorgia\b", {"SOU": 12}),
    (r"\bnola\b", {"SOU": 12}),  # New Orleans

    # Midwest / Great Lakes
    (r"\bchicago\b", {"MWE": 18, "GLK": 10}),
    (r"\bdetroit\b", {"MWE": 15, "GLK": 10}),
    (r"\bmichigan\b", {"MWE": 15, "GLK": 10}),
    (r"\billinois\b", {"MWE": 15}),
    (r"\bmidwest\b", {"MWE": 15, "GLK": 10}),
    (r"\blakeside\b", {"GLK": 10, "MWE": 8}),

    # International origins (available everywhere, slight PAC/MTN lean)
    (r"\bafghan", {"PAC": 5, "MTN": 5, "NEN": 3, "MAT": 3}),
    (r"\bthai\b", {"PAC": 8}),
    (r"\bcolombi", {"PAC": 5, "SOU": 5}),
    (r"\bjamaica", {"SOU": 8, "MAT": 5, "NEN": 5}),
    (r"\bindica\s+kush\b", {"PAC": 5, "MTN": 5}),
]

# ── Layer 3: Nationally ubiquitous strains ──────────────────────────────
# These strains are so popular they're found everywhere
# We identify them by high effect report counts
UBIQUITY_THRESHOLD_HIGH = 500   # Very popular → 60 base everywhere
UBIQUITY_THRESHOLD_MED = 350    # Popular → 55 base everywhere
UBIQUITY_THRESHOLD_LOW = 200    # Known → 50 base everywhere

# ── Layer 4: Type regional bias (subtle) ────────────────────────────────
# West Coast has slightly more sativa availability, East/North more indica
TYPE_BIAS = {
    "sativa": {"PAC": 5, "MTN": 3, "MWE": 0, "GLK": -2, "SOU": 2, "NEN": -3, "MAT": -2},
    "indica": {"PAC": -2, "MTN": 0, "MWE": 2, "GLK": 3, "SOU": 0, "NEN": 5, "MAT": 3},
    "hybrid": {"PAC": 0, "MTN": 0, "MWE": 0, "GLK": 0, "SOU": 0, "NEN": 0, "MAT": 0},
}


def generate():
    conn = sqlite3.connect(str(DB))
    cur = conn.cursor()

    print("=" * 60)
    print("GENERATE REGIONAL AVAILABILITY")
    print("=" * 60)

    # Clear existing heuristic data (preserve any manual/dispensary entries)
    cur.execute("DELETE FROM strain_regions WHERE source = 'heuristic'")

    # Load all strains
    strains = cur.execute("""
        SELECT s.id, s.name, s.strain_type, s.source,
            COALESCE(s.data_quality, 'full') as data_quality,
            (SELECT COUNT(*) FROM effect_reports er WHERE er.strain_id = s.id) as effect_count,
            (SELECT SUM(er.report_count) FROM effect_reports er WHERE er.strain_id = s.id) as total_reports,
            COALESCE(sm.genetics, '') as genetics
        FROM strains s
        LEFT JOIN strain_metadata sm ON sm.strain_id = s.id
        ORDER BY s.id
    """).fetchall()

    print(f"  Processing {len(strains)} strains across {len(REGIONS)} regions...")

    # Layer 1: Lab data (check if any state data exists)
    lab_states = cur.execute("""
        SELECT DISTINCT normalized_strain_name, state
        FROM lab_results
        WHERE state IS NOT NULL AND state != ''
    """).fetchall()

    lab_map = {}
    for norm_name, state in lab_states:
        st = state.upper().strip()
        if st in STATE_TO_REGION:
            lab_map.setdefault(norm_name, set()).add(STATE_TO_REGION[st])

    print(f"  Layer 1 (lab data): {len(lab_map)} strains with state data")

    # Process each strain
    rows_to_insert = []
    stats = {"lab": 0, "name": 0, "ubiq": 0}

    for sid, name, stype, source, dq, effect_count, total_reports, genetics in strains:
        total_reports = total_reports or 0
        stype = (stype or "hybrid").lower()
        name_lower = name.lower()
        genetics_lower = genetics.lower() if genetics else ""
        search_text = f"{name_lower} {genetics_lower}"

        # Start with base scores
        scores = {r: 40 for r in REGIONS}  # default baseline

        # Layer 1: Lab data boost
        norm_name = re.sub(r"[^a-z0-9]", "", name_lower)
        if norm_name in lab_map:
            stats["lab"] += 1
            for region in lab_map[norm_name]:
                scores[region] += 25  # Strong signal — tested there

        # Layer 2: Name/genetics keyword signals
        matched_any = False
        for pattern, boosts in REGIONAL_KEYWORDS:
            if re.search(pattern, search_text, re.IGNORECASE):
                matched_any = True
                for region, boost in boosts.items():
                    scores[region] += boost
        if matched_any:
            stats["name"] += 1

        # Layer 3: Popularity/ubiquity
        if total_reports >= UBIQUITY_THRESHOLD_HIGH:
            stats["ubiq"] += 1
            for r in REGIONS:
                scores[r] = max(scores[r], 60)
        elif total_reports >= UBIQUITY_THRESHOLD_MED:
            stats["ubiq"] += 1
            for r in REGIONS:
                scores[r] = max(scores[r], 55)
        elif total_reports >= UBIQUITY_THRESHOLD_LOW:
            for r in REGIONS:
                scores[r] = max(scores[r], 50)

        # Layer 4: Type regional bias
        bias = TYPE_BIAS.get(stype, TYPE_BIAS["hybrid"])
        for r in REGIONS:
            scores[r] += bias.get(r, 0)

        # Layer 5: Data quality modifier
        if dq == "search-only":
            quality_mult = 0.6
        elif dq == "partial":
            quality_mult = 0.8
        else:
            quality_mult = 1.0

        for r in REGIONS:
            scores[r] = int(min(100, max(0, scores[r] * quality_mult)))

        # Insert rows
        for r in REGIONS:
            rows_to_insert.append((sid, r, scores[r], "heuristic", 0.5))

    # Bulk insert
    cur.executemany(
        "INSERT OR REPLACE INTO strain_regions (strain_id, region_code, availability_score, source, confidence) "
        "VALUES (?, ?, ?, ?, ?)",
        rows_to_insert,
    )

    conn.commit()

    # Verification
    total_rows = cur.execute("SELECT COUNT(*) FROM strain_regions").fetchone()[0]
    avg_scores = cur.execute("""
        SELECT region_code, ROUND(AVG(availability_score), 1), MIN(availability_score), MAX(availability_score)
        FROM strain_regions
        GROUP BY region_code
        ORDER BY region_code
    """).fetchall()

    print(f"\n  Layer signals applied:")
    print(f"    Lab data:     {stats['lab']} strains")
    print(f"    Name signals: {stats['name']} strains")
    print(f"    Ubiquitous:   {stats['ubiq']} strains")
    print(f"\n  Total rows inserted: {total_rows:,}")
    print(f"\n  Regional score distribution:")
    for region, avg, mn, mx in avg_scores:
        print(f"    {region}: avg={avg}, min={mn}, max={mx}")

    # Sample: show top 5 most regionally-distinct strains
    print(f"\n  Sample: Most regionally distinct strains:")
    distinct = cur.execute("""
        SELECT s.name,
            MAX(sr.availability_score) - MIN(sr.availability_score) as spread,
            GROUP_CONCAT(sr.region_code || ':' || sr.availability_score) as profile
        FROM strain_regions sr
        JOIN strains s ON s.id = sr.strain_id
        GROUP BY sr.strain_id
        HAVING spread > 0
        ORDER BY spread DESC
        LIMIT 10
    """).fetchall()
    for name, spread, profile in distinct:
        print(f"    {name} (spread={spread}): {profile}")

    conn.close()
    print(f"\n{'=' * 60}")
    print("REGIONAL AVAILABILITY GENERATED SUCCESSFULLY")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    generate()
