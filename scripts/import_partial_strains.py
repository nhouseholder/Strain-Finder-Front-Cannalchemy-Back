"""Import partial-data strains from Kushy + Cannabis Intelligence CSVs.

Imports strains that have ≥50% field coverage but were NOT previously
imported (either filtered out or used only for gap-filling). These strains
are tagged with data_quality='partial' and carry a disclaimer that they
have not been extensively lab-tested.

Partial strains are:
  - Searchable in the strain explorer and AI chat
  - EXCLUDED from personalized quiz recommendations

Data sources:
  - Kushy CSV:            ~9,524 rows (99% effects/flavors/terpenes/description)
  - Cannabis Intelligence: ~15,740 rows (26% effects, 90% about_info)

Usage:
    python scripts/import_partial_strains.py [db_path]
"""
import csv
import json
import random
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from cannalchemy.data.normalize import normalize_strain_name
from cannalchemy.data.schema import init_db

# Use faster scorer for batch dedup
from rapidfuzz import fuzz, process as rfprocess

# ── Paths ────────────────────────────────────────────────────────────────────

KUSHY_CSV = ROOT / "data" / "raw" / "kushy_strains.csv"
CI_CSV = ROOT / "data" / "raw" / "cannabis_intel_strains.csv"
DB_PATH = ROOT / "data" / "processed" / "cannalchemy.db"

# ── Constants ────────────────────────────────────────────────────────────────

KUSHY_SOURCE = "kushy-partial"
CI_SOURCE = "cannabis-intel-partial"

# Position-weighted decay factors for report counts
DECAY_FACTORS = [1.0, 0.85, 0.70, 0.55, 0.40, 0.30, 0.20, 0.15, 0.10, 0.08]

# Lower base report counts for partial strains (reflects less-verified data)
KUSHY_POSITIVE_BASE = 60
KUSHY_MEDICAL_BASE = 40
KUSHY_NEGATIVE_BASE = 20
CI_POSITIVE_BASE = 45
CI_MEDICAL_BASE = 30
CI_NEGATIVE_BASE = 15

# Terpene percentages by list position
TERPENE_PCT_BY_POSITION = [0.40, 0.22, 0.13, 0.07, 0.03]

# ── Effect maps (shared with import_kushy.py / import_cannabis_intel.py) ─────

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

# Minimum coverage thresholds (50% = 3 of 6 key fields)
MIN_KUSHY_FIELDS = 3   # of: effects, flavor, terpenes, description, type, thc
MIN_CI_FIELDS = 3       # of: effects, flavors, terpenes, about_info, sativa%, indica%


# ── Helpers ──────────────────────────────────────────────────────────────────

def weighted_report_count(base: int, position: int, jitter: float = 0.10) -> int:
    """Generate a realistic report count based on effect position."""
    factor = DECAY_FACTORS[min(position, len(DECAY_FACTORS) - 1)]
    count = int(base * factor)
    jitter_amount = max(1, int(count * jitter))
    count += random.randint(-jitter_amount, jitter_amount)
    return max(2, count)


def parse_comma_list(value: str) -> list[str]:
    """Parse a comma-separated string."""
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
    result = []
    for eff in effects[:5]:
        label = BEST_FOR_RULES.get(eff)
        if label and label not in result:
            result.append(label)
    return result[:3]


def infer_not_ideal(effects: list[str]) -> list[str]:
    result = []
    for eff in effects:
        label = NOT_IDEAL_RULES.get(eff)
        if label and label not in result:
            result.append(label)
    return result[:3]


def kushy_coverage_score(row: dict) -> int:
    """Count how many key fields have data (0-6)."""
    score = 0
    if (row.get("effects") or "").strip():
        score += 1
    if (row.get("flavor") or "").strip():
        score += 1
    if (row.get("terpenes") or "").strip():
        score += 1
    if (row.get("description") or "").strip():
        score += 1
    if (row.get("type") or "").strip():
        score += 1
    if parse_float(row.get("thc", "")):
        score += 1
    return score


def ci_coverage_score(row: dict) -> int:
    """Count how many key fields have data (0-6)."""
    score = 0
    if (row.get("effects") or "").strip():
        score += 1
    if (row.get("flavors") or "").strip():
        score += 1
    if (row.get("terpenes") or "").strip():
        score += 1
    if (row.get("about_info") or "").strip():
        score += 1
    if parse_float(row.get("sativa_percentage", "")):
        score += 1
    if parse_float(row.get("indica_percentage", "")):
        score += 1
    return score


# ── Import functions ─────────────────────────────────────────────────────────

def import_kushy_partials(conn, name_to_id, known_names, original_names_for_fuzzy):
    """Import remaining Kushy strains not already in DB."""
    print("\n── Importing Kushy partial strains ──")

    if not KUSHY_CSV.exists():
        print(f"  SKIP: {KUSHY_CSV} not found")
        return 0

    with open(KUSHY_CSV, encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    print(f"  CSV rows: {len(rows)}")

    # Pre-compute fuzzy exclusions against ORIGINAL db strains only (O(n*1477) not O(n²))
    print("  Pre-computing fuzzy dedup against original DB strains...")
    fuzzy_reject = set()
    candidates = []
    for row in rows:
        name = (row.get("name") or "").strip()
        if not name:
            continue
        normalized = normalize_strain_name(name)
        if not normalized:
            continue
        if kushy_coverage_score(row) < MIN_KUSHY_FIELDS:
            continue
        if normalized in name_to_id:
            continue
        candidates.append((normalized, row))

    # Batch fuzzy check using fast ratio scorer (not WRatio)
    if original_names_for_fuzzy:
        for i, (normalized, _row) in enumerate(candidates):
            match = rfprocess.extractOne(
                normalized, original_names_for_fuzzy,
                scorer=fuzz.ratio, score_cutoff=85.0,
            )
            if match:
                fuzzy_reject.add(normalized)
            if (i + 1) % 2000 == 0:
                print(f"    ... fuzzy checked {i + 1}/{len(candidates)}")
    print(f"  Fuzzy rejects: {len(fuzzy_reject)}")

    stats = {"created": 0, "skipped_dup": 0, "skipped_noname": 0, "skipped_coverage": 0}

    for row in rows:
        name = (row.get("name") or "").strip()
        if not name:
            stats["skipped_noname"] += 1
            continue

        normalized = normalize_strain_name(name)
        if not normalized:
            stats["skipped_noname"] += 1
            continue

        # Coverage check
        if kushy_coverage_score(row) < MIN_KUSHY_FIELDS:
            stats["skipped_coverage"] += 1
            continue

        # Dedup: exact against all known (fast set lookup)
        if normalized in name_to_id:
            stats["skipped_dup"] += 1
            continue

        # Dedup: pre-computed fuzzy reject
        if normalized in fuzzy_reject:
            stats["skipped_dup"] += 1
            continue

        # Determine type
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

        # Insert strain — marked as partial
        cursor = conn.execute(
            "INSERT OR IGNORE INTO strains "
            "(name, normalized_name, strain_type, description, source, data_quality) "
            "VALUES (?, ?, ?, ?, ?, 'partial')",
            (name, normalized, strain_type, description, KUSHY_SOURCE),
        )
        if not cursor.lastrowid:
            stats["skipped_dup"] += 1
            continue

        strain_id = cursor.lastrowid
        name_to_id[normalized] = strain_id
        known_names.append(normalized)
        stats["created"] += 1

        # ── Effects ──────────────────────────────────────────────────
        effects_raw = parse_comma_list(row.get("effects", ""))
        mapped_effects = []
        for eff_name in effects_raw:
            canonical = EFFECT_MAP.get(eff_name.lower())
            if canonical and canonical not in mapped_effects:
                mapped_effects.append(canonical)

        for idx, effect_name in enumerate(mapped_effects):
            eff_id = get_or_create_effect(conn, effect_name, "positive")
            rc = weighted_report_count(KUSHY_POSITIVE_BASE, idx)
            conn.execute(
                "INSERT OR IGNORE INTO effect_reports "
                "(strain_id, effect_id, report_count, confidence, source) "
                "VALUES (?, ?, ?, 0.8, ?)",
                (strain_id, eff_id, rc, KUSHY_SOURCE),
            )

        # ── Ailments → Medical effects ───────────────────────────────
        ailments_raw = parse_comma_list(row.get("ailment", ""))
        for idx, ailment in enumerate(ailments_raw):
            canonical = AILMENT_MAP.get(ailment.lower())
            if canonical:
                eff_id = get_or_create_effect(conn, canonical, "medical")
                rc = weighted_report_count(KUSHY_MEDICAL_BASE, idx)
                conn.execute(
                    "INSERT OR IGNORE INTO effect_reports "
                    "(strain_id, effect_id, report_count, confidence, source) "
                    "VALUES (?, ?, ?, 0.7, ?)",
                    (strain_id, eff_id, rc, KUSHY_SOURCE),
                )

        # ── Negative effects ─────────────────────────────────────────
        negatives_raw = parse_comma_list(row.get("negative", ""))
        for idx, neg in enumerate(negatives_raw):
            canonical = EFFECT_MAP.get(neg.lower())
            if canonical:
                eff_id = get_or_create_effect(conn, canonical, "negative")
                rc = weighted_report_count(KUSHY_NEGATIVE_BASE, idx)
                conn.execute(
                    "INSERT OR IGNORE INTO effect_reports "
                    "(strain_id, effect_id, report_count, confidence, source) "
                    "VALUES (?, ?, ?, 0.7, ?)",
                    (strain_id, eff_id, rc, KUSHY_SOURCE),
                )

        # ── Terpenes ─────────────────────────────────────────────────
        terpenes_raw = parse_comma_list(row.get("terpenes", ""))
        terpene_entries = []
        for idx, terp in enumerate(terpenes_raw):
            canonical_terp = TERPENE_NAME_MAP.get(terp.lower().strip())
            if canonical_terp:
                pct = TERPENE_PCT_BY_POSITION[min(idx, len(TERPENE_PCT_BY_POSITION) - 1)]
                terpene_entries.append((canonical_terp, pct))

        if not terpene_entries:
            terpene_entries = DEFAULT_TERPENES.get(strain_type, DEFAULT_TERPENES["hybrid"])

        for terp_name, pct in terpene_entries:
            mol_id = get_molecule_id(conn, terp_name)
            if mol_id:
                conn.execute(
                    "INSERT OR IGNORE INTO strain_compositions "
                    "(strain_id, molecule_id, percentage, measurement_type, source) "
                    "VALUES (?, ?, ?, 'estimated', ?)",
                    (strain_id, mol_id, pct, KUSHY_SOURCE),
                )

        # ── Cannabinoids ─────────────────────────────────────────────
        has_cannabinoid = False
        for cname in ("thc", "cbd", "cbn", "cbg", "thcv", "cbc"):
            cval = parse_float(row.get(cname, ""))
            if cval is not None:
                mol_id = get_molecule_id(conn, cname)
                if mol_id:
                    conn.execute(
                        "INSERT OR IGNORE INTO strain_compositions "
                        "(strain_id, molecule_id, percentage, measurement_type, source) "
                        "VALUES (?, ?, ?, 'reported', ?)",
                        (strain_id, mol_id, cval, KUSHY_SOURCE),
                    )
                    has_cannabinoid = True

        if not has_cannabinoid:
            defaults = DEFAULT_CANNABINOIDS.get(strain_type, DEFAULT_CANNABINOIDS["hybrid"])
            for cname, cval in defaults.items():
                mol_id = get_molecule_id(conn, cname)
                if mol_id:
                    conn.execute(
                        "INSERT OR IGNORE INTO strain_compositions "
                        "(strain_id, molecule_id, percentage, measurement_type, source) "
                        "VALUES (?, ?, ?, 'estimated', ?)",
                        (strain_id, mol_id, cval, KUSHY_SOURCE),
                    )

        # ── Flavors ──────────────────────────────────────────────────
        flavors_raw = parse_comma_list(row.get("flavor", ""))
        for flavor in flavors_raw:
            flavor_clean = flavor.strip().lower()
            if flavor_clean:
                conn.execute(
                    "INSERT OR IGNORE INTO strain_flavors (strain_id, flavor) VALUES (?, ?)",
                    (strain_id, flavor_clean),
                )

        # ── Metadata ─────────────────────────────────────────────────
        best_for = infer_best_for(mapped_effects)
        not_ideal = infer_not_ideal(mapped_effects)
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

        if stats["created"] % 500 == 0 and stats["created"] > 0:
            print(f"    ... {stats['created']} Kushy partials imported")
            conn.commit()

    conn.commit()

    print(f"  Kushy partials created:     {stats['created']}")
    print(f"  Skipped (no name):          {stats['skipped_noname']}")
    print(f"  Skipped (duplicate):        {stats['skipped_dup']}")
    print(f"  Skipped (low coverage):     {stats['skipped_coverage']}")

    return stats["created"]


def import_ci_partials(conn, name_to_id, known_names, original_names_for_fuzzy):
    """Import remaining Cannabis Intelligence strains not already in DB."""
    print("\n── Importing Cannabis Intelligence partial strains ──")

    if not CI_CSV.exists():
        print(f"  SKIP: {CI_CSV} not found")
        return 0

    with open(CI_CSV, encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    print(f"  CSV rows: {len(rows)}")

    # Pre-compute fuzzy exclusions against ORIGINAL db strains only
    print("  Pre-computing fuzzy dedup against original DB strains...")
    fuzzy_reject = set()
    candidates = []
    for row in rows:
        name = (row.get("strain_name") or "").strip()
        if not name:
            continue
        normalized = normalize_strain_name(name)
        if not normalized:
            continue
        if ci_coverage_score(row) < MIN_CI_FIELDS:
            continue
        if normalized in name_to_id:
            continue
        candidates.append((normalized, row))

    if original_names_for_fuzzy:
        for i, (normalized, _row) in enumerate(candidates):
            match = rfprocess.extractOne(
                normalized, original_names_for_fuzzy,
                scorer=fuzz.ratio, score_cutoff=85.0,
            )
            if match:
                fuzzy_reject.add(normalized)
            if (i + 1) % 2000 == 0:
                print(f"    ... fuzzy checked {i + 1}/{len(candidates)}")
    print(f"  Fuzzy rejects: {len(fuzzy_reject)}")

    stats = {"created": 0, "skipped_dup": 0, "skipped_noname": 0, "skipped_coverage": 0}

    for row in rows:
        name = (row.get("strain_name") or "").strip()
        if not name:
            stats["skipped_noname"] += 1
            continue

        normalized = normalize_strain_name(name)
        if not normalized:
            stats["skipped_noname"] += 1
            continue

        # Coverage check
        if ci_coverage_score(row) < MIN_CI_FIELDS:
            stats["skipped_coverage"] += 1
            continue

        # Dedup: exact against all known (fast set lookup)
        if normalized in name_to_id:
            stats["skipped_dup"] += 1
            continue

        # Dedup: pre-computed fuzzy reject
        if normalized in fuzzy_reject:
            stats["skipped_dup"] += 1
            continue

        # Determine type from percentages
        sativa_pct = parse_float(row.get("sativa_percentage", ""))
        indica_pct = parse_float(row.get("indica_percentage", ""))
        if sativa_pct and indica_pct:
            if sativa_pct > 70:
                strain_type = "sativa"
            elif indica_pct > 70:
                strain_type = "indica"
            else:
                strain_type = "hybrid"
        elif sativa_pct and sativa_pct > 60:
            strain_type = "sativa"
        elif indica_pct and indica_pct > 60:
            strain_type = "indica"
        else:
            strain_type = "hybrid"

        description = (row.get("about_info") or "").strip()[:500]

        # Insert strain — marked as partial
        cursor = conn.execute(
            "INSERT OR IGNORE INTO strains "
            "(name, normalized_name, strain_type, description, source, data_quality) "
            "VALUES (?, ?, ?, ?, ?, 'partial')",
            (name, normalized, strain_type, description, CI_SOURCE),
        )
        if not cursor.lastrowid:
            stats["skipped_dup"] += 1
            continue

        strain_id = cursor.lastrowid
        name_to_id[normalized] = strain_id
        known_names.append(normalized)
        stats["created"] += 1

        # ── Effects ──────────────────────────────────────────────────
        effects_raw = parse_comma_list(row.get("effects", ""))
        mapped_effects = []
        for eff_name in effects_raw:
            canonical = EFFECT_MAP.get(eff_name.lower().strip())
            if canonical and canonical not in mapped_effects:
                mapped_effects.append(canonical)

        for idx, effect_name in enumerate(mapped_effects):
            eff_id = get_or_create_effect(conn, effect_name, "positive")
            rc = weighted_report_count(CI_POSITIVE_BASE, idx)
            conn.execute(
                "INSERT OR IGNORE INTO effect_reports "
                "(strain_id, effect_id, report_count, confidence, source) "
                "VALUES (?, ?, ?, 0.7, ?)",
                (strain_id, eff_id, rc, CI_SOURCE),
            )

        # ── Terpenes ─────────────────────────────────────────────────
        terpenes_raw = parse_comma_list(row.get("terpenes", ""))
        terpene_entries = []
        for idx, terp in enumerate(terpenes_raw):
            canonical_terp = TERPENE_NAME_MAP.get(terp.lower().strip())
            if canonical_terp:
                pct = TERPENE_PCT_BY_POSITION[min(idx, len(TERPENE_PCT_BY_POSITION) - 1)]
                terpene_entries.append((canonical_terp, pct))

        if not terpene_entries:
            terpene_entries = DEFAULT_TERPENES.get(strain_type, DEFAULT_TERPENES["hybrid"])

        for terp_name, pct in terpene_entries:
            mol_id = get_molecule_id(conn, terp_name)
            if mol_id:
                conn.execute(
                    "INSERT OR IGNORE INTO strain_compositions "
                    "(strain_id, molecule_id, percentage, measurement_type, source) "
                    "VALUES (?, ?, ?, 'estimated', ?)",
                    (strain_id, mol_id, pct, CI_SOURCE),
                )

        # ── Cannabinoids (defaults based on type) ────────────────────
        thc_val = parse_float(row.get("thc_min", ""))
        cbd_val = parse_float(row.get("cbd_min", ""))

        has_cannabinoid = False
        if thc_val:
            mol_id = get_molecule_id(conn, "thc")
            if mol_id:
                conn.execute(
                    "INSERT OR IGNORE INTO strain_compositions "
                    "(strain_id, molecule_id, percentage, measurement_type, source) "
                    "VALUES (?, ?, ?, 'reported', ?)",
                    (strain_id, mol_id, min(thc_val, 35.0), CI_SOURCE),
                )
                has_cannabinoid = True

        if cbd_val:
            mol_id = get_molecule_id(conn, "cbd")
            if mol_id:
                conn.execute(
                    "INSERT OR IGNORE INTO strain_compositions "
                    "(strain_id, molecule_id, percentage, measurement_type, source) "
                    "VALUES (?, ?, ?, 'reported', ?)",
                    (strain_id, mol_id, min(cbd_val, 20.0), CI_SOURCE),
                )
                has_cannabinoid = True

        if not has_cannabinoid:
            defaults = DEFAULT_CANNABINOIDS.get(strain_type, DEFAULT_CANNABINOIDS["hybrid"])
            for cname, cval in defaults.items():
                mol_id = get_molecule_id(conn, cname)
                if mol_id:
                    conn.execute(
                        "INSERT OR IGNORE INTO strain_compositions "
                        "(strain_id, molecule_id, percentage, measurement_type, source) "
                        "VALUES (?, ?, ?, 'estimated', ?)",
                        (strain_id, mol_id, cval, CI_SOURCE),
                    )

        # ── Flavors ──────────────────────────────────────────────────
        flavors_raw = parse_comma_list(row.get("flavors", ""))
        for flavor in flavors_raw:
            flavor_clean = flavor.strip().lower()
            if flavor_clean:
                conn.execute(
                    "INSERT OR IGNORE INTO strain_flavors (strain_id, flavor) VALUES (?, ?)",
                    (strain_id, flavor_clean),
                )

        # ── Metadata ─────────────────────────────────────────────────
        best_for = infer_best_for(mapped_effects)
        not_ideal = infer_not_ideal(mapped_effects)
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
                "",  # no genetics from CI
                json.dumps({"self": name}),
                description[:200] if description else "",
            ),
        )

        if stats["created"] % 500 == 0 and stats["created"] > 0:
            print(f"    ... {stats['created']} CI partials imported")
            conn.commit()

    conn.commit()

    print(f"  CI partials created:       {stats['created']}")
    print(f"  Skipped (no name):         {stats['skipped_noname']}")
    print(f"  Skipped (duplicate):       {stats['skipped_dup']}")
    print(f"  Skipped (low coverage):    {stats['skipped_coverage']}")

    return stats["created"]


# ── Main ─────────────────────────────────────────────────────────────────────

def main(db_path=None):
    if db_path is None:
        db_path = str(DB_PATH)

    print("=" * 60)
    print("PARTIAL STRAIN IMPORT")
    print("=" * 60)
    print("Importing strains with ≥50% data coverage, tagged as 'partial'.")
    print("These strains are searchable but excluded from quiz results.\n")

    conn = init_db(db_path)

    # Ensure data_quality column exists
    cols = [row[1] for row in conn.execute("PRAGMA table_info(strains)").fetchall()]
    if "data_quality" not in cols:
        conn.execute("ALTER TABLE strains ADD COLUMN data_quality TEXT DEFAULT 'full'")
        conn.execute("UPDATE strains SET data_quality = 'full' WHERE data_quality IS NULL")
        conn.commit()

    # Get existing strains for dedup
    existing = conn.execute("SELECT id, normalized_name FROM strains").fetchall()
    name_to_id = {row[1]: row[0] for row in existing}
    known_names = list(name_to_id.keys())
    # Freeze original names for fuzzy dedup (don't grow this during import)
    original_names_for_fuzzy = list(known_names)
    print(f"Existing strains in DB: {len(known_names)}")

    # Import Kushy first (richer data), then CI (gap-fill)
    kushy_count = import_kushy_partials(conn, name_to_id, known_names, original_names_for_fuzzy)
    ci_count = import_ci_partials(conn, name_to_id, known_names, original_names_for_fuzzy)

    # Final stats
    conn.execute(
        "INSERT OR REPLACE INTO data_sources (name, source_type, url, notes, record_count) "
        "VALUES (?, 'csv', '', 'Kushy partial strains (≥50% coverage, community data)', ?)",
        (KUSHY_SOURCE, kushy_count),
    )
    conn.execute(
        "INSERT OR REPLACE INTO data_sources (name, source_type, url, notes, record_count) "
        "VALUES (?, 'csv', '', 'Cannabis Intel partial strains (≥50% coverage)', ?)",
        (CI_SOURCE, ci_count),
    )
    conn.commit()

    # Report
    total_full = conn.execute("SELECT COUNT(*) FROM strains WHERE data_quality = 'full'").fetchone()[0]
    total_partial = conn.execute("SELECT COUNT(*) FROM strains WHERE data_quality = 'partial'").fetchone()[0]
    total = total_full + total_partial

    conn.close()

    print("\n" + "=" * 60)
    print("IMPORT COMPLETE")
    print("=" * 60)
    print(f"  New Kushy partials:        {kushy_count}")
    print(f"  New CI partials:           {ci_count}")
    print(f"  Total new partials:        {kushy_count + ci_count}")
    print(f"  ─────────────────────────")
    print(f"  Full-data strains:         {total_full}")
    print(f"  Partial-data strains:      {total_partial}")
    print(f"  TOTAL STRAINS IN DB:       {total}")
    print("=" * 60)


if __name__ == "__main__":
    db_path = sys.argv[1] if len(sys.argv) > 1 else None
    main(db_path)
