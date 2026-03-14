"""Shared helpers for strain ingestion and enrichment scripts.

Consolidates duplicated logic from import_kushy.py, import_leafly_open.py,
and enrich_partials.py into a single reusable module.
"""
import json
import random
import sqlite3


# ── Position-weighted report counts ────────────────────────────────────────

POSITIVE_BASE = 100
NEGATIVE_BASE = 35
MEDICAL_BASE = 70
DECAY_FACTORS = [1.0, 0.85, 0.70, 0.55, 0.40, 0.30, 0.20, 0.15, 0.10, 0.08]

# Terpene percentages by position (first listed = dominant)
TERPENE_PCT_BY_POSITION = [0.50, 0.30, 0.20, 0.10, 0.05, 0.03]


# ── Effect name → canonical name mapping ───────────────────────────────────

EFFECT_MAP = {
    # Positive
    "relaxed": "relaxed", "relaxing": "relaxed",
    "happy": "happy",
    "euphoric": "euphoric",
    "creative": "creative",
    "energetic": "energetic",
    "uplifted": "uplifted", "uplifting": "uplifted",
    "focused": "focused",
    "hungry": "hungry",
    "talkative": "talkative",
    "tingly": "tingly",
    "aroused": "aroused",
    "sleepy": "sleepy",
    "giggly": "giggly",
    "calm": "calm", "calming": "calm",
    "motivated": "motivated",
    "sedating": "sleepy",
    "cerebral": "head-high",
    "body high": "body-high",
    "mellow": "relaxed",
    # Negative
    "dry mouth": "dry-mouth",
    "dry eyes": "dry-eyes",
    "dizzy": "dizzy",
    "paranoid": "paranoid",
    "anxious": "anxious",
    "headache": "headache",
}

AILMENT_MAP = {
    "stress": "stress",
    "depression": "depression",
    "pain": "pain",
    "insomnia": "insomnia",
    "anxiety": "anxiety",
    "lack of appetite": "appetite-loss",
    "nausea": "nausea-relief",
    "headaches": "migraines",
    "headache": "migraines",
    "muscle spasms": "muscle-spasms",
    "inflammation": "inflammation",
    "cramps": "muscle-spasms",
    "eye pressure": "eye-pressure",
    "seizures": "seizures",
    "fatigue": "fatigue-medical",
    "spasticity": "muscle-spasms",
    "ptsd": "ptsd",
    "gastrointestinal disorder": "gastrointestinal",
}

TERPENE_NAME_MAP = {
    "myrcene": "myrcene",
    "limonene": "limonene",
    "caryophyllene": "caryophyllene",
    "beta-caryophyllene": "caryophyllene",
    "b-caryophyllene": "caryophyllene",
    "beta caryophyllene": "caryophyllene",
    "linalool": "linalool",
    "pinene": "pinene",
    "alpha-pinene": "pinene",
    "a-pinene": "pinene",
    "alpha pinene": "pinene",
    "beta-pinene": "pinene",
    "humulene": "humulene",
    "alpha-humulene": "humulene",
    "a-humulene": "humulene",
    "ocimene": "ocimene",
    "terpinolene": "terpinolene",
    "terpineol": "terpineol",
    "alpha-terpineol": "terpineol",
    "valencene": "valencene",
    "bisabolol": "bisabolol",
    "alpha-bisabolol": "bisabolol",
    "a-bisabolol": "bisabolol",
    "camphene": "camphene",
    "geraniol": "geraniol",
    "nerolidol": "nerolidol",
    "trans-nerolidol": "nerolidol",
    "eucalyptol": "eucalyptol",
    "borneol": "borneol",
    "phytol": "phytol",
    "carene": "carene",
    "delta-3-carene": "carene",
    "sabinene": "sabinene",
    "phellandrene": "phellandrene",
    "guaiol": "guaiol",
    "cymene": "cymene",
    "p-cymene": "cymene",
    "isopulegol": "isopulegol",
    "pulegone": "pulegone",
    "fenchol": "fenchol",
    "farnesene": "farnesene",
}

# Default terpenes by strain type (when no terpenes listed)
DEFAULT_TERPENES = {
    "indica": [("myrcene", 0.40), ("linalool", 0.20), ("caryophyllene", 0.15)],
    "sativa": [("limonene", 0.35), ("pinene", 0.25), ("terpinolene", 0.15)],
    "hybrid": [("caryophyllene", 0.30), ("myrcene", 0.20), ("limonene", 0.15)],
}

# Default THC/CBD by type
DEFAULT_CANNABINOIDS = {
    "indica": {"thc": 18.0, "cbd": 0.5},
    "sativa": {"thc": 17.0, "cbd": 0.3},
    "hybrid": {"thc": 17.5, "cbd": 0.4},
}

# ── Metadata inference rules ──────────────────────────────────────────────

CONSUMPTION_BY_TYPE = {
    "indica": {"flower": 9, "vape": 8, "edibles": 8, "concentrates": 5, "tinctures": 7, "topicals": 6},
    "sativa": {"flower": 9, "vape": 9, "edibles": 7, "concentrates": 6, "tinctures": 7, "topicals": 5},
    "hybrid": {"flower": 9, "vape": 8, "edibles": 8, "concentrates": 5, "tinctures": 7, "topicals": 6},
}

BEST_FOR_RULES = {
    "relaxed": "Evening relaxation",
    "sleepy": "Nighttime use",
    "creative": "Creative projects",
    "energetic": "Daytime activities",
    "focused": "Work and study",
    "happy": "Social gatherings",
    "euphoric": "Mood elevation",
    "hungry": "Appetite stimulation",
    "calm": "Stress relief",
    "uplifted": "Elevating mood",
}

NOT_IDEAL_RULES = {
    "sleepy": "Daytime productivity",
    "energetic": "Bedtime use",
    "paranoid": "Anxiety-prone users",
    "anxious": "High-stress situations",
    "dizzy": "Physical activities",
    "hungry": "Appetite control",
}


# ── Helper functions ──────────────────────────────────────────────────────

def weighted_report_count(base: int, position: int, jitter: float = 0.10) -> int:
    """Generate a realistic report count based on effect position."""
    factor = DECAY_FACTORS[min(position, len(DECAY_FACTORS) - 1)]
    count = int(base * factor)
    jitter_amount = max(1, int(count * jitter))
    count += random.randint(-jitter_amount, jitter_amount)
    return max(3, count)


def parse_comma_list(value: str) -> list[str]:
    """Parse a comma-separated string, stripping whitespace and empties."""
    if not value or not value.strip():
        return []
    return [item.strip() for item in value.split(",") if item.strip()]


def parse_float(value: str) -> float | None:
    """Safely parse a float, returning None on failure."""
    if not value or not str(value).strip():
        return None
    try:
        val = float(str(value).strip().replace("%", ""))
        return val if val > 0 else None
    except (ValueError, TypeError):
        return None


def get_or_create_effect(conn: sqlite3.Connection, name: str, category: str) -> int:
    """Get or create an effect by name, return its ID."""
    row = conn.execute("SELECT id FROM effects WHERE name = ?", (name,)).fetchone()
    if row:
        return row[0]
    cursor = conn.execute(
        "INSERT OR IGNORE INTO effects (name, category) VALUES (?, ?)",
        (name, category),
    )
    if cursor.lastrowid:
        return cursor.lastrowid
    return conn.execute("SELECT id FROM effects WHERE name = ?", (name,)).fetchone()[0]


def get_molecule_id(conn: sqlite3.Connection, name: str) -> int | None:
    """Look up a molecule ID by name."""
    row = conn.execute("SELECT id FROM molecules WHERE name = ?", (name,)).fetchone()
    return row[0] if row else None


def infer_best_for(effects: list[str]) -> list[str]:
    """Infer best_for from effects."""
    result = []
    for eff in effects[:5]:
        label = BEST_FOR_RULES.get(eff)
        if label and label not in result:
            result.append(label)
    return result[:3]


def infer_not_ideal(effects: list[str], negative_effects: list[str]) -> list[str]:
    """Infer not_ideal_for from effects."""
    result = []
    for eff in effects + negative_effects:
        label = NOT_IDEAL_RULES.get(eff)
        if label and label not in result:
            result.append(label)
    return result[:3]


def map_effect_name(raw_name: str) -> tuple[str, str] | None:
    """Map a raw effect name to (canonical_name, category).

    Returns None if the name doesn't match any known mapping.
    """
    lower = raw_name.lower().strip()
    if lower in EFFECT_MAP:
        canonical = EFFECT_MAP[lower]
        # Determine category from the canonical name
        if canonical in ("dry-mouth", "dry-eyes", "dizzy", "paranoid", "anxious", "headache"):
            return canonical, "negative"
        return canonical, "positive"
    if lower in AILMENT_MAP:
        return AILMENT_MAP[lower], "medical"
    return None


def map_terpene_name(raw_name: str) -> str | None:
    """Map a raw terpene name to canonical name."""
    return TERPENE_NAME_MAP.get(raw_name.lower().strip())


def insert_strain_effects(
    conn: sqlite3.Connection,
    strain_id: int,
    effects: list[dict],
    source: str,
):
    """Insert effect reports for a strain.

    effects: list of {"name": str, "category": str} dicts.
    """
    for idx, eff in enumerate(effects):
        name = eff.get("name", "")
        category = eff.get("category", "positive")
        if not name:
            continue
        eff_id = get_or_create_effect(conn, name, category)
        base = POSITIVE_BASE if category == "positive" else (MEDICAL_BASE if category == "medical" else NEGATIVE_BASE)
        rc = weighted_report_count(base, idx)
        conn.execute(
            "INSERT OR IGNORE INTO effect_reports (strain_id, effect_id, report_count, confidence, source) "
            "VALUES (?, ?, ?, 1.0, ?)",
            (strain_id, eff_id, rc, source),
        )


def insert_strain_terpenes(
    conn: sqlite3.Connection,
    strain_id: int,
    terpenes: list[dict],
    source: str,
    measurement_type: str = "reported",
):
    """Insert terpene compositions for a strain.

    terpenes: list of {"name": str, "pct": float} dicts.
    """
    for terp in terpenes:
        name = terp.get("name", "")
        pct = terp.get("pct", 0.0)
        if not name or pct <= 0:
            continue
        mol_id = get_molecule_id(conn, name)
        if mol_id:
            conn.execute(
                "INSERT OR IGNORE INTO strain_compositions "
                "(strain_id, molecule_id, percentage, measurement_type, source) "
                "VALUES (?, ?, ?, ?, ?)",
                (strain_id, mol_id, pct, measurement_type, source),
            )


def insert_strain_cannabinoids(
    conn: sqlite3.Connection,
    strain_id: int,
    cannabinoids: dict[str, float],
    source: str,
    measurement_type: str = "reported",
):
    """Insert cannabinoid compositions for a strain.

    cannabinoids: dict of {"thc": float, "cbd": float, ...}.
    """
    for name, value in cannabinoids.items():
        if value is None or value <= 0:
            continue
        mol_id = get_molecule_id(conn, name)
        if mol_id:
            conn.execute(
                "INSERT OR IGNORE INTO strain_compositions "
                "(strain_id, molecule_id, percentage, measurement_type, source) "
                "VALUES (?, ?, ?, ?, ?)",
                (strain_id, mol_id, value, measurement_type, source),
            )


def insert_strain_metadata(
    conn: sqlite3.Connection,
    strain_id: int,
    name: str,
    strain_type: str,
    effects: list[dict],
    genetics: str = "",
    lineage: dict | None = None,
    description: str = "",
):
    """Insert or update strain metadata."""
    effect_names = [e["name"] for e in effects if e.get("category") == "positive"]
    negative_names = [e["name"] for e in effects if e.get("category") == "negative"]
    best_for = infer_best_for(effect_names)
    not_ideal = infer_not_ideal(effect_names, negative_names)
    consumption = CONSUMPTION_BY_TYPE.get(strain_type, CONSUMPTION_BY_TYPE["hybrid"])

    if lineage is None:
        lineage = {"self": name}

    conn.execute(
        "INSERT OR IGNORE INTO strain_metadata "
        "(strain_id, consumption_suitability, price_range, best_for, "
        "not_ideal_for, genetics, lineage, description_extended) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (
            strain_id,
            json.dumps(consumption),
            "mid",
            json.dumps(best_for),
            json.dumps(not_ideal),
            genetics,
            json.dumps(lineage),
            description[:200] if description else "",
        ),
    )


def insert_strain_flavors(
    conn: sqlite3.Connection,
    strain_id: int,
    flavors: list[str],
):
    """Insert flavor associations for a strain."""
    for flavor in flavors:
        flavor_clean = flavor.strip().lower()
        if flavor_clean:
            conn.execute(
                "INSERT OR IGNORE INTO strain_flavors (strain_id, flavor) VALUES (?, ?)",
                (strain_id, flavor_clean),
            )
