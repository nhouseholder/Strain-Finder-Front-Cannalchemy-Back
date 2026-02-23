"""Gap-fill import from the Cannabis Intelligence dataset (MIT license).

ONLY imports strains NOT already in the database. Uses lower confidence
scores (0.7) since this dataset is AI-enhanced. Runs AFTER import_kushy.py.

Downloads from GitHub: ~15,768 strains. After dedup against existing
database, typically adds 200-500 additional unique strains.

Usage:
    python scripts/import_cannabis_intel.py [db_path]
"""
import csv
import io
import json
import os
import random
import sqlite3
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from cannalchemy.data.normalize import normalize_strain_name, match_strain_names
from cannalchemy.data.schema import init_db

# ── Constants ────────────────────────────────────────────────────────────────

# The Cannabis Intelligence dataset (Damian Barish, MIT license)
CI_CSV_URL = (
    "https://raw.githubusercontent.com/Shannon-Goddard/cannabis-intelligence-database/"
    "main/data/Cannabis_Intelligence_Database_15768_Strains_Final.csv"
)
RAW_DIR = ROOT / "data" / "raw"
LOCAL_CSV = RAW_DIR / "cannabis_intel_strains.csv"
SOURCE_NAME = "cannabis-intel"

# Lower confidence since this is AI-enhanced data
CONFIDENCE = 0.7

# Position-weighted report counts (lower base than Kushy)
POSITIVE_BASE = 80
NEGATIVE_BASE = 30
MEDICAL_BASE = 55
DECAY_FACTORS = [1.0, 0.85, 0.70, 0.55, 0.40, 0.30, 0.20, 0.15, 0.10, 0.08]

# Terpene percentages by position
TERPENE_PCT_BY_POSITION = [0.45, 0.25, 0.15, 0.08, 0.04]

# Effect mapping (Cannabis Intelligence uses similar names to Kushy)
EFFECT_MAP = {
    "relaxed": "relaxed", "relaxing": "relaxed", "happy": "happy",
    "euphoric": "euphoric", "creative": "creative", "energetic": "energetic",
    "uplifted": "uplifted", "uplifting": "uplifted",
    "focused": "focused", "hungry": "hungry", "talkative": "talkative",
    "tingly": "tingly", "aroused": "aroused", "sleepy": "sleepy",
    "giggly": "giggly", "calm": "calm", "calming": "calm",
    "motivated": "motivated", "sedating": "sleepy", "cerebral": "head-high",
    "body high": "body-high", "mellow": "relaxed",
    # Negatives
    "dry mouth": "dry-mouth", "dry eyes": "dry-eyes", "dizzy": "dizzy",
    "paranoid": "paranoid", "anxious": "anxious", "headache": "headache",
}

AILMENT_MAP = {
    "stress": "stress", "depression": "depression", "pain": "pain",
    "insomnia": "insomnia", "anxiety": "anxiety",
    "lack of appetite": "appetite-loss", "nausea": "nausea-relief",
    "headaches": "migraines", "muscle spasms": "muscle-spasms",
    "inflammation": "inflammation", "seizures": "seizures",
    "fatigue": "fatigue-medical", "ptsd": "ptsd",
    "eye pressure": "eye-pressure", "cramps": "muscle-spasms",
    "gastrointestinal disorder": "gastrointestinal",
}

TERPENE_NAME_MAP = {
    "myrcene": "myrcene", "limonene": "limonene",
    "caryophyllene": "caryophyllene", "beta-caryophyllene": "caryophyllene",
    "linalool": "linalool", "pinene": "pinene", "alpha-pinene": "pinene",
    "humulene": "humulene", "ocimene": "ocimene",
    "terpinolene": "terpinolene", "bisabolol": "bisabolol",
    "valencene": "valencene", "camphene": "camphene", "geraniol": "geraniol",
    "nerolidol": "nerolidol", "eucalyptol": "eucalyptol",
    "carene": "carene", "sabinene": "sabinene", "borneol": "borneol",
    "phellandrene": "phellandrene", "guaiol": "guaiol", "fenchol": "fenchol",
}

DEFAULT_TERPENES = {
    "indica": [("myrcene", 0.35), ("linalool", 0.18), ("caryophyllene", 0.12)],
    "sativa": [("limonene", 0.30), ("pinene", 0.20), ("terpinolene", 0.12)],
    "hybrid": [("caryophyllene", 0.25), ("myrcene", 0.18), ("limonene", 0.12)],
}

DEFAULT_CANNABINOIDS = {
    "indica": {"thc": 18.0, "cbd": 0.5},
    "sativa": {"thc": 17.0, "cbd": 0.3},
    "hybrid": {"thc": 17.5, "cbd": 0.4},
}

CONSUMPTION_BY_TYPE = {
    "indica": {"smoking": 9, "vaping": 8, "edibles": 8, "tinctures": 7, "topicals": 6},
    "sativa": {"smoking": 9, "vaping": 9, "edibles": 7, "tinctures": 7, "topicals": 5},
    "hybrid": {"smoking": 9, "vaping": 8, "edibles": 8, "tinctures": 7, "topicals": 6},
}

BEST_FOR_RULES = {
    "relaxed": "Evening relaxation", "sleepy": "Nighttime use",
    "creative": "Creative projects", "energetic": "Daytime activities",
    "focused": "Work and study", "happy": "Social gatherings",
}

NOT_IDEAL_RULES = {
    "sleepy": "Daytime productivity", "energetic": "Bedtime use",
    "paranoid": "Anxiety-prone users", "anxious": "High-stress situations",
}


def weighted_report_count(base, position, jitter=0.10):
    factor = DECAY_FACTORS[min(position, len(DECAY_FACTORS) - 1)]
    count = int(base * factor)
    jitter_amount = max(1, int(count * jitter))
    count += random.randint(-jitter_amount, jitter_amount)
    return max(3, count)


def parse_comma_list(value):
    if not value or not value.strip():
        return []
    return [item.strip() for item in value.split(",") if item.strip()]


def parse_python_list(value):
    """Parse a Python-style list string like \"['euphoric', 'creative']\"."""
    if not value or not value.strip():
        return []
    value = value.strip()
    # Try JSON-ish parse (replace single quotes with double)
    if value.startswith("["):
        try:
            import ast
            return [str(item).strip() for item in ast.literal_eval(value) if item]
        except (ValueError, SyntaxError):
            pass
        # Fallback: strip brackets, split on commas, clean quotes
        inner = value.strip("[]")
        return [item.strip().strip("'\"") for item in inner.split(",") if item.strip().strip("'\"")]
    # Not a list format — try comma split
    return parse_comma_list(value)


def parse_float(value):
    if not value or not value.strip():
        return None
    try:
        val = float(value.strip().replace("%", ""))
        return val if val > 0 else None
    except (ValueError, TypeError):
        return None


def download_csv():
    """Download Cannabis Intelligence CSV if not cached."""
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    if LOCAL_CSV.exists() and LOCAL_CSV.stat().st_size > 10_000:
        print(f"  Using cached CSV: {LOCAL_CSV} ({LOCAL_CSV.stat().st_size:,} bytes)")
        return

    print(f"  Downloading from {CI_CSV_URL}...")
    result = subprocess.run(
        ["curl", "-sL", "-o", str(LOCAL_CSV), CI_CSV_URL],
        capture_output=True, text=True,
    )
    if result.returncode != 0 or not LOCAL_CSV.exists() or LOCAL_CSV.stat().st_size < 1000:
        import ssl
        import urllib.request
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        urllib.request.urlretrieve(CI_CSV_URL, str(LOCAL_CSV))
    print(f"  Saved {LOCAL_CSV.stat().st_size:,} bytes to {LOCAL_CSV}")


def get_or_create_effect(conn, name, category):
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


def get_molecule_id(conn, name):
    row = conn.execute("SELECT id FROM molecules WHERE name = ?", (name,)).fetchone()
    return row[0] if row else None


def import_cannabis_intel(db_path=None):
    """Download and import Cannabis Intelligence strains (gap-fill only)."""
    if db_path is None:
        db_path = str(ROOT / "data" / "processed" / "cannalchemy.db")

    print("=" * 60)
    print("CANNABIS INTELLIGENCE GAP-FILL IMPORT")
    print("=" * 60)

    # 1. Download
    print("\n[1/5] Downloading CSV...")
    download_csv()

    # 2. Open database
    print("\n[2/5] Opening database...")
    conn = init_db(db_path)

    conn.execute(
        "INSERT OR IGNORE INTO data_sources (name, source_type, url, notes) "
        "VALUES (?, ?, ?, ?)",
        (SOURCE_NAME, "csv", CI_CSV_URL,
         "Cannabis Intelligence Database (MIT), AI-enhanced, gap-fill only"),
    )
    conn.commit()

    existing = conn.execute("SELECT id, normalized_name FROM strains").fetchall()
    name_to_id = {row[1]: row[0] for row in existing}
    known_names = list(name_to_id.keys())
    print(f"  Database has {len(known_names)} existing strains")

    # 3. Parse CSV — detect columns dynamically
    print("\n[3/5] Parsing CSV...")
    with open(LOCAL_CSV, encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)
        columns = reader.fieldnames or []
        rows = list(reader)
    print(f"  Found {len(rows)} rows, columns: {columns[:10]}...")

    # Detect column names (different datasets use different headers)
    name_col = next((c for c in columns if c.lower() in ("name", "strain", "strain_name")), None)
    type_col = next((c for c in columns if c.lower() in ("type", "strain_type", "category")), None)
    effects_col = next((c for c in columns if c.lower() in ("effects", "positive_effects")), None)
    neg_col = next((c for c in columns if c.lower() in ("negative", "negatives", "negative_effects")), None)
    medical_col = next((c for c in columns if c.lower() in ("medical", "ailment", "ailments", "medical_effects")), None)
    flavor_col = next((c for c in columns if c.lower() in ("flavor", "flavors")), None)
    desc_col = next((c for c in columns if c.lower() in ("description", "desc", "about_info")), None)
    thc_col = next((c for c in columns if c.lower() in ("thc", "thc_content", "thc_max")), None)
    cbd_col = next((c for c in columns if c.lower() in ("cbd", "cbd_content", "cbd_max")), None)
    terpene_col = next((c for c in columns if c.lower() in ("terpenes", "terpene")), None)
    parent_col = next((c for c in columns if c.lower() in ("parents", "crosses", "lineage", "genetics")), None)
    # Cannabis Intelligence specific columns
    sativa_pct_col = next((c for c in columns if c.lower() == "sativa_percentage"), None)
    indica_pct_col = next((c for c in columns if c.lower() == "indica_percentage"), None)

    if not name_col:
        print("  ERROR: Cannot find strain name column. Aborting.")
        conn.close()
        return

    print(f"  Detected columns: name={name_col}, type={type_col}, effects={effects_col}")

    # 4. Import
    print("\n[4/5] Importing strains (gap-fill)...")
    stats = {
        "skipped_noname": 0, "skipped_dup": 0, "created": 0,
        "effects": 0, "ailments": 0, "terpenes": 0,
        "cannabinoids": 0, "flavors": 0, "metadata": 0,
    }

    for row in rows:
        name = (row.get(name_col) or "").strip()
        if not name:
            stats["skipped_noname"] += 1
            continue

        normalized = normalize_strain_name(name)
        if not normalized:
            stats["skipped_noname"] += 1
            continue

        # Strict dedup: exact match
        if normalized in name_to_id:
            stats["skipped_dup"] += 1
            continue

        # Fuzzy dedup (stricter threshold for gap-fill)
        if known_names:
            matches = match_strain_names(normalized, known_names, limit=1, score_cutoff=88.0)
            if matches:
                stats["skipped_dup"] += 1
                continue

        # Parse type — Cannabis Intelligence uses sativa_percentage/indica_percentage
        strain_type = "hybrid"
        if type_col:
            raw_type = (row.get(type_col, "")).strip().lower()
            if raw_type in ("indica", "sativa", "hybrid"):
                strain_type = raw_type
            elif "indica" in raw_type:
                strain_type = "indica"
            elif "sativa" in raw_type:
                strain_type = "sativa"
        elif sativa_pct_col and indica_pct_col:
            sat_pct = parse_float(row.get(sativa_pct_col, "")) or 0
            ind_pct = parse_float(row.get(indica_pct_col, "")) or 0
            if ind_pct >= 70:
                strain_type = "indica"
            elif sat_pct >= 70:
                strain_type = "sativa"
            else:
                strain_type = "hybrid"

        description = (row.get(desc_col, "") if desc_col else "").strip()[:500]

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

        # Effects
        if effects_col:
            effects_raw = parse_python_list(row.get(effects_col, ""))
            for idx, eff in enumerate(effects_raw):
                canonical = EFFECT_MAP.get(eff.lower())
                if canonical:
                    eff_id = get_or_create_effect(conn, canonical, "positive")
                    rc = weighted_report_count(POSITIVE_BASE, idx)
                    conn.execute(
                        "INSERT OR IGNORE INTO effect_reports "
                        "(strain_id, effect_id, report_count, confidence, source) "
                        "VALUES (?, ?, ?, ?, ?)",
                        (strain_id, eff_id, rc, CONFIDENCE, SOURCE_NAME),
                    )
                    stats["effects"] += 1

        # Medical/ailments
        med_col = medical_col or neg_col
        if med_col:
            ailments_raw = parse_python_list(row.get(med_col, ""))
            for idx, ailment in enumerate(ailments_raw):
                canonical = AILMENT_MAP.get(ailment.lower())
                if canonical:
                    eff_id = get_or_create_effect(conn, canonical, "medical")
                    rc = weighted_report_count(MEDICAL_BASE, idx)
                    conn.execute(
                        "INSERT OR IGNORE INTO effect_reports "
                        "(strain_id, effect_id, report_count, confidence, source) "
                        "VALUES (?, ?, ?, ?, ?)",
                        (strain_id, eff_id, rc, CONFIDENCE, SOURCE_NAME),
                    )
                    stats["ailments"] += 1

        # Terpenes
        if terpene_col:
            terpenes_raw = parse_python_list(row.get(terpene_col, ""))
            for idx, terp in enumerate(terpenes_raw):
                canonical_terp = TERPENE_NAME_MAP.get(terp.lower().strip())
                if canonical_terp:
                    mol_id = get_molecule_id(conn, canonical_terp)
                    if mol_id:
                        pct = TERPENE_PCT_BY_POSITION[min(idx, len(TERPENE_PCT_BY_POSITION) - 1)]
                        conn.execute(
                            "INSERT OR IGNORE INTO strain_compositions "
                            "(strain_id, molecule_id, percentage, measurement_type, source) "
                            "VALUES (?, ?, ?, 'estimated', ?)",
                            (strain_id, mol_id, pct, SOURCE_NAME),
                        )
                        stats["terpenes"] += 1

        # If no terpenes, use defaults
        if not terpene_col or not parse_python_list(row.get(terpene_col, "")):
            for terp_name, pct in DEFAULT_TERPENES.get(strain_type, DEFAULT_TERPENES["hybrid"]):
                mol_id = get_molecule_id(conn, terp_name)
                if mol_id:
                    conn.execute(
                        "INSERT OR IGNORE INTO strain_compositions "
                        "(strain_id, molecule_id, percentage, measurement_type, source) "
                        "VALUES (?, ?, ?, 'estimated', ?)",
                        (strain_id, mol_id, pct, SOURCE_NAME),
                    )
                    stats["terpenes"] += 1

        # Cannabinoids
        has_cann = False
        if thc_col:
            thc = parse_float(row.get(thc_col, ""))
            if thc and thc < 40:
                mol_id = get_molecule_id(conn, "thc")
                if mol_id:
                    conn.execute(
                        "INSERT OR IGNORE INTO strain_compositions "
                        "(strain_id, molecule_id, percentage, measurement_type, source) "
                        "VALUES (?, ?, ?, 'reported', ?)",
                        (strain_id, mol_id, thc, SOURCE_NAME),
                    )
                    stats["cannabinoids"] += 1
                    has_cann = True
        if cbd_col:
            cbd = parse_float(row.get(cbd_col, ""))
            if cbd and cbd < 30:
                mol_id = get_molecule_id(conn, "cbd")
                if mol_id:
                    conn.execute(
                        "INSERT OR IGNORE INTO strain_compositions "
                        "(strain_id, molecule_id, percentage, measurement_type, source) "
                        "VALUES (?, ?, ?, 'reported', ?)",
                        (strain_id, mol_id, cbd, SOURCE_NAME),
                    )
                    stats["cannabinoids"] += 1
                    has_cann = True

        if not has_cann:
            for cname, cval in DEFAULT_CANNABINOIDS.get(strain_type, DEFAULT_CANNABINOIDS["hybrid"]).items():
                mol_id = get_molecule_id(conn, cname)
                if mol_id:
                    conn.execute(
                        "INSERT OR IGNORE INTO strain_compositions "
                        "(strain_id, molecule_id, percentage, measurement_type, source) "
                        "VALUES (?, ?, ?, 'estimated', ?)",
                        (strain_id, mol_id, cval, SOURCE_NAME),
                    )
                    stats["cannabinoids"] += 1

        # Flavors
        if flavor_col:
            for flavor in parse_python_list(row.get(flavor_col, "")):
                conn.execute(
                    "INSERT OR IGNORE INTO strain_flavors (strain_id, flavor) VALUES (?, ?)",
                    (strain_id, flavor.strip().lower()),
                )
                stats["flavors"] += 1

        # Metadata
        mapped_effects = []
        if effects_col:
            for eff in parse_python_list(row.get(effects_col, "")):
                c = EFFECT_MAP.get(eff.lower())
                if c:
                    mapped_effects.append(c)

        best_for = [BEST_FOR_RULES[e] for e in mapped_effects[:3] if e in BEST_FOR_RULES]
        not_ideal = [NOT_IDEAL_RULES[e] for e in mapped_effects if e in NOT_IDEAL_RULES][:2]
        consumption = CONSUMPTION_BY_TYPE.get(strain_type, CONSUMPTION_BY_TYPE["hybrid"])

        parents = (row.get(parent_col, "") if parent_col else "").strip()
        lineage = {"self": name}
        if parents:
            parts = [p.strip() for p in parents.replace(" x ", ",").split(",") if p.strip()]
            if len(parts) >= 2:
                lineage["parent1"] = parts[0]
                lineage["parent2"] = parts[1]

        conn.execute(
            "INSERT OR REPLACE INTO strain_metadata "
            "(strain_id, consumption_suitability, price_range, best_for, "
            "not_ideal_for, genetics, lineage, description_extended) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (strain_id, json.dumps(consumption), "mid",
             json.dumps(best_for), json.dumps(not_ideal),
             parents, json.dumps(lineage),
             description[:200] if description else ""),
        )
        stats["metadata"] += 1

        if stats["created"] % 200 == 0:
            print(f"    ... {stats['created']} strains imported")

    conn.commit()
    conn.execute(
        "UPDATE data_sources SET record_count = ?, last_updated = CURRENT_TIMESTAMP WHERE name = ?",
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
    print(f"\n  Total strains in database: {len(name_to_id)}")


if __name__ == "__main__":
    db_path = sys.argv[1] if len(sys.argv) > 1 else None
    import_cannabis_intel(db_path)
