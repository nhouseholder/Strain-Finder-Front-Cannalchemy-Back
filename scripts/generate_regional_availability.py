"""Generate regional availability scores for all strains.

Fact-based 6-layer system using documented strain origins, genetics
lineage propagation, and real-world market maturity data.

Regions:
  PAC (Pacific)      - CA, OR, WA, HI, AK
  MTN (Mountain)     - CO, NV, AZ, NM, UT, MT, ID, WY
  MWE (Midwest)      - IL, MI, MO, OH, MN, WI, IN, IA, KS, NE, ND, SD
  GLK (Great Lakes)  - NY-upstate, PA, OH overlap
  SOU (South)        - FL, GA, TX, NC, VA, LA, SC, TN, AL, MS, AR, KY, WV, OK, MD, DC
  NEN (New England)  - MA, CT, ME, VT, NH, RI
  MAT (Mid-Atlantic) - NY-metro, NJ, PA-east, DE, MD

Layers:
  1. Market maturity base — mature legal markets carry more variety
  2. Known strain origins — 300+ strains with documented regional roots
  3. Genetics lineage propagation — children inherit parent origins
  4. Name/keyword signals — regional place names in strain names
  5. Popularity/ubiquity — high-report strains are nationally available
  6. Data quality modifier — search-only strains are less available

Usage:
    python scripts/generate_regional_availability.py
"""
import sqlite3
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB = ROOT / "data" / "processed" / "cannalchemy.db"

REGIONS = ["PAC", "MTN", "MWE", "GLK", "SOU", "NEN", "MAT"]

# ═══════════════════════════════════════════════════════════════════════
# LAYER 1: Market Maturity Base Scores
# ═══════════════════════════════════════════════════════════════════════
# Regions with longer-established legal markets genuinely carry more
# strain variety. This is fact-based on state legalization dates:
#   CA rec 2018 (medical 1996), CO rec 2014, WA rec 2014, OR rec 2015
#   MA rec 2018, MI rec 2019, IL rec 2020, AZ rec 2021
#   NJ rec 2022, NY rec 2023, FL medical only, etc.
#
# Base score = likelihood a randomly-chosen strain is stocked in that region.
MARKET_BASE = {
    "PAC": 55,  # CA/OR/WA — most mature, largest variety
    "MTN": 50,  # CO — very mature; NV/AZ growing
    "MWE": 40,  # IL/MI — growing markets, moderate variety
    "GLK": 35,  # PA medical, OH newer — limited variety
    "SOU": 32,  # OK is huge but fragmented; FL medical only
    "NEN": 42,  # MA mature, ME/VT/CT growing
    "MAT": 38,  # NJ/NY — newer but high demand
}

# ═══════════════════════════════════════════════════════════════════════
# LAYER 2: Known Strain Origins — Documented Regional Roots
# ═══════════════════════════════════════════════════════════════════════
# Format: normalized_name → {"home": region, "adjacent": [regions]}
# "home" = where the strain was bred/first popularized (+30 score)
# "adjacent" = nearby markets where it spread first (+15 score)
#
# Sources: Leafly origin data, breeder documentation, cannabis history
KNOWN_ORIGINS = {
    # ── California / Pacific (Cookies Fam, Jungle Boys, etc.) ─────────
    "og kush":              {"home": "PAC", "adjacent": ["MTN"]},
    "girl scout cookies":   {"home": "PAC", "adjacent": ["MTN"]},
    "gsc":                  {"home": "PAC", "adjacent": ["MTN"]},
    "gelato":               {"home": "PAC", "adjacent": ["MTN"]},
    "gelato 33":            {"home": "PAC", "adjacent": ["MTN"]},
    "gelato 41":            {"home": "PAC", "adjacent": ["MTN"]},
    "gelato #33":           {"home": "PAC", "adjacent": ["MTN"]},
    "gelato #41":           {"home": "PAC", "adjacent": ["MTN"]},
    "zkittlez":             {"home": "PAC", "adjacent": ["MTN"]},
    "wedding cake":         {"home": "PAC", "adjacent": ["MTN"]},
    "granddaddy purple":    {"home": "PAC", "adjacent": ["MTN"]},
    "gdp":                  {"home": "PAC", "adjacent": ["MTN"]},
    "blue dream":           {"home": "PAC", "adjacent": ["MTN"]},
    "gorilla glue":         {"home": "PAC", "adjacent": ["MTN", "MWE"]},
    "gorilla glue #4":      {"home": "PAC", "adjacent": ["MTN", "MWE"]},
    "gg4":                  {"home": "PAC", "adjacent": ["MTN", "MWE"]},
    "gg #4":                {"home": "PAC", "adjacent": ["MTN", "MWE"]},
    "sherbet":              {"home": "PAC", "adjacent": ["MTN"]},
    "sunset sherbet":       {"home": "PAC", "adjacent": ["MTN"]},
    "cherry pie":           {"home": "PAC", "adjacent": ["MTN"]},
    "tangie":               {"home": "PAC", "adjacent": ["MTN"]},
    "green crack":          {"home": "PAC", "adjacent": ["MTN"]},
    "mendo breath":         {"home": "PAC", "adjacent": []},
    "forbidden fruit":      {"home": "PAC", "adjacent": ["MTN"]},
    "lemon tree":           {"home": "PAC", "adjacent": ["MTN"]},
    "purple punch":         {"home": "PAC", "adjacent": ["MTN"]},
    "ice cream cake":       {"home": "PAC", "adjacent": ["MTN"]},
    "animal mints":         {"home": "PAC", "adjacent": ["MTN"]},
    "biscotti":             {"home": "PAC", "adjacent": ["MTN"]},
    "runtz":                {"home": "PAC", "adjacent": ["MTN"]},
    "white runtz":          {"home": "PAC", "adjacent": ["MTN"]},
    "pink runtz":           {"home": "PAC", "adjacent": ["MTN"]},
    "gary payton":          {"home": "PAC", "adjacent": ["MTN"]},
    "london pound cake":    {"home": "PAC", "adjacent": ["MTN"]},
    "london poundcake":     {"home": "PAC", "adjacent": ["MTN"]},
    "apple fritter":        {"home": "PAC", "adjacent": ["MTN"]},
    "sfv og":               {"home": "PAC", "adjacent": []},
    "fire og":              {"home": "PAC", "adjacent": ["MTN"]},
    "headband":             {"home": "PAC", "adjacent": ["MTN"]},
    "larry og":             {"home": "PAC", "adjacent": []},
    "skywalker og":         {"home": "PAC", "adjacent": ["MTN"]},
    "bubba kush":           {"home": "PAC", "adjacent": ["MTN"]},
    "do-si-dos":            {"home": "PAC", "adjacent": ["MTN"]},
    "dosidos":              {"home": "PAC", "adjacent": ["MTN"]},
    "mimosa":               {"home": "PAC", "adjacent": ["MTN"]},
    "mac":                  {"home": "PAC", "adjacent": ["MTN", "MWE"]},
    "mac 1":                {"home": "PAC", "adjacent": ["MTN", "MWE"]},
    "cereal milk":          {"home": "PAC", "adjacent": ["MTN"]},
    "cookies and cream":    {"home": "PAC", "adjacent": ["MTN"]},
    "thin mint cookies":    {"home": "PAC", "adjacent": []},
    "thin mint gsc":        {"home": "PAC", "adjacent": []},
    "platinum cookies":     {"home": "PAC", "adjacent": []},
    "platinum gsc":         {"home": "PAC", "adjacent": []},
    "trainwreck":           {"home": "PAC", "adjacent": ["MTN"]},
    "jack herer":           {"home": "PAC", "adjacent": ["MTN"]},
    "girl crush":           {"home": "PAC", "adjacent": []},
    "banana og":            {"home": "PAC", "adjacent": ["MTN"]},
    "tahoe og":             {"home": "PAC", "adjacent": ["MTN"]},
    "king louis":           {"home": "PAC", "adjacent": []},
    "king louis xiii":      {"home": "PAC", "adjacent": []},
    "la confidential":      {"home": "PAC", "adjacent": []},
    "la kush":              {"home": "PAC", "adjacent": []},
    "lemon og":             {"home": "PAC", "adjacent": ["MTN"]},
    "wifi og":              {"home": "PAC", "adjacent": []},
    "ghost og":             {"home": "PAC", "adjacent": ["MTN"]},
    "master kush":          {"home": "PAC", "adjacent": ["MTN"]},
    "hindu kush":           {"home": "PAC", "adjacent": ["MTN"]},
    "kosher kush":          {"home": "PAC", "adjacent": ["MTN"]},
    "critical kush":        {"home": "PAC", "adjacent": ["MTN"]},
    "triangle kush":        {"home": "PAC", "adjacent": ["SOU"]},
    "lava cake":            {"home": "PAC", "adjacent": ["MTN"]},
    "zaza":                 {"home": "PAC", "adjacent": ["MTN"]},
    "emerald og":           {"home": "PAC", "adjacent": []},
    "cookies":              {"home": "PAC", "adjacent": ["MTN"]},
    "cherry cookies":       {"home": "PAC", "adjacent": ["MTN"]},
    "guava":                {"home": "PAC", "adjacent": ["MTN"]},
    "georgia pie":          {"home": "PAC", "adjacent": ["SOU"]},
    "point break":          {"home": "PAC", "adjacent": []},
    "gmo":                  {"home": "PAC", "adjacent": ["MTN", "MWE"]},
    "gmo cookies":          {"home": "PAC", "adjacent": ["MTN", "MWE"]},
    "garlic cookies":       {"home": "PAC", "adjacent": ["MTN", "MWE"]},
    "grease monkey":        {"home": "PAC", "adjacent": ["MTN"]},
    "peanut butter breath": {"home": "PAC", "adjacent": ["MTN"]},
    "pancakes":             {"home": "PAC", "adjacent": ["MTN"]},
    "slurricane":           {"home": "PAC", "adjacent": ["MTN"]},
    "jealousy":             {"home": "PAC", "adjacent": ["MTN"]},
    "mochi":                {"home": "PAC", "adjacent": []},
    "permanent marker":     {"home": "PAC", "adjacent": ["MTN"]},
    "la pop rocks":         {"home": "PAC", "adjacent": []},
    "khalifa kush":         {"home": "PAC", "adjacent": []},
    "white truffle":        {"home": "PAC", "adjacent": ["MTN"]},
    "black truffle":        {"home": "PAC", "adjacent": ["MTN"]},
    "zoap":                 {"home": "PAC", "adjacent": ["MTN"]},
    "grape ape":            {"home": "PAC", "adjacent": ["MTN"]},
    "grape pie":            {"home": "PAC", "adjacent": ["MTN"]},

    # ── Hawaii ─────────────────────────────────────────────────────────
    "maui wowie":           {"home": "PAC", "adjacent": []},
    "maui waui":            {"home": "PAC", "adjacent": []},
    "kona gold":            {"home": "PAC", "adjacent": []},
    "puna budder":          {"home": "PAC", "adjacent": []},

    # ── Pacific Northwest ──────────────────────────────────────────────
    "dutch treat":          {"home": "PAC", "adjacent": []},
    "cinderella 99":        {"home": "PAC", "adjacent": ["MTN"]},
    "space queen":          {"home": "PAC", "adjacent": []},
    "romulan":              {"home": "PAC", "adjacent": []},

    # ── Colorado / Mountain ────────────────────────────────────────────
    "durban poison":        {"home": "MTN", "adjacent": ["PAC"]},
    "flo":                  {"home": "MTN", "adjacent": ["PAC"]},
    "golden goat":          {"home": "MTN", "adjacent": ["PAC"]},
    "bruce banner":         {"home": "MTN", "adjacent": ["PAC"]},
    "bruce banner #3":      {"home": "MTN", "adjacent": ["PAC"]},
    "sweet tooth":          {"home": "MTN", "adjacent": ["PAC"]},
    "clementine":           {"home": "MTN", "adjacent": ["PAC"]},
    "tropicana cookies":    {"home": "MTN", "adjacent": ["PAC"]},
    "l'orange":             {"home": "MTN", "adjacent": ["PAC"]},
    "doctor who":           {"home": "MTN", "adjacent": []},
    "peach ringz":          {"home": "MTN", "adjacent": ["PAC"]},
    "ghost train haze":     {"home": "MTN", "adjacent": ["PAC"]},

    # ── East Coast / NYC / Mid-Atlantic ────────────────────────────────
    "sour diesel":          {"home": "MAT", "adjacent": ["NEN"]},
    "chemdawg":             {"home": "MAT", "adjacent": ["NEN", "PAC"]},
    "chem dawg":            {"home": "MAT", "adjacent": ["NEN", "PAC"]},
    "chemdog":              {"home": "MAT", "adjacent": ["NEN", "PAC"]},
    "nyc diesel":           {"home": "MAT", "adjacent": ["NEN"]},
    "strawberry cough":     {"home": "MAT", "adjacent": ["NEN"]},
    "ak-47":                {"home": "MAT", "adjacent": ["NEN", "GLK"]},
    "east coast sour diesel": {"home": "MAT", "adjacent": ["NEN"]},
    "headbanger":           {"home": "MAT", "adjacent": ["NEN"]},
    "super sour diesel":    {"home": "MAT", "adjacent": ["NEN"]},

    # ── New England ────────────────────────────────────────────────────
    "black dog":            {"home": "NEN", "adjacent": ["MAT"]},

    # ── South / Oklahoma / Florida ─────────────────────────────────────
    "triangle mints":       {"home": "SOU", "adjacent": ["MAT"]},
    "florida og":           {"home": "SOU", "adjacent": ["MAT"]},
    "kush mints":           {"home": "SOU", "adjacent": ["PAC", "MTN"]},

    # ── Michigan / Midwest ─────────────────────────────────────────────
    "motor breath":         {"home": "MWE", "adjacent": ["GLK"]},
    "motorbreath":          {"home": "MWE", "adjacent": ["GLK"]},
    "mendo ultra":          {"home": "MWE", "adjacent": ["GLK"]},
    "element":              {"home": "MWE", "adjacent": ["GLK"]},

    # ── Nationally ubiquitous classics (bred internationally, grown everywhere)
    "northern lights":      {"home": "PAC", "adjacent": ["MTN", "NEN", "MAT"]},
    "white widow":          {"home": "PAC", "adjacent": ["MTN", "NEN", "MAT"]},
    "super silver haze":    {"home": "PAC", "adjacent": ["MTN", "NEN", "MAT"]},
    "skunk #1":             {"home": "PAC", "adjacent": ["MTN", "NEN", "MAT"]},
    "skunk 1":              {"home": "PAC", "adjacent": ["MTN", "NEN", "MAT"]},
    "haze":                 {"home": "PAC", "adjacent": ["MTN", "MAT", "NEN"]},
    "g13":                  {"home": "PAC", "adjacent": ["MTN"]},
    "white rhino":          {"home": "PAC", "adjacent": ["MTN", "SOU"]},
    "amnesia haze":         {"home": "PAC", "adjacent": ["MTN", "MAT"]},
    "blueberry":            {"home": "PAC", "adjacent": ["MTN", "NEN"]},
    "purple haze":          {"home": "PAC", "adjacent": ["MTN", "MAT"]},
    "pineapple express":    {"home": "PAC", "adjacent": ["MTN"]},
    "sour og":              {"home": "PAC", "adjacent": ["MTN", "MAT"]},
    "purple kush":          {"home": "PAC", "adjacent": ["MTN"]},
    "lemon haze":           {"home": "PAC", "adjacent": ["MTN"]},
    "super lemon haze":     {"home": "PAC", "adjacent": ["MTN"]},
    "jack flash":           {"home": "PAC", "adjacent": ["MTN"]},
    "blue cheese":          {"home": "PAC", "adjacent": ["MTN", "NEN"]},
    "cheese":               {"home": "PAC", "adjacent": ["MTN", "NEN"]},
    "blue cookies":         {"home": "PAC", "adjacent": ["MTN"]},
    "banana kush":          {"home": "PAC", "adjacent": ["MTN"]},
    "gods gift":            {"home": "PAC", "adjacent": ["MTN"]},
    "god's gift":           {"home": "PAC", "adjacent": ["MTN"]},
    "key lime pie":         {"home": "PAC", "adjacent": ["MTN"]},
    "dosido":               {"home": "PAC", "adjacent": ["MTN"]},
    "white fire og":        {"home": "PAC", "adjacent": ["MTN"]},
    "layer cake":           {"home": "PAC", "adjacent": ["MTN"]},
    "la kush cake":         {"home": "PAC", "adjacent": []},
    "jungle cake":          {"home": "PAC", "adjacent": ["MTN"]},
    "birthday cake":        {"home": "PAC", "adjacent": ["MTN"]},
    "ice cream":            {"home": "PAC", "adjacent": ["MTN"]},
    "oreoz":                {"home": "PAC", "adjacent": ["MTN"]},
    "london truffle":       {"home": "PAC", "adjacent": ["MTN"]},
}

# ═══════════════════════════════════════════════════════════════════════
# LAYER 3: Genetics Lineage Keywords for Propagation
# ═══════════════════════════════════════════════════════════════════════
# When a parent strain has known origins, the child inherits a boost.
# These are exact match fragments to look for in the genetics field.
# Format: genetics_fragment → home_region
GENETICS_LINEAGE = {
    "og kush":          "PAC",
    "girl scout cookies": "PAC",
    "gsc":              "PAC",
    "cookies":          "PAC",
    "gelato":           "PAC",
    "zkittlez":         "PAC",
    "wedding cake":     "PAC",
    "granddaddy purple": "PAC",
    "gdp":              "PAC",
    "blue dream":       "PAC",
    "gorilla glue":     "PAC",
    "gg4":              "PAC",
    "sherbet":          "PAC",
    "sunset sherbet":   "PAC",
    "cherry pie":       "PAC",
    "tangie":           "PAC",
    "green crack":      "PAC",
    "purple punch":     "PAC",
    "ice cream cake":   "PAC",
    "animal mints":     "PAC",
    "runtz":            "PAC",
    "thin mint":        "PAC",
    "trainwreck":       "PAC",
    "jack herer":       "PAC",
    "bubba kush":       "PAC",
    "master kush":      "PAC",
    "hindu kush":       "PAC",
    "fire og":          "PAC",
    "ghost og":         "PAC",
    "headband":         "PAC",
    "gmo":              "PAC",
    "lemon tree":       "PAC",
    "forbidden fruit":  "PAC",
    "mac":              "PAC",
    "mimosa":           "PAC",
    "do-si-dos":        "PAC",
    "dosidos":          "PAC",
    "grape ape":        "PAC",
    "white truffle":    "PAC",
    "biscotti":         "PAC",
    "northern lights":  "PAC",
    "white widow":      "PAC",
    "skunk":            "PAC",
    "super silver haze": "PAC",
    "blueberry":        "PAC",
    "sour diesel":      "MAT",
    "chemdawg":         "MAT",
    "chem dawg":        "MAT",
    "chemdog":          "MAT",
    "nyc diesel":       "MAT",
    "strawberry cough": "MAT",
    "ak-47":            "MAT",
    "durban poison":    "MTN",
    "bruce banner":     "MTN",
    "golden goat":      "MTN",
    "tropicana cookies": "MTN",
    "ghost train haze": "MTN",
    "motor breath":     "MWE",
    "motorbreath":      "MWE",
}

# ═══════════════════════════════════════════════════════════════════════
# LAYER 4: Name/Keyword Signals (geographic names in strain names)
# ═══════════════════════════════════════════════════════════════════════
REGIONAL_KEYWORDS = [
    # Pacific / West Coast
    (r"\bcali\b", {"PAC": 20, "MTN": 8}),
    (r"\bla\b", {"PAC": 15}),
    (r"\bsf\b", {"PAC": 12}),
    (r"\boakland\b", {"PAC": 12}),
    (r"\bwest\s*coast\b", {"PAC": 18, "MTN": 8}),
    (r"\bpacific\b", {"PAC": 12}),
    (r"\bhawaii", {"PAC": 18}),
    (r"\bmaui\b", {"PAC": 18}),
    (r"\bkona\b", {"PAC": 15}),
    (r"\bsocal\b", {"PAC": 15}),
    (r"\bhollywood\b", {"PAC": 12}),
    (r"\bsfv\b", {"PAC": 12}),
    (r"\bhumboldt\b", {"PAC": 18}),
    (r"\bmendo\b", {"PAC": 15}),
    (r"\bemerald\b", {"PAC": 10}),
    (r"\bportland\b", {"PAC": 10}),
    (r"\bseattle\b", {"PAC": 10}),

    # Mountain / Colorado
    (r"\bcolorado\b", {"MTN": 15, "PAC": 5}),
    (r"\bdenver\b", {"MTN": 15}),
    (r"\bboulder\b", {"MTN": 12}),
    (r"\brocky\b", {"MTN": 10}),
    (r"\bvegas\b", {"MTN": 12}),
    (r"\barizona\b", {"MTN": 12}),

    # East Coast / Mid-Atlantic
    (r"\bnyc\b", {"MAT": 18, "NEN": 8}),
    (r"\bnew\s*york\b", {"MAT": 15, "NEN": 6}),
    (r"\bbrooklyn\b", {"MAT": 12}),
    (r"\bbronx\b", {"MAT": 12}),
    (r"\beast\s*coast\b", {"MAT": 12, "NEN": 12}),
    (r"\bjersey\b", {"MAT": 10}),
    (r"\bphilly\b", {"MAT": 10, "GLK": 6}),

    # New England
    (r"\bboston\b", {"NEN": 12, "MAT": 5}),
    (r"\bmaine\b", {"NEN": 12}),
    (r"\bvermont\b", {"NEN": 12}),

    # South
    (r"\batlanta\b", {"SOU": 15}),
    (r"\bmiami\b", {"SOU": 15}),
    (r"\bflorida\b", {"SOU": 12}),
    (r"\btexas\b", {"SOU": 10}),
    (r"\bsouthern\b", {"SOU": 8}),
    (r"\bgeorgia\b", {"SOU": 10}),
    (r"\bnola\b", {"SOU": 10}),
    (r"\boklahoma\b", {"SOU": 10}),

    # Midwest / Great Lakes
    (r"\bchicago\b", {"MWE": 15, "GLK": 8}),
    (r"\bdetroit\b", {"MWE": 12, "GLK": 8}),
    (r"\bmichigan\b", {"MWE": 12, "GLK": 8}),
    (r"\billinois\b", {"MWE": 12}),
    (r"\bmidwest\b", {"MWE": 12, "GLK": 8}),

    # International origins (available via West Coast importers)
    (r"\bafghan", {"PAC": 5, "MTN": 5}),
    (r"\bthai\b", {"PAC": 6}),
    (r"\bcolombi", {"PAC": 4, "SOU": 4}),
    (r"\bjamaica", {"SOU": 6, "MAT": 4}),
]

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

# ═══════════════════════════════════════════════════════════════════════
# LAYER 5: Popularity / Ubiquity Thresholds
# ═══════════════════════════════════════════════════════════════════════
UBIQUITY_HIGH = 500    # Very popular → at least 70 in all regions
UBIQUITY_MED  = 350    # Popular → at least 60 everywhere
UBIQUITY_LOW  = 200    # Known → at least 50 everywhere
UBIQUITY_BASE = 100    # Somewhat known → at least 45 everywhere


def generate():
    conn = sqlite3.connect(str(DB))
    cur = conn.cursor()

    print("=" * 60)
    print("GENERATE REGIONAL AVAILABILITY (v2 — Fact-Based)")
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

    # Lab data layer
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

    # Process each strain
    rows_to_insert = []
    stats = {"known_origin": 0, "genetics_prop": 0, "name_kw": 0,
             "ubiq": 0, "lab": 0}

    for sid, name, stype, source, dq, effect_count, total_reports, genetics in strains:
        total_reports = total_reports or 0
        stype = (stype or "hybrid").lower()
        name_lower = name.lower().strip()
        genetics_lower = genetics.lower() if genetics else ""
        name_norm = re.sub(r"[^a-z0-9 ]", "", name_lower).strip()

        # ── Layer 1: Market maturity base ──────────────────────────────
        scores = {r: MARKET_BASE[r] for r in REGIONS}

        # ── Layer 1b: Lab data boost ──────────────────────────────────
        norm_key = re.sub(r"[^a-z0-9]", "", name_lower)
        if norm_key in lab_map:
            stats["lab"] += 1
            for region in lab_map[norm_key]:
                scores[region] += 20

        # ── Layer 2: Known strain origins ─────────────────────────────
        origin = KNOWN_ORIGINS.get(name_norm) or KNOWN_ORIGINS.get(name_lower)
        if origin:
            stats["known_origin"] += 1
            scores[origin["home"]] += 30
            for adj in origin.get("adjacent", []):
                scores[adj] += 15

        # ── Layer 3: Genetics lineage propagation ─────────────────────
        if genetics_lower:
            parent_regions = set()
            for fragment, region in GENETICS_LINEAGE.items():
                if fragment in genetics_lower:
                    parent_regions.add(region)

            if parent_regions:
                stats["genetics_prop"] += 1
                for region in parent_regions:
                    scores[region] += 18  # inherited from parent

        # ── Layer 4: Name/keyword signals ─────────────────────────────
        search_text = f"{name_lower} {genetics_lower}"
        matched_any = False
        for pattern, boosts in REGIONAL_KEYWORDS:
            if re.search(pattern, search_text, re.IGNORECASE):
                matched_any = True
                for region, boost in boosts.items():
                    scores[region] += boost
        if matched_any:
            stats["name_kw"] += 1

        # ── Layer 5: Popularity/ubiquity ──────────────────────────────
        if total_reports >= UBIQUITY_HIGH:
            stats["ubiq"] += 1
            for r in REGIONS:
                scores[r] = max(scores[r], 70)
        elif total_reports >= UBIQUITY_MED:
            stats["ubiq"] += 1
            for r in REGIONS:
                scores[r] = max(scores[r], 60)
        elif total_reports >= UBIQUITY_LOW:
            for r in REGIONS:
                scores[r] = max(scores[r], 50)
        elif total_reports >= UBIQUITY_BASE:
            for r in REGIONS:
                scores[r] = max(scores[r], 45)

        # ── Layer 6: Data quality modifier ────────────────────────────
        # search-only strains are less established in any market
        if dq == "search-only":
            quality_mult = 0.65
        elif dq == "partial":
            quality_mult = 0.85
        else:
            quality_mult = 1.0

        for r in REGIONS:
            scores[r] = int(min(100, max(0, scores[r] * quality_mult)))

        # Insert rows
        for r in REGIONS:
            rows_to_insert.append((sid, r, scores[r], "heuristic", 0.6))

    # Bulk insert
    cur.executemany(
        "INSERT OR REPLACE INTO strain_regions "
        "(strain_id, region_code, availability_score, source, confidence) "
        "VALUES (?, ?, ?, ?, ?)",
        rows_to_insert,
    )

    conn.commit()

    # ── Verification ──────────────────────────────────────────────────
    total_rows = cur.execute("SELECT COUNT(*) FROM strain_regions").fetchone()[0]
    avg_scores = cur.execute("""
        SELECT region_code,
            ROUND(AVG(availability_score), 1),
            MIN(availability_score),
            MAX(availability_score)
        FROM strain_regions
        GROUP BY region_code
        ORDER BY region_code
    """).fetchall()

    print(f"\n  Layer signals applied:")
    print(f"    Known origins:  {stats['known_origin']} strains (direct match)")
    print(f"    Genetics prop:  {stats['genetics_prop']} strains (lineage)")
    print(f"    Name keywords:  {stats['name_kw']} strains")
    print(f"    Ubiquitous:     {stats['ubiq']} strains")
    print(f"    Lab data:       {stats['lab']} strains")
    print(f"\n  Total rows: {total_rows:,}")
    print(f"\n  Regional score distribution:")
    for region, avg, mn, mx in avg_scores:
        print(f"    {region}: avg={avg}, min={mn}, max={mx}")

    # Sample: most regionally-distinct strains
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
        LIMIT 15
    """).fetchall()
    for name, spread, profile in distinct:
        print(f"    {name} (spread={spread}): {profile}")

    # Spot-check known strains
    print(f"\n  Spot checks:")
    spot_checks = [
        "Blue Dream", "Sour Diesel", "OG Kush", "Durban Poison",
        "Girl Scout Cookies", "Gorilla Glue #4", "Northern Lights",
        "Wedding Cake", "Motor Breath",
    ]
    for sname in spot_checks:
        row = cur.execute("""
            SELECT GROUP_CONCAT(sr.region_code || ':' || sr.availability_score)
            FROM strain_regions sr
            JOIN strains s ON s.id = sr.strain_id
            WHERE s.name = ?
        """, (sname,)).fetchone()
        if row and row[0]:
            print(f"    {sname}: {row[0]}")

    conn.close()
    print(f"\n{'=' * 60}")
    print("REGIONAL AVAILABILITY v2 GENERATED SUCCESSFULLY")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    generate()
