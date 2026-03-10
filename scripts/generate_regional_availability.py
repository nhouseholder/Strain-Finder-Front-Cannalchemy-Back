"""Generate regional availability scores for all strains.

Evidence-based scoring system (v3). Every point is earned through real
signals — no market-maturity floors. Strains start at 0 and accumulate
score only from verified origins, external dispensary data, catalog
presence, user-report volume, genetics lineage, and geographic keywords.

Regions:
  PAC (Pacific)      - CA, OR, WA, HI, AK
  MTN (Mountain)     - CO, NV, AZ, NM, UT, MT, ID, WY
  MWE (Midwest)      - IL, MI, MO, OH, MN, WI, IN, IA, KS, NE, ND, SD
  GLK (Great Lakes)  - NY-upstate, PA, OH overlap
  SOU (South)        - FL, GA, TX, NC, VA, LA, SC, TN, AL, MS, AR, KY, WV, OK, MD, DC
  NEN (New England)  - MA, CT, ME, VT, NH, RI
  MAT (Mid-Atlantic) - NY-metro, NJ, PA-east, DE, MD

Layers (all additive — no floors):
  1. Known strain origins — 250+ strains with documented regional roots
  2. External: Kushy dispensary location data — real CA dispensary presence
  3. External: Leafly catalog presence — nationally recognized strains
  4. Report-based ubiquity — strictly tiered by report volume
  5. Genetics lineage propagation — children inherit parent origins
  6. Name/keyword signals — geographic references in strain names
  7. Data quality multiplier — search-only strains heavily discounted

Usage:
    python scripts/generate_regional_availability.py
"""
import sqlite3
import csv
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB = ROOT / "data" / "processed" / "cannalchemy.db"
KUSHY_CSV = ROOT / "data" / "raw" / "kushy_full.csv"
LEAFLY_CSV = ROOT / "data" / "raw" / "leafly_strain_data.csv"

REGIONS = ["PAC", "MTN", "MWE", "GLK", "SOU", "NEN", "MAT"]

# ═══════════════════════════════════════════════════════════════════════
# LAYER 1: Known Strain Origins — Documented Regional Roots
# ═══════════════════════════════════════════════════════════════════════
# Format: normalized_name → {"home": region, "adjacent": [regions]}
# "home" = where the strain was bred/first popularized (+35 score)
# "adjacent" = nearby markets where it spread first (+16 score)
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
# LAYER 5: Genetics Lineage Keywords for Propagation
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
# LAYER 6: Name/Keyword Signals (geographic names in strain names)
# ═══════════════════════════════════════════════════════════════════════
# Values reduced from v2 (max was +20), now max +8 per match.
REGIONAL_KEYWORDS = [
    # Pacific / West Coast
    (r"\bcali\b", {"PAC": 8, "MTN": 3}),
    (r"\bla\b", {"PAC": 6}),
    (r"\bsf\b", {"PAC": 5}),
    (r"\boakland\b", {"PAC": 5}),
    (r"\bwest\s*coast\b", {"PAC": 8, "MTN": 3}),
    (r"\bpacific\b", {"PAC": 5}),
    (r"\bhawaii", {"PAC": 8}),
    (r"\bmaui\b", {"PAC": 8}),
    (r"\bkona\b", {"PAC": 6}),
    (r"\bsocal\b", {"PAC": 6}),
    (r"\bhollywood\b", {"PAC": 5}),
    (r"\bsfv\b", {"PAC": 5}),
    (r"\bhumboldt\b", {"PAC": 8}),
    (r"\bmendo\b", {"PAC": 6}),
    (r"\bemerald\b", {"PAC": 4}),
    (r"\bportland\b", {"PAC": 4}),
    (r"\bseattle\b", {"PAC": 4}),

    # Mountain / Colorado
    (r"\bcolorado\b", {"MTN": 6, "PAC": 2}),
    (r"\bdenver\b", {"MTN": 6}),
    (r"\bboulder\b", {"MTN": 5}),
    (r"\brocky\b", {"MTN": 4}),
    (r"\bvegas\b", {"MTN": 5}),
    (r"\barizona\b", {"MTN": 5}),

    # East Coast / Mid-Atlantic
    (r"\bnyc\b", {"MAT": 8, "NEN": 3}),
    (r"\bnew\s*york\b", {"MAT": 6, "NEN": 2}),
    (r"\bbrooklyn\b", {"MAT": 5}),
    (r"\bbronx\b", {"MAT": 5}),
    (r"\beast\s*coast\b", {"MAT": 5, "NEN": 5}),
    (r"\bjersey\b", {"MAT": 4}),
    (r"\bphilly\b", {"MAT": 4, "GLK": 2}),

    # New England
    (r"\bboston\b", {"NEN": 5, "MAT": 2}),
    (r"\bmaine\b", {"NEN": 5}),
    (r"\bvermont\b", {"NEN": 5}),

    # South
    (r"\batlanta\b", {"SOU": 6}),
    (r"\bmiami\b", {"SOU": 6}),
    (r"\bflorida\b", {"SOU": 5}),
    (r"\btexas\b", {"SOU": 4}),
    (r"\bsouthern\b", {"SOU": 3}),
    (r"\bgeorgia\b", {"SOU": 4}),
    (r"\bnola\b", {"SOU": 4}),
    (r"\boklahoma\b", {"SOU": 4}),

    # Midwest / Great Lakes
    (r"\bchicago\b", {"MWE": 6, "GLK": 3}),
    (r"\bdetroit\b", {"MWE": 5, "GLK": 3}),
    (r"\bmichigan\b", {"MWE": 5, "GLK": 3}),
    (r"\billinois\b", {"MWE": 5}),
    (r"\bmidwest\b", {"MWE": 5, "GLK": 3}),

    # International origins
    (r"\bafghan", {"PAC": 2, "MTN": 2}),
    (r"\bthai\b", {"PAC": 2}),
    (r"\bcolombi", {"PAC": 2, "SOU": 2}),
    (r"\bjamaica", {"SOU": 3, "MAT": 2}),
]

# State → region mapping for Kushy dispensary locations
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
# LAYER 4: Report-Based Ubiquity — Reduced Weight
# ═══════════════════════════════════════════════════════════════════════
# NOTE: Report counts in our DB are inflated for many strains due to
# archetype enrichment. Blue Dream has 853, OG Kush 942, while enriched
# strains like "Platinum Garlic" have 10,207. Report count is a signal
# but NOT the primary popularity indicator. Cross-validation with
# external catalogs (Leafly, Kushy) is more reliable.
UBIQUITY_TIERS = [
    (1500, 16),   # Very popular by reports (unreliable above this threshold)
    (1000, 14),   # Popular
    (500,  10),   # Well-known
    (200,   6),   # Moderately known
    (100,   3),   # Somewhat known
]

# ═══════════════════════════════════════════════════════════════════════
# Signal strength constants
# ═══════════════════════════════════════════════════════════════════════
ORIGIN_HOME_BOOST = 35       # Known origin — home region
ORIGIN_ADJACENT_BOOST = 18   # Known origin — adjacent market
LEAFLY_CATALOG_BOOST = 12    # Listed in Leafly (editorially curated = strong signal)
GENETICS_BOOST = 10          # Parent strain lineage match
KEYWORD_CAP_PER_REGION = 10  # Max keyword boost per region

# Kushy dispensary — direct evidence for observed region
KUSHY_DIRECT_BOOST = 22      # Strain found at real dispensaries

# Kushy dispensary — extrapolated to other legal markets
# Rationale: strains stocked at CA dispensaries with moderate national
# visibility (500+ reports) are very likely available in other mature
# legal markets, just at lower frequency. Without this extrapolation,
# non-PAC regions would be severely under-represented (Kushy is 99% CA).
KUSHY_EXTRAPOLATION = {
    # With 1000+ reports: strong evidence for national availability
    1000: {"MTN": 14, "NEN": 10, "MAT": 10, "MWE": 8, "GLK": 6, "SOU": 6},
    # With 500+ reports: moderate evidence
    500:  {"MTN": 10, "NEN": 6, "MAT": 6, "MWE": 4, "GLK": 4, "SOU": 4},
}

# Cross-validation bonus — strains confirmed by multiple independent sources
# are more reliably popular than single-source evidence
CROSS_VALIDATION_ORIGIN_LEAFLY = 15  # In Known Origins AND Leafly catalog
CROSS_VALIDATION_LEAFLY_REPORTS = 8  # In Leafly AND ≥500 reports

# ═══════════════════════════════════════════════════════════════════════
# Data quality multipliers — applied to final score
# ═══════════════════════════════════════════════════════════════════════
QUALITY_MULTIPLIERS = {
    "full": 1.0,
    "partial": 0.65,
    "search-only": 0.25,
}


def _load_kushy_dispensary_data(db_names):
    """Load Kushy CSV and extract dispensary location → region mappings.

    Returns dict: normalized_strain_name → set of regions where
    the strain was found at real dispensaries.
    """
    kushy_map = {}
    if not KUSHY_CSV.exists():
        return kushy_map

    with open(KUSHY_CSV, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            loc = (row.get("location") or "").strip()
            name = (row.get("name") or "").strip()
            if not loc or loc == "NULL" or not name:
                continue

            # Extract state from "City, ST" format
            m = re.search(r',\s*([A-Z]{2})\s*$', loc)
            if not m:
                continue
            state = m.group(1)
            if state not in STATE_TO_REGION:
                continue
            region = STATE_TO_REGION[state]

            # Normalize name for matching
            norm = re.sub(r"[^a-z0-9]", "", name.lower().strip())
            if norm in db_names:
                kushy_map.setdefault(norm, set()).add(region)

    return kushy_map


def _load_leafly_catalog(db_names):
    """Load Leafly CSV and identify which strains are in the catalog.

    Returns set of normalized strain names present in Leafly.
    """
    leafly_set = set()
    if not LEAFLY_CSV.exists():
        return leafly_set

    with open(LEAFLY_CSV, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            name = (row.get("name") or "").strip()
            if name:
                norm = re.sub(r"[^a-z0-9]", "", name.lower().strip())
                if norm in db_names:
                    leafly_set.add(norm)

    return leafly_set


def generate():
    conn = sqlite3.connect(str(DB))
    cur = conn.cursor()

    print("=" * 60)
    print("GENERATE REGIONAL AVAILABILITY (v3 — Evidence-Based)")
    print("=" * 60)

    # Clear existing heuristic data
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

    # Build name → id map for external data matching
    # Include common aliases so Leafly/Kushy names match our DB entries
    db_names = {}
    for sid, name, *_ in strains:
        norm = re.sub(r"[^a-z0-9]", "", name.lower().strip())
        db_names[norm] = sid

    # Alias resolution: external catalogs use abbreviated or trademark-safe names
    # Map common catalog aliases → our canonical DB normalized name
    CATALOG_ALIASES = {
        "gg4": "gorillaglue4",
        "gsc": "girlscoutcookies",
        "gdp": "granddaddypurple",
        "originalglue": "gorillaglue4",
    }
    # Register aliases so external data matching works
    for alias, canonical in CATALOG_ALIASES.items():
        if canonical in db_names and alias not in db_names:
            db_names[alias] = db_names[canonical]

    # ── Load external data ───────────────────────────────────────────
    print("\n  Loading external data sources...")

    kushy_map = _load_kushy_dispensary_data(db_names)
    print(f"    Kushy dispensary: {len(kushy_map)} strains with location data")

    leafly_set = _load_leafly_catalog(db_names)
    print(f"    Leafly catalog:   {len(leafly_set)} strains matched")

    # ── Process each strain ──────────────────────────────────────────
    rows_to_insert = []
    stats = {
        "known_origin": 0, "kushy": 0, "kushy_extrap": 0, "leafly": 0,
        "ubiquity": 0, "genetics_prop": 0, "name_kw": 0,
        "cross_origin_leafly": 0, "cross_leafly_reports": 0,
        "badge_strains": 0,
    }
    badge_by_region = {r: 0 for r in REGIONS}

    for sid, name, stype, source, dq, effect_count, total_reports, genetics in strains:
        total_reports = total_reports or 0
        name_lower = name.lower().strip()
        genetics_lower = genetics.lower() if genetics else ""
        name_norm = re.sub(r"[^a-z0-9 ]", "", name_lower).strip()
        name_key = re.sub(r"[^a-z0-9]", "", name_lower)

        # ── Start at 0 — every point earned ───────────────────────────
        scores = {r: 0 for r in REGIONS}

        # Check name_key and any aliases for matches
        # Some strains have multiple DB entries (e.g., "GSC" + "Girl Scout Cookies")
        # The alias map ensures both find external data
        alias_keys = [name_key]
        # Also check if this strain's canonical form has aliases pointing to it
        for alias, canonical_norm in CATALOG_ALIASES.items():
            if canonical_norm == name_key:
                alias_keys.append(alias)

        # Track which signals fire for cross-validation
        has_origin = False
        has_leafly = any(k in leafly_set for k in alias_keys)
        has_kushy = any(k in kushy_map for k in alias_keys)
        kushy_regions = set()
        for k in alias_keys:
            kushy_regions.update(kushy_map.get(k, set()))

        # ── Layer 1: Known strain origins ─────────────────────────────
        origin = KNOWN_ORIGINS.get(name_norm) or KNOWN_ORIGINS.get(name_lower)
        if origin:
            has_origin = True
            stats["known_origin"] += 1
            scores[origin["home"]] += ORIGIN_HOME_BOOST
            for adj in origin.get("adjacent", []):
                scores[adj] += ORIGIN_ADJACENT_BOOST

        # ── Layer 2: Kushy dispensary location data ───────────────────
        # 2a: Direct boost for observed regions
        if has_kushy:
            stats["kushy"] += 1
            for region in kushy_regions:
                scores[region] += KUSHY_DIRECT_BOOST

            # 2b: Extrapolate to other legal markets based on report volume
            # Strains at CA dispensaries with national visibility are likely
            # stocked in other mature markets too
            for report_threshold in sorted(KUSHY_EXTRAPOLATION.keys(), reverse=True):
                if total_reports >= report_threshold:
                    stats["kushy_extrap"] += 1
                    extrap = KUSHY_EXTRAPOLATION[report_threshold]
                    for region, boost in extrap.items():
                        # Don't double-boost regions where we have direct data
                        if region not in kushy_regions:
                            scores[region] += boost
                    break

        # ── Layer 3: Leafly catalog presence ──────────────────────────
        if has_leafly:
            stats["leafly"] += 1
            for r in REGIONS:
                scores[r] += LEAFLY_CATALOG_BOOST

        # ── Layer 4: Cross-validation bonuses ─────────────────────────
        # Strains validated by multiple independent sources get a bonus
        if has_origin and has_leafly:
            stats["cross_origin_leafly"] += 1
            for r in REGIONS:
                scores[r] += CROSS_VALIDATION_ORIGIN_LEAFLY

        if has_leafly and total_reports >= 500:
            stats["cross_leafly_reports"] += 1
            for r in REGIONS:
                scores[r] += CROSS_VALIDATION_LEAFLY_REPORTS

        # ── Layer 5: Report-based ubiquity ────────────────────────────
        for threshold, boost in UBIQUITY_TIERS:
            if total_reports >= threshold:
                stats["ubiquity"] += 1
                for r in REGIONS:
                    scores[r] += boost
                break  # Only highest tier applies

        # ── Layer 6: Genetics lineage propagation ─────────────────────
        if genetics_lower:
            parent_regions = set()
            for fragment, region in GENETICS_LINEAGE.items():
                if fragment in genetics_lower:
                    parent_regions.add(region)

            if parent_regions:
                stats["genetics_prop"] += 1
                for region in parent_regions:
                    scores[region] += GENETICS_BOOST

        # ── Layer 7: Name/keyword signals ─────────────────────────────
        search_text = f"{name_lower} {genetics_lower}"
        matched_any = False
        kw_accum = {r: 0 for r in REGIONS}  # Accumulate before capping
        for pattern, boosts in REGIONAL_KEYWORDS:
            if re.search(pattern, search_text, re.IGNORECASE):
                matched_any = True
                for region, boost in boosts.items():
                    kw_accum[region] += boost
        if matched_any:
            stats["name_kw"] += 1
            for r in REGIONS:
                scores[r] += min(kw_accum[r], KEYWORD_CAP_PER_REGION)

        # ── Layer 8: Data quality multiplier ──────────────────────────
        quality_mult = QUALITY_MULTIPLIERS.get(dq, 1.0)

        for r in REGIONS:
            scores[r] = int(min(100, max(0, scores[r] * quality_mult)))

        # Track badge stats
        got_badge = False
        for r in REGIONS:
            if scores[r] >= 70:
                badge_by_region[r] += 1
                got_badge = True
        if got_badge:
            stats["badge_strains"] += 1

        # Insert rows
        for r in REGIONS:
            rows_to_insert.append((sid, r, scores[r], "heuristic", 0.7))

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

    # Score distribution
    score_dist = cur.execute("""
        SELECT
            CASE
                WHEN availability_score >= 70 THEN '70-100 (badge)'
                WHEN availability_score >= 50 THEN '50-69'
                WHEN availability_score >= 30 THEN '30-49'
                WHEN availability_score >= 10 THEN '10-29'
                ELSE '0-9'
            END as bracket,
            COUNT(DISTINCT strain_id)
        FROM strain_regions
        WHERE availability_score > 0
        GROUP BY bracket
        ORDER BY bracket DESC
    """).fetchall()

    zero_count = cur.execute("""
        SELECT COUNT(DISTINCT strain_id) FROM strain_regions
        WHERE strain_id NOT IN (
            SELECT DISTINCT strain_id FROM strain_regions WHERE availability_score > 0
        )
    """).fetchone()[0]

    print(f"\n  Layer signals applied:")
    print(f"    Known origins:       {stats['known_origin']} strains")
    print(f"    Kushy dispensary:    {stats['kushy']} strains (direct)")
    print(f"    Kushy extrapolated:  {stats['kushy_extrap']} strains (to other regions)")
    print(f"    Leafly catalog:      {stats['leafly']} strains")
    print(f"    Cross-val (O+L):     {stats['cross_origin_leafly']} strains (origin AND leafly)")
    print(f"    Cross-val (L+R):     {stats['cross_leafly_reports']} strains (leafly AND 500+ reports)")
    print(f"    Report ubiquity:     {stats['ubiquity']} strains")
    print(f"    Genetics lineage:    {stats['genetics_prop']} strains")
    print(f"    Name keywords:       {stats['name_kw']} strains")
    print(f"\n  Badge strains (>=70 in any region): {stats['badge_strains']}")
    print(f"  Badges by region:")
    for r in REGIONS:
        print(f"    {r}: {badge_by_region[r]} strains with badge")

    print(f"\n  Total rows: {total_rows:,}")
    print(f"\n  Regional score averages:")
    for region, avg, mn, mx in avg_scores:
        print(f"    {region}: avg={avg}, min={mn}, max={mx}")

    print(f"\n  Score distribution (unique strains with max score in bracket):")
    for bracket, cnt in score_dist:
        print(f"    {bracket}: {cnt} strains")
    print(f"    All zeros:  {zero_count} strains")

    # Sample: most regionally-distinct strains
    print(f"\n  Most regionally distinct strains:")
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
        "Wedding Cake", "Motor Breath", "Gelato", "Runtz",
        "Jack Herer", "White Widow", "Purple Punch",
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
    print("REGIONAL AVAILABILITY v3 GENERATED SUCCESSFULLY")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    generate()
