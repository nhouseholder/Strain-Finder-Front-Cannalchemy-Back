"""Import strains from the Leafly open-source dataset (Kaggle / recogna.tech).

Cross-references ~4,764 strains from the Leafly community dataset against our
existing database.  New strains are inserted with data_quality = 'partial'
(when effect data exists) or 'search-only' (name + type only).

The Leafly dataset has percentage-based community review scores for each
effect/ailment, which we convert to position-weighted report counts.

These strains will appear in Search/Autocomplete only — NOT in quiz results,
Discover, or Explore (gated by the existing dataCompleteness filter).

Usage:
    python scripts/import_leafly_open.py [db_path]
"""
import csv
import json
import os
import random
import sqlite3
import sys
from pathlib import Path

# Add project root to path
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from cannalchemy.data.normalize import normalize_strain_name, match_strain_names
from cannalchemy.data.schema import init_db

# ── Constants ────────────────────────────────────────────────────────────────

LOCAL_CSV = ROOT / "data" / "raw" / "leafly_strain_data.csv"
SOURCE_NAME = "leafly-open"

# Position-weighted report counts (same convention as other import scripts)
POSITIVE_BASE = 100
NEGATIVE_BASE = 35
MEDICAL_BASE = 70
DECAY_FACTORS = [1.0, 0.85, 0.70, 0.55, 0.40, 0.30, 0.20, 0.15, 0.10, 0.08]

# Terpene percentages by position (first listed = dominant)
TERPENE_PCT_BY_POSITION = [0.50, 0.30, 0.20, 0.10, 0.05, 0.03]

# ── Leafly column → canonical effect mapping ─────────────────────────────────
# Leafly CSV has columns like "relaxed", "happy", etc. with percentage values.
# We map them to our canonical effect names and categories.

POSITIVE_EFFECT_COLS = {
    "relaxed": "relaxed",
    "happy": "happy",
    "euphoric": "euphoric",
    "uplifted": "uplifted",
    "sleepy": "sleepy",
    "hungry": "hungry",
    "talkative": "talkative",
    "creative": "creative",
    "energetic": "energetic",
    "focused": "focused",
    "giggly": "giggly",
    "tingly": "tingly",
    "aroused": "aroused",
}

NEGATIVE_EFFECT_COLS = {
    "dry_mouth": "dry-mouth",
    "dry_eyes": "dry-eyes",
    "dizzy": "dizzy",
    "paranoid": "paranoid",
    "anxious": "anxious",
    "headache": "headache",
}

MEDICAL_EFFECT_COLS = {
    "stress": "stress",
    "pain": "pain",
    "depression": "depression",
    "anxiety": "anxiety",
    "insomnia": "insomnia",
    "fatigue": "fatigue-medical",
    "lack_of_appetite": "appetite-loss",
    "nausea": "nausea-relief",
    "headaches": "migraines",
    "muscle_spasms": "muscle-spasms",
    "inflammation": "inflammation",
    "eye_pressure": "eye-pressure",
    "seizures": "seizures",
    "cramps": "muscle-spasms",
    "ptsd": "ptsd",
    "gastrointestinal_disorder": "gastrointestinal",
    "migraines": "migraines",
}

# Terpene name mappings (Leafly uses simple names in most_common_terpene column)
TERPENE_NAME_MAP = {
    "myrcene": "myrcene",
    "limonene": "limonene",
    "caryophyllene": "caryophyllene",
    "beta-caryophyllene": "caryophyllene",
    "linalool": "linalool",
    "pinene": "pinene",
    "alpha-pinene": "pinene",
    "humulene": "humulene",
    "alpha-humulene": "humulene",
    "ocimene": "ocimene",
    "terpinolene": "terpinolene",
    "terpineol": "terpineol",
    "valencene": "valencene",
    "bisabolol": "bisabolol",
    "camphene": "camphene",
    "geraniol": "geraniol",
    "nerolidol": "nerolidol",
    "eucalyptol": "eucalyptol",
    "borneol": "borneol",
    "phytol": "phytol",
    "carene": "carene",
    "sabinene": "sabinene",
    "phellandrene": "phellandrene",
    "guaiol": "guaiol",
    "cymene": "cymene",
    "isopulegol": "isopulegol",
    "fenchol": "fenchol",
}

# Default terpenes by strain type (when no terpene info)
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

# Metadata inference
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

def parse_pct(value: str) -> float:
    """Parse a percentage string like '66%' to 66.0. Returns 0 on failure."""
    if not value or not value.strip():
        return 0.0
    try:
        return float(value.strip().replace("%", ""))
    except (ValueError, TypeError):
        return 0.0


def weighted_report_count(base: int, position: int, jitter: float = 0.10) -> int:
    """Generate a realistic report count based on effect position."""
    factor = DECAY_FACTORS[min(position, len(DECAY_FACTORS) - 1)]
    count = int(base * factor)
    jitter_amount = max(1, int(count * jitter))
    count += random.randint(-jitter_amount, jitter_amount)
    return max(3, count)


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


# ── Main import ─────────────────────────────────────────────────────────────

def import_leafly(db_path: str | None = None):
    """Import Leafly open-source strains into the database."""
    if db_path is None:
        db_path = str(ROOT / "data" / "processed" / "cannalchemy.db")

    print("=" * 60)
    print("LEAFLY OPEN-SOURCE DATASET IMPORT")
    print("=" * 60)

    # 1. Check CSV exists
    if not LOCAL_CSV.exists():
        print(f"  ERROR: CSV not found at {LOCAL_CSV}")
        print(f"  Download from https://www.recogna.tech/files/datasets/leafly_strain_data.tar.gz")
        sys.exit(1)

    print(f"  Using CSV: {LOCAL_CSV} ({LOCAL_CSV.stat().st_size:,} bytes)")

    # 2. Open database
    print("\n[1/5] Opening database...")
    conn = init_db(db_path)

    # Register data source
    conn.execute(
        "INSERT OR IGNORE INTO data_sources (name, source_type, url, notes) "
        "VALUES (?, ?, ?, ?)",
        (
            SOURCE_NAME,
            "csv",
            "https://www.recogna.tech/files/datasets/leafly_strain_data.tar.gz",
            "Leafly community strain data (~4,764 strains) via recogna.tech open dataset",
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
    print("\n[2/5] Parsing CSV...")
    with open(LOCAL_CSV, encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    print(f"  Found {len(rows)} rows in CSV")

    # 4. Import strains
    print("\n[3/5] Importing strains...")
    stats = {
        "skipped_noname": 0,
        "skipped_dup_exact": 0,
        "skipped_dup_fuzzy": 0,
        "created_partial": 0,
        "created_search_only": 0,
        "effects_positive": 0,
        "effects_negative": 0,
        "effects_medical": 0,
        "terpenes": 0,
        "cannabinoids": 0,
        "metadata": 0,
        "enriched_existing": 0,
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

        # ── Check for existing strain (exact match) ──
        existing_id = name_to_id.get(normalized)
        if existing_id:
            # Strain exists — enrich it with Leafly community data if beneficial
            _maybe_enrich_existing(conn, existing_id, row, stats)
            stats["skipped_dup_exact"] += 1
            continue

        # ── Fuzzy match ──
        if known_names:
            matches = match_strain_names(normalized, known_names, limit=1, score_cutoff=88.0)
            if matches:
                stats["skipped_dup_fuzzy"] += 1
                continue

        # ── New strain — determine type ──
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

        # ── Extract effects with percentage scores ──
        positive_effects = _extract_effects(row, POSITIVE_EFFECT_COLS)
        negative_effects = _extract_effects(row, NEGATIVE_EFFECT_COLS)
        medical_effects = _extract_effects(row, MEDICAL_EFFECT_COLS)

        # Determine data quality based on available data
        has_effects = len(positive_effects) > 0
        has_description = len(description) > 50
        thc_str = (row.get("thc_level") or "").replace("%", "").strip()
        has_thc = bool(thc_str)

        if has_effects and (has_description or has_thc):
            data_quality = "partial"
        else:
            data_quality = "search-only"

        # ── Insert strain ──
        cursor = conn.execute(
            "INSERT OR IGNORE INTO strains "
            "(name, normalized_name, strain_type, description, source, data_quality) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (name, normalized, strain_type, description, SOURCE_NAME, data_quality),
        )
        if not cursor.lastrowid:
            stats["skipped_dup_exact"] += 1
            continue

        strain_id = cursor.lastrowid
        name_to_id[normalized] = strain_id
        known_names.append(normalized)

        if data_quality == "partial":
            stats["created_partial"] += 1
        else:
            stats["created_search_only"] += 1

        # ── Insert effects (community percentages → report counts) ──
        for idx, (canonical, pct) in enumerate(positive_effects):
            eff_id = get_or_create_effect(conn, canonical, "positive")
            # Scale report count by the community percentage
            base = int(POSITIVE_BASE * (pct / 100.0))
            rc = max(3, weighted_report_count(max(10, base), idx, jitter=0.08))
            conn.execute(
                "INSERT OR IGNORE INTO effect_reports "
                "(strain_id, effect_id, report_count, confidence, source) "
                "VALUES (?, ?, ?, 0.85, ?)",
                (strain_id, eff_id, rc, SOURCE_NAME),
            )
            stats["effects_positive"] += 1

        for idx, (canonical, pct) in enumerate(negative_effects):
            eff_id = get_or_create_effect(conn, canonical, "negative")
            base = int(NEGATIVE_BASE * (pct / 100.0))
            rc = max(3, weighted_report_count(max(5, base), idx, jitter=0.08))
            conn.execute(
                "INSERT OR IGNORE INTO effect_reports "
                "(strain_id, effect_id, report_count, confidence, source) "
                "VALUES (?, ?, ?, 0.85, ?)",
                (strain_id, eff_id, rc, SOURCE_NAME),
            )
            stats["effects_negative"] += 1

        for idx, (canonical, pct) in enumerate(medical_effects):
            eff_id = get_or_create_effect(conn, canonical, "medical")
            base = int(MEDICAL_BASE * (pct / 100.0))
            rc = max(3, weighted_report_count(max(5, base), idx, jitter=0.08))
            conn.execute(
                "INSERT OR IGNORE INTO effect_reports "
                "(strain_id, effect_id, report_count, confidence, source) "
                "VALUES (?, ?, ?, 0.85, ?)",
                (strain_id, eff_id, rc, SOURCE_NAME),
            )
            stats["effects_medical"] += 1

        # ── Terpene from most_common_terpene column ──
        terpene_raw = (row.get("most_common_terpene") or "").strip().lower()
        terpene_entries = []
        if terpene_raw:
            canonical_terp = TERPENE_NAME_MAP.get(terpene_raw)
            if canonical_terp:
                terpene_entries.append((canonical_terp, 0.50))
                # Add likely secondary terpenes based on type
                secondary = _secondary_terpenes(canonical_terp, strain_type)
                terpene_entries.extend(secondary)

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

        # ── THC from thc_level column ──
        thc_val = parse_pct(row.get("thc_level", ""))
        if thc_val > 0:
            mol_id = get_molecule_id(conn, "thc")
            if mol_id:
                conn.execute(
                    "INSERT OR IGNORE INTO strain_compositions "
                    "(strain_id, molecule_id, percentage, measurement_type, source) "
                    "VALUES (?, ?, ?, 'reported', ?)",
                    (strain_id, mol_id, thc_val, SOURCE_NAME),
                )
                stats["cannabinoids"] += 1
        else:
            # Default THC
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

        # ── Metadata ──
        eff_names = [e[0] for e in positive_effects]
        neg_names = [e[0] for e in negative_effects]
        best_for = infer_best_for(eff_names)
        not_ideal = infer_not_ideal(eff_names, neg_names)
        consumption = CONSUMPTION_BY_TYPE.get(strain_type, CONSUMPTION_BY_TYPE["hybrid"])

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
                "",
                json.dumps({"self": name}),
                description[:200] if description else "",
            ),
        )
        stats["metadata"] += 1

        # Progress
        total_created = stats["created_partial"] + stats["created_search_only"]
        if total_created % 200 == 0 and total_created > 0:
            print(f"    ... {total_created} new strains imported")

    # 5. Commit and report
    conn.commit()

    conn.execute(
        "UPDATE data_sources SET record_count = ?, last_updated = CURRENT_TIMESTAMP "
        "WHERE name = ?",
        (stats["created_partial"] + stats["created_search_only"], SOURCE_NAME),
    )
    conn.commit()
    conn.close()

    total_created = stats["created_partial"] + stats["created_search_only"]
    print("\n[5/5] Import complete!")
    print("=" * 60)
    print(f"  New strains (partial):     {stats['created_partial']}")
    print(f"  New strains (search-only): {stats['created_search_only']}")
    print(f"  Skipped (no name):         {stats['skipped_noname']}")
    print(f"  Skipped (exact dup):       {stats['skipped_dup_exact']}")
    print(f"  Skipped (fuzzy dup):       {stats['skipped_dup_fuzzy']}")
    print(f"  Enriched existing:         {stats['enriched_existing']}")
    print(f"  Positive effect reports:   {stats['effects_positive']}")
    print(f"  Negative effect reports:   {stats['effects_negative']}")
    print(f"  Medical effect reports:    {stats['effects_medical']}")
    print(f"  Terpene entries:           {stats['terpenes']}")
    print(f"  Cannabinoid entries:       {stats['cannabinoids']}")
    print(f"  Metadata records:          {stats['metadata']}")
    print("=" * 60)
    print(f"\n  Total new strains added: {total_created}")


# ── Private helpers ─────────────────────────────────────────────────────────

def _extract_effects(row: dict, col_map: dict) -> list[tuple[str, float]]:
    """Extract effects from a Leafly row, sorted by community percentage desc.

    Returns list of (canonical_name, percentage) tuples, filtered to >= 5%.
    """
    effects = []
    for col, canonical in col_map.items():
        pct = parse_pct(row.get(col, ""))
        if pct >= 5.0:
            effects.append((canonical, pct))
    effects.sort(key=lambda x: x[1], reverse=True)
    return effects


def _secondary_terpenes(primary: str, strain_type: str) -> list[tuple[str, float]]:
    """Given a primary terpene, return likely secondary terpenes."""
    # Common co-occurring terpenes
    CO_OCCUR = {
        "myrcene": [("caryophyllene", 0.25), ("linalool", 0.15)],
        "limonene": [("caryophyllene", 0.25), ("myrcene", 0.15)],
        "caryophyllene": [("myrcene", 0.20), ("limonene", 0.15)],
        "linalool": [("myrcene", 0.25), ("caryophyllene", 0.15)],
        "pinene": [("myrcene", 0.20), ("caryophyllene", 0.15)],
        "humulene": [("caryophyllene", 0.30), ("myrcene", 0.15)],
        "terpinolene": [("myrcene", 0.20), ("ocimene", 0.15)],
        "ocimene": [("terpinolene", 0.20), ("myrcene", 0.15)],
    }
    result = CO_OCCUR.get(primary, [])
    if not result:
        # Fallback: use type-based defaults minus the primary
        defaults = DEFAULT_TERPENES.get(strain_type, DEFAULT_TERPENES["hybrid"])
        result = [(t, p) for t, p in defaults if t != primary][:2]
    return result


def _maybe_enrich_existing(
    conn: sqlite3.Connection,
    strain_id: int,
    row: dict,
    stats: dict,
):
    """For existing strains, add Leafly community effect data if we don't
    already have data from this source. This enriches existing strains
    with community review percentages without overwriting existing data."""
    # Check if we already have Leafly data for this strain
    existing_report = conn.execute(
        "SELECT 1 FROM effect_reports WHERE strain_id = ? AND source = ? LIMIT 1",
        (strain_id, SOURCE_NAME),
    ).fetchone()
    if existing_report:
        return  # Already enriched

    # Only enrich with positive effects from community reviews
    positive_effects = _extract_effects(row, POSITIVE_EFFECT_COLS)
    if not positive_effects:
        return

    for idx, (canonical, pct) in enumerate(positive_effects[:5]):
        eff_id = get_or_create_effect(conn, canonical, "positive")
        base = int(POSITIVE_BASE * (pct / 100.0))
        rc = max(3, weighted_report_count(max(10, base), idx, jitter=0.08))
        conn.execute(
            "INSERT OR IGNORE INTO effect_reports "
            "(strain_id, effect_id, report_count, confidence, source) "
            "VALUES (?, ?, ?, 0.80, ?)",
            (strain_id, eff_id, rc, SOURCE_NAME),
        )

    stats["enriched_existing"] += 1


if __name__ == "__main__":
    db_path = sys.argv[1] if len(sys.argv) > 1 else None
    import_leafly(db_path)
