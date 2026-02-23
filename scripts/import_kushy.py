"""Import ~1,500 strains from the Kushy Cannabis Dataset (MIT license).

Downloads the CSV from GitHub, parses 31 columns (name, type, effects,
ailments, flavors, terpenes, THC/CBD/CBN/CBG/CBC/THCV), and inserts into
the Cannalchemy SQLite database.

Effect reports use position-weighted counts (same convention as
migrate_sf_strains.py) — effects listed first are reported more often.

Deduplicates against existing strains via rapidfuzz (threshold 85).
Maps Kushy effect/ailment names to our 51 canonical effects via synonym map.
Estimates terpene percentages by position when only names are given.
Infers metadata (consumption_suitability, best_for, not_ideal_for) from
strain type + effects.

Usage:
    python scripts/import_kushy.py [db_path]
"""
import csv
import io
import json
import os
import random
import sqlite3
import sys
import urllib.request
from pathlib import Path

# Add project root to path
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from cannalchemy.data.normalize import normalize_strain_name, match_strain_names
from cannalchemy.data.schema import init_db

# ── Constants ────────────────────────────────────────────────────────────────

KUSHY_CSV_URL = (
    "https://raw.githubusercontent.com/kushyapp/cannabis-dataset/master/"
    "Dataset/Strains/strains-kushy_api.2017-11-14.csv"
)
RAW_DIR = ROOT / "data" / "raw"
LOCAL_CSV = RAW_DIR / "kushy_strains.csv"
SOURCE_NAME = "kushy"

# Position-weighted report counts (same as migrate_sf_strains.py)
POSITIVE_BASE = 100
NEGATIVE_BASE = 35
MEDICAL_BASE = 70
DECAY_FACTORS = [1.0, 0.85, 0.70, 0.55, 0.40, 0.30, 0.20, 0.15, 0.10, 0.08]

# Terpene percentages by position (first listed = dominant)
TERPENE_PCT_BY_POSITION = [0.50, 0.30, 0.20, 0.10, 0.05, 0.03]

# ── Effect name → canonical name mapping ────────────────────────────────────
# Kushy uses simple names like "Relaxed", "Happy", "Uplifted".
# Map them to our 51 canonical effects from taxonomy.py.
EFFECT_MAP = {
    # Positive effects (Kushy "effects" column)
    "relaxed": "relaxed",
    "happy": "happy",
    "euphoric": "euphoric",
    "creative": "creative",
    "energetic": "energetic",
    "uplifted": "uplifted",
    "focused": "focused",
    "hungry": "hungry",
    "talkative": "talkative",
    "tingly": "tingly",
    "aroused": "aroused",
    "sleepy": "sleepy",
    "giggly": "giggly",
    # Negative effects
    "dry mouth": "dry-mouth",
    "dry eyes": "dry-eyes",
    "dizzy": "dizzy",
    "paranoid": "paranoid",
    "anxious": "anxious",
    "headache": "headache",
}

# Kushy "ailment" column → medical canonical effects
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

# Known terpene name mappings
TERPENE_NAME_MAP = {
    "myrcene": "myrcene",
    "limonene": "limonene",
    "caryophyllene": "caryophyllene",
    "beta-caryophyllene": "caryophyllene",
    "b-caryophyllene": "caryophyllene",
    "linalool": "linalool",
    "pinene": "pinene",
    "alpha-pinene": "pinene",
    "a-pinene": "pinene",
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

# ── Metadata inference ──────────────────────────────────────────────────────

CONSUMPTION_BY_TYPE = {
    "indica": {"smoking": 9, "vaping": 8, "edibles": 8, "tinctures": 7, "topicals": 6},
    "sativa": {"smoking": 9, "vaping": 9, "edibles": 7, "tinctures": 7, "topicals": 5},
    "hybrid": {"smoking": 9, "vaping": 8, "edibles": 8, "tinctures": 7, "topicals": 6},
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
}

NOT_IDEAL_RULES = {
    "sleepy": "Daytime productivity",
    "energetic": "Bedtime use",
    "paranoid": "Anxiety-prone users",
    "anxious": "High-stress situations",
    "dizzy": "Physical activities",
}


# ── Helper functions ────────────────────────────────────────────────────────

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
    if not value or not value.strip():
        return None
    try:
        val = float(value.strip().replace("%", ""))
        return val if val > 0 else None
    except (ValueError, TypeError):
        return None


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


def download_csv():
    """Download Kushy CSV if not already cached locally."""
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    if LOCAL_CSV.exists() and LOCAL_CSV.stat().st_size > 10_000:
        print(f"  Using cached CSV: {LOCAL_CSV} ({LOCAL_CSV.stat().st_size:,} bytes)")
        return

    print(f"  Downloading from {KUSHY_CSV_URL}...")
    # Use curl (reliable on macOS) as primary, urllib as fallback
    import subprocess
    result = subprocess.run(
        ["curl", "-sL", "-o", str(LOCAL_CSV), KUSHY_CSV_URL],
        capture_output=True, text=True,
    )
    if result.returncode != 0 or not LOCAL_CSV.exists() or LOCAL_CSV.stat().st_size < 1000:
        # Fallback: urllib with SSL context bypass for macOS
        import ssl
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        urllib.request.urlretrieve(KUSHY_CSV_URL, str(LOCAL_CSV), context=ctx)
    print(f"  Saved {LOCAL_CSV.stat().st_size:,} bytes to {LOCAL_CSV}")


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


# ── Main import ─────────────────────────────────────────────────────────────

def import_kushy(db_path: str | None = None):
    """Download and import Kushy strains into the database."""
    if db_path is None:
        db_path = str(ROOT / "data" / "processed" / "cannalchemy.db")

    print("=" * 60)
    print("KUSHY DATASET IMPORT")
    print("=" * 60)

    # 1. Download CSV
    print("\n[1/5] Downloading CSV...")
    download_csv()

    # 2. Open database
    print("\n[2/5] Opening database...")
    conn = init_db(db_path)

    # Register data source
    conn.execute(
        "INSERT OR IGNORE INTO data_sources (name, source_type, url, notes) "
        "VALUES (?, ?, ?, ?)",
        (
            SOURCE_NAME,
            "csv",
            KUSHY_CSV_URL,
            "Kushy Cannabis Dataset (MIT license), ~1,500 strains",
        ),
    )
    conn.commit()

    # Get existing strains for dedup
    existing = conn.execute(
        "SELECT id, normalized_name, name FROM strains"
    ).fetchall()
    name_to_id = {row[1]: row[0] for row in existing}
    known_names = list(name_to_id.keys())
    print(f"  Database has {len(known_names)} existing strains")

    # 3. Parse CSV
    print("\n[3/5] Parsing CSV...")
    with open(LOCAL_CSV, encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    print(f"  Found {len(rows)} rows in CSV")

    # 4. Import strains
    print("\n[4/5] Importing strains...")
    stats = {
        "skipped_noname": 0,
        "skipped_dup": 0,
        "created": 0,
        "effects": 0,
        "ailments": 0,
        "terpenes": 0,
        "cannabinoids": 0,
        "flavors": 0,
        "metadata": 0,
    }

    for i, row in enumerate(rows):
        name = (row.get("name") or "").strip()
        if not name:
            stats["skipped_noname"] += 1
            continue

        normalized = normalize_strain_name(name)
        if not normalized:
            stats["skipped_noname"] += 1
            continue

        # Deduplicate: exact match
        if normalized in name_to_id:
            stats["skipped_dup"] += 1
            continue

        # Deduplicate: fuzzy match
        if known_names:
            matches = match_strain_names(normalized, known_names, limit=1, score_cutoff=85.0)
            if matches:
                stats["skipped_dup"] += 1
                continue

        # Determine strain type
        raw_type = (row.get("type") or "").strip().lower()
        if raw_type in ("indica", "sativa", "hybrid"):
            strain_type = raw_type
        elif "indica" in raw_type:
            strain_type = "indica"
        elif "sativa" in raw_type:
            strain_type = "sativa"
        else:
            strain_type = "hybrid"

        description = (row.get("description") or "").strip()[:500]

        # Insert strain
        cursor = conn.execute(
            "INSERT OR IGNORE INTO strains (name, normalized_name, strain_type, description, source) "
            "VALUES (?, ?, ?, ?, ?)",
            (name, normalized, strain_type, description, SOURCE_NAME),
        )
        if not cursor.lastrowid:
            stats["skipped_dup"] += 1
            continue

        strain_id = cursor.lastrowid
        name_to_id[normalized] = strain_id
        known_names.append(normalized)
        stats["created"] += 1

        # ── Effects ──────────────────────────────────────────────────────
        effects_raw = parse_comma_list(row.get("effects", ""))
        mapped_effects = []
        for eff_name in effects_raw:
            canonical = EFFECT_MAP.get(eff_name.lower())
            if canonical:
                mapped_effects.append(canonical)

        for idx, effect_name in enumerate(mapped_effects):
            eff_id = get_or_create_effect(conn, effect_name, "positive")
            rc = weighted_report_count(POSITIVE_BASE, idx)
            conn.execute(
                "INSERT OR IGNORE INTO effect_reports (strain_id, effect_id, report_count, confidence, source) "
                "VALUES (?, ?, ?, 1.0, ?)",
                (strain_id, eff_id, rc, SOURCE_NAME),
            )
            stats["effects"] += 1

        # ── Ailments → Medical effects ───────────────────────────────────
        ailments_raw = parse_comma_list(row.get("ailment", ""))
        mapped_ailments = []
        for ailment in ailments_raw:
            canonical = AILMENT_MAP.get(ailment.lower())
            if canonical:
                mapped_ailments.append(canonical)

        for idx, effect_name in enumerate(mapped_ailments):
            eff_id = get_or_create_effect(conn, effect_name, "medical")
            rc = weighted_report_count(MEDICAL_BASE, idx)
            conn.execute(
                "INSERT OR IGNORE INTO effect_reports (strain_id, effect_id, report_count, confidence, source) "
                "VALUES (?, ?, ?, 0.9, ?)",
                (strain_id, eff_id, rc, SOURCE_NAME),
            )
            stats["ailments"] += 1

        # ── Terpenes ─────────────────────────────────────────────────────
        terpenes_raw = parse_comma_list(row.get("terpenes", ""))
        terpene_entries = []

        for idx, terp in enumerate(terpenes_raw):
            canonical_terp = TERPENE_NAME_MAP.get(terp.lower().strip())
            if canonical_terp:
                pct = TERPENE_PCT_BY_POSITION[min(idx, len(TERPENE_PCT_BY_POSITION) - 1)]
                terpene_entries.append((canonical_terp, pct))

        # If no terpenes in CSV, use type-based defaults
        if not terpene_entries:
            terpene_entries = DEFAULT_TERPENES.get(strain_type, DEFAULT_TERPENES["hybrid"])

        for terp_name, pct in terpene_entries:
            mol_id = get_molecule_id(conn, terp_name)
            if mol_id:
                conn.execute(
                    "INSERT OR IGNORE INTO strain_compositions "
                    "(strain_id, molecule_id, percentage, measurement_type, source) "
                    "VALUES (?, ?, ?, 'estimated', ?)",
                    (strain_id, mol_id, pct, SOURCE_NAME),
                )
                stats["terpenes"] += 1

        # ── Cannabinoids ─────────────────────────────────────────────────
        cannabinoid_columns = {
            "thc": row.get("thc"),
            "cbd": row.get("cbd"),
            "cbn": row.get("cbn"),
            "cbg": row.get("cbg"),
            "thcv": row.get("thcv"),
            "cbc": row.get("cbc"),
        }

        has_cannabinoid = False
        for cname, cval_str in cannabinoid_columns.items():
            cval = parse_float(cval_str)
            if cval is not None:
                mol_id = get_molecule_id(conn, cname)
                if mol_id:
                    conn.execute(
                        "INSERT OR IGNORE INTO strain_compositions "
                        "(strain_id, molecule_id, percentage, measurement_type, source) "
                        "VALUES (?, ?, ?, 'reported', ?)",
                        (strain_id, mol_id, cval, SOURCE_NAME),
                    )
                    stats["cannabinoids"] += 1
                    has_cannabinoid = True

        # Default cannabinoids if none in CSV
        if not has_cannabinoid:
            defaults = DEFAULT_CANNABINOIDS.get(strain_type, DEFAULT_CANNABINOIDS["hybrid"])
            for cname, cval in defaults.items():
                mol_id = get_molecule_id(conn, cname)
                if mol_id:
                    conn.execute(
                        "INSERT OR IGNORE INTO strain_compositions "
                        "(strain_id, molecule_id, percentage, measurement_type, source) "
                        "VALUES (?, ?, ?, 'estimated', ?)",
                        (strain_id, mol_id, cval, SOURCE_NAME),
                    )
                    stats["cannabinoids"] += 1

        # ── Flavors ──────────────────────────────────────────────────────
        flavors_raw = parse_comma_list(row.get("flavor", ""))
        for flavor in flavors_raw:
            flavor_clean = flavor.strip().lower()
            if flavor_clean:
                conn.execute(
                    "INSERT OR IGNORE INTO strain_flavors (strain_id, flavor) VALUES (?, ?)",
                    (strain_id, flavor_clean),
                )
                stats["flavors"] += 1

        # ── Metadata ─────────────────────────────────────────────────────
        best_for = infer_best_for(mapped_effects)
        not_ideal = infer_not_ideal(mapped_effects, [])
        consumption = CONSUMPTION_BY_TYPE.get(strain_type, CONSUMPTION_BY_TYPE["hybrid"])

        crosses = (row.get("crosses") or "").strip()
        lineage = {"self": name}
        if crosses:
            parents = [p.strip() for p in crosses.split("x") if p.strip()]
            if len(parents) == 2:
                lineage["parent1"] = parents[0]
                lineage["parent2"] = parents[1]

        conn.execute(
            "INSERT OR REPLACE INTO strain_metadata "
            "(strain_id, consumption_suitability, price_range, best_for, "
            "not_ideal_for, genetics, lineage, description_extended) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (
                strain_id,
                json.dumps(consumption),
                "mid",
                json.dumps(best_for),
                json.dumps(not_ideal),
                crosses,
                json.dumps(lineage),
                description[:200] if description else "",
            ),
        )
        stats["metadata"] += 1

        # Progress indicator every 200 strains
        if stats["created"] % 200 == 0:
            print(f"    ... {stats['created']} strains imported")

    # 5. Commit and report
    conn.commit()

    # Update data source record count
    conn.execute(
        "UPDATE data_sources SET record_count = ?, last_updated = CURRENT_TIMESTAMP "
        "WHERE name = ?",
        (stats["created"], SOURCE_NAME),
    )
    conn.commit()
    conn.close()

    print("\n[5/5] Import complete!")
    print("=" * 60)
    print(f"  Strains created:     {stats['created']}")
    print(f"  Skipped (no name):   {stats['skipped_noname']}")
    print(f"  Skipped (duplicate): {stats['skipped_dup']}")
    print(f"  Effect reports:      {stats['effects']}")
    print(f"  Ailment reports:     {stats['ailments']}")
    print(f"  Terpene entries:     {stats['terpenes']}")
    print(f"  Cannabinoid entries: {stats['cannabinoids']}")
    print(f"  Flavor entries:      {stats['flavors']}")
    print(f"  Metadata records:    {stats['metadata']}")
    print("=" * 60)

    total_strains = len(name_to_id)
    print(f"\n  Total strains in database: {total_strains}")


if __name__ == "__main__":
    db_path = sys.argv[1] if len(sys.argv) > 1 else None
    import_kushy(db_path)
