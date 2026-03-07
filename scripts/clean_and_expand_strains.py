"""Clean dirty strain names and expand DB to ~12K strains.

STEP 1: Clean existing dirty names (weight suffixes, product names, brand prefixes)
STEP 2: Re-import from raw CSVs with MIN_FIELDS=1 to expand to ~12K
STEP 3: Run export script to regenerate strains.json

Usage:
    python scripts/clean_and_expand_strains.py
"""
import ast
import csv
import json
import random
import re
import shutil
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from cannalchemy.data.normalize import normalize_strain_name
from cannalchemy.data.schema import init_db
from rapidfuzz import fuzz, process as rfprocess

# ── Paths ────────────────────────────────────────────────────────────────────

KUSHY_CSV = ROOT / "data" / "raw" / "kushy_strains.csv"
CI_CSV = ROOT / "data" / "raw" / "cannabis_intel_strains.csv"
DB_PATH = ROOT / "data" / "processed" / "cannalchemy.db"
DB_BACKUP = ROOT / "data" / "processed" / "cannalchemy.db.bak"

# ── Constants from import_partial_strains.py ─────────────────────────────────

KUSHY_SOURCE_PARTIAL = "kushy-partial"
KUSHY_SOURCE_SEARCH = "kushy-search"
CI_SOURCE_PARTIAL = "cannabis-intel-partial"
CI_SOURCE_SEARCH = "cannabis-intel-search"

DECAY_FACTORS = [1.0, 0.85, 0.70, 0.55, 0.40, 0.30, 0.20, 0.15, 0.10, 0.08]

KUSHY_POSITIVE_BASE = 60
KUSHY_MEDICAL_BASE = 40
KUSHY_NEGATIVE_BASE = 20
CI_POSITIVE_BASE = 45
CI_MEDICAL_BASE = 30
CI_NEGATIVE_BASE = 15

TERPENE_PCT_BY_POSITION = [0.40, 0.22, 0.13, 0.07, 0.03]

EFFECT_MAP = {
    "relaxed": "relaxed", "relaxing": "relaxed", "happy": "happy",
    "euphoric": "euphoric", "creative": "creative", "energetic": "energetic",
    "uplifted": "uplifted", "uplifting": "uplifted",
    "focused": "focused", "hungry": "hungry", "talkative": "talkative",
    "tingly": "tingly", "aroused": "aroused", "sleepy": "sleepy",
    "giggly": "giggly", "calm": "calm", "calming": "calm",
    "motivated": "motivated", "sedating": "sleepy", "cerebral": "head-high",
    "body high": "body-high", "mellow": "relaxed",
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
    "euphoric": "Mood elevation", "hungry": "Appetite stimulation",
}

NOT_IDEAL_RULES = {
    "sleepy": "Daytime productivity", "energetic": "Bedtime use",
    "paranoid": "Anxiety-prone users", "anxious": "High-stress situations",
    "dizzy": "Physical activities",
}

# ── Product terms that mark an entry for deletion ────────────────────────────

PRODUCT_TERMS = [
    "vape", "cartridge", "live resin", "sauce", "diamonds",
    "pre-roll", "pre roll", "packaged", " llr ", " lr ",
    # Also match at end of string
]

# Weight suffix pattern: trailing space + digits/decimal + G (case insensitive)
WEIGHT_SUFFIX_RE = re.compile(
    r'\s+(?:0?\.?\d+G|1G|05G|033G|10G|0\.5G|0\.33G|3\.5G)\s*$',
    re.IGNORECASE,
)


# ══════════════════════════════════════════════════════════════════════════════
# HELPERS
# ══════════════════════════════════════════════════════════════════════════════

def is_product_name(name: str) -> bool:
    """Check if a strain name is actually a product description."""
    name_lower = name.lower()
    for term in ["vape", "cartridge", "live resin", "sauce", "diamonds",
                  "pre-roll", "pre roll", "packaged"]:
        if term in name_lower:
            return True
    # Check for " llr" or " lr" as separate words (product type)
    if re.search(r'\bllr\b', name_lower) or re.search(r'\blr\b', name_lower):
        return True
    return False


def clean_strain_name(name: str) -> str | None:
    """Clean a strain name. Returns None if it should be deleted (product name).

    1. Handle pipe-separated names: extract strain part
    2. Remove weight suffixes
    3. Check if it's a product name -> return None
    """
    name = name.strip()
    if not name:
        return None

    # Handle pipe-separated names (brand | product | strain)
    if " | " in name or "|" in name:
        parts = [p.strip() for p in name.split("|") if p.strip()]
        # Try to find the actual strain name among the parts
        # Usually the last meaningful part that isn't a brand/product
        strain_part = None
        for part in reversed(parts):
            if not is_product_name(part) and not WEIGHT_SUFFIX_RE.search(part):
                # Check it's not just a brand name (very short or known brand patterns)
                cleaned = WEIGHT_SUFFIX_RE.sub('', part).strip()
                if cleaned and len(cleaned) > 1:
                    strain_part = cleaned
                    break
        if strain_part is None:
            return None  # All parts are product names
        name = strain_part

    # Remove weight suffixes
    name = WEIGHT_SUFFIX_RE.sub('', name).strip()

    # Check if the remaining name is a product name
    if is_product_name(name):
        return None

    # Final cleanup
    name = name.strip()
    if not name or len(name) < 2:
        return None

    return name


def weighted_report_count(base: int, position: int, jitter: float = 0.10) -> int:
    factor = DECAY_FACTORS[min(position, len(DECAY_FACTORS) - 1)]
    count = int(base * factor)
    jitter_amount = max(1, int(count * jitter))
    count += random.randint(-jitter_amount, jitter_amount)
    return max(2, count)


def parse_comma_list(value: str) -> list[str]:
    if not value or not value.strip():
        return []
    return [item.strip() for item in value.split(",") if item.strip()]


def parse_python_list(value: str) -> list[str]:
    """Parse a Python list literal like ['a', 'b'] into a list of strings."""
    if not value or not value.strip():
        return []
    value = value.strip()
    if value.startswith("["):
        try:
            result = ast.literal_eval(value)
            if isinstance(result, list):
                return [str(x).strip() for x in result if str(x).strip()]
        except (ValueError, SyntaxError):
            pass
    # Fallback: comma separated
    return parse_comma_list(value)


def parse_float(value: str) -> float | None:
    if not value or not value.strip():
        return None
    try:
        val = float(value.strip().replace("%", ""))
        return val if val > 0 else None
    except (ValueError, TypeError):
        return None


def get_or_create_effect(conn: sqlite3.Connection, name: str, category: str) -> int:
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


# ══════════════════════════════════════════════════════════════════════════════
# STEP 1: Clean dirty strain names
# ══════════════════════════════════════════════════════════════════════════════

def _score_strain(conn, sid):
    """Score a strain by data richness for dedup decisions."""
    effect_count = conn.execute(
        "SELECT COUNT(*) FROM effect_reports WHERE strain_id = ?", (sid,)
    ).fetchone()[0]
    comp_count = conn.execute(
        "SELECT COUNT(*) FROM strain_compositions WHERE strain_id = ?", (sid,)
    ).fetchone()[0]
    meta_count = conn.execute(
        "SELECT COUNT(*) FROM strain_metadata WHERE strain_id = ?", (sid,)
    ).fetchone()[0]
    flavor_count = conn.execute(
        "SELECT COUNT(*) FROM strain_flavors WHERE strain_id = ?", (sid,)
    ).fetchone()[0]
    dq = conn.execute(
        "SELECT data_quality FROM strains WHERE id = ?", (sid,)
    ).fetchone()[0]
    quality_bonus = 1000 if dq == "full" else (500 if dq == "partial" else 0)
    return effect_count + comp_count + meta_count + flavor_count + quality_bonus


def step1_clean_dirty_names(conn: sqlite3.Connection) -> dict:
    """Clean dirty strain names in the existing DB.

    Strategy: First compute what every strain's clean name would be,
    then group by target (clean_normalized_name), pick the best strain
    in each group, delete the rest, and finally rename survivors.
    This avoids UNIQUE constraint violations during UPDATE.

    Returns stats dict with counts of what was done.
    """
    print("\n" + "=" * 60)
    print("STEP 1: CLEAN DIRTY STRAIN NAMES")
    print("=" * 60)

    stats = {
        "deleted_product": 0,
        "cleaned_suffix": 0,
        "cleaned_pipe": 0,
        "deduped_merged": 0,
        "total_deleted": 0,
    }

    # Get all strains
    all_strains = conn.execute(
        "SELECT id, name, normalized_name, data_quality, source FROM strains"
    ).fetchall()
    print(f"  Total strains before cleaning: {len(all_strains)}")

    # Phase 1: Classify each strain
    to_delete_product = []  # strain IDs for product names
    # Map: target_normalized_name -> list of (sid, clean_display_name, source, was_renamed)
    target_groups = {}

    for sid, name, norm_name, dq, source in all_strains:
        cleaned = clean_strain_name(name)
        if cleaned is None:
            to_delete_product.append(sid)
            stats["deleted_product"] += 1
            continue

        target_norm = normalize_strain_name(cleaned)
        if not target_norm:
            to_delete_product.append(sid)
            stats["deleted_product"] += 1
            continue

        was_renamed = (cleaned != name)
        if was_renamed:
            if " | " in name or "|" in name:
                stats["cleaned_pipe"] += 1
            else:
                stats["cleaned_suffix"] += 1

        if target_norm not in target_groups:
            target_groups[target_norm] = []
        target_groups[target_norm].append((sid, cleaned, source, was_renamed))

    print(f"  Product names to delete: {stats['deleted_product']}")
    print(f"  Names to clean (pipe):   {stats['cleaned_pipe']}")
    print(f"  Names to clean (suffix): {stats['cleaned_suffix']}")

    # Phase 2: Delete product-name strains
    if to_delete_product:
        _delete_strains(conn, to_delete_product)
        stats["total_deleted"] += len(to_delete_product)
        print(f"  Deleted {len(to_delete_product)} product-name strains")

    # Phase 3: For each target group, if multiple strains map to the same
    # normalized name, keep the best and delete the rest. Then rename the keeper.
    print("\n  Deduplicating and renaming...")
    dedup_groups = 0
    for target_norm, members in target_groups.items():
        if len(members) == 1:
            # No conflict - just rename if needed
            sid, clean_name, source, was_renamed = members[0]
            if was_renamed:
                conn.execute(
                    "UPDATE strains SET name = ?, normalized_name = ? WHERE id = ?",
                    (clean_name, target_norm, sid),
                )
        else:
            # Multiple strains map to same target name -> dedup
            dedup_groups += 1
            # Score each
            scored = []
            for sid, clean_name, source, was_renamed in members:
                score = _score_strain(conn, sid)
                scored.append((sid, clean_name, source, was_renamed, score))

            scored.sort(key=lambda x: x[4], reverse=True)
            keeper = scored[0]
            losers = scored[1:]

            # Delete losers
            loser_ids = [s[0] for s in losers]
            _delete_strains(conn, loser_ids)
            stats["deduped_merged"] += len(loser_ids)
            stats["total_deleted"] += len(loser_ids)

            # Rename keeper if needed
            keeper_sid, keeper_clean_name, _, keeper_was_renamed, _ = keeper
            if keeper_was_renamed:
                conn.execute(
                    "UPDATE strains SET name = ?, normalized_name = ? WHERE id = ?",
                    (keeper_clean_name, target_norm, keeper_sid),
                )

    print(f"  Duplicate groups resolved: {dedup_groups}")

    conn.commit()

    # Final count
    remaining = conn.execute("SELECT COUNT(*) FROM strains").fetchone()[0]
    print(f"\n  Strains after Step 1: {remaining}")
    print(f"  Total deleted: {stats['total_deleted']}")
    print(f"    - Product names:     {stats['deleted_product']}")
    print(f"    - Dedup merges:      {stats['deduped_merged']}")
    print(f"  Names cleaned:         {stats['cleaned_suffix'] + stats['cleaned_pipe']}")

    return stats


def _delete_strains(conn: sqlite3.Connection, strain_ids: list[int]):
    """Delete strains and all their related rows from child tables."""
    if not strain_ids:
        return

    # Process in batches to avoid SQLite variable limit
    batch_size = 500
    for i in range(0, len(strain_ids), batch_size):
        batch = strain_ids[i:i + batch_size]
        placeholders = ",".join("?" * len(batch))

        conn.execute(f"DELETE FROM strain_compositions WHERE strain_id IN ({placeholders})", batch)
        conn.execute(f"DELETE FROM effect_reports WHERE strain_id IN ({placeholders})", batch)
        conn.execute(f"DELETE FROM strain_metadata WHERE strain_id IN ({placeholders})", batch)
        conn.execute(f"DELETE FROM strain_flavors WHERE strain_id IN ({placeholders})", batch)
        conn.execute(f"DELETE FROM strain_aliases WHERE alias_strain_id IN ({placeholders})", batch)
        conn.execute(f"DELETE FROM strain_aliases WHERE canonical_strain_id IN ({placeholders})", batch)
        conn.execute(f"DELETE FROM strains WHERE id IN ({placeholders})", batch)


# ══════════════════════════════════════════════════════════════════════════════
# STEP 2: Import from raw CSVs with MIN_FIELDS=1
# ══════════════════════════════════════════════════════════════════════════════

def step2_expand_from_csvs(conn: sqlite3.Connection) -> dict:
    """Re-import from raw CSVs with low threshold to expand to ~12K strains."""
    print("\n" + "=" * 60)
    print("STEP 2: EXPAND FROM RAW CSVs (MIN_FIELDS=1)")
    print("=" * 60)

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
    original_names_for_fuzzy = list(known_names)
    print(f"  Existing strains in DB: {len(known_names)}")

    kushy_count = _import_kushy_expanded(conn, name_to_id, known_names, original_names_for_fuzzy)
    ci_count = _import_ci_expanded(conn, name_to_id, known_names, original_names_for_fuzzy)

    # Update data_sources
    conn.execute(
        "INSERT OR REPLACE INTO data_sources (name, source_type, url, notes, record_count) "
        "VALUES (?, 'csv', '', 'Kushy partial strains (expanded, community data)', ?)",
        (KUSHY_SOURCE_PARTIAL, kushy_count["partial"]),
    )
    conn.execute(
        "INSERT OR REPLACE INTO data_sources (name, source_type, url, notes, record_count) "
        "VALUES (?, 'csv', '', 'Kushy search-only strains (name only or minimal data)', ?)",
        (KUSHY_SOURCE_SEARCH, kushy_count["search_only"]),
    )
    conn.execute(
        "INSERT OR REPLACE INTO data_sources (name, source_type, url, notes, record_count) "
        "VALUES (?, 'csv', '', 'Cannabis Intel partial strains (expanded)', ?)",
        (CI_SOURCE_PARTIAL, ci_count["partial"]),
    )
    conn.execute(
        "INSERT OR REPLACE INTO data_sources (name, source_type, url, notes, record_count) "
        "VALUES (?, 'csv', '', 'Cannabis Intel search-only strains (name only)', ?)",
        (CI_SOURCE_SEARCH, ci_count["search_only"]),
    )
    conn.commit()

    return {
        "kushy_partial": kushy_count["partial"],
        "kushy_search": kushy_count["search_only"],
        "ci_partial": ci_count["partial"],
        "ci_search": ci_count["search_only"],
    }


def _import_kushy_expanded(conn, name_to_id, known_names, original_names_for_fuzzy):
    """Import Kushy strains with MIN_FIELDS=1."""
    print("\n── Importing Kushy strains (expanded) ──")

    if not KUSHY_CSV.exists():
        print(f"  SKIP: {KUSHY_CSV} not found")
        return {"partial": 0, "search_only": 0}

    with open(KUSHY_CSV, encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    print(f"  CSV rows: {len(rows)}")

    # Pre-compute fuzzy exclusions against ORIGINAL db strains
    print("  Pre-computing fuzzy dedup against existing DB strains...")
    fuzzy_reject = set()
    candidates = []
    for row in rows:
        name = (row.get("name") or "").strip()
        if not name:
            continue
        # Apply name cleaning
        cleaned = clean_strain_name(name)
        if cleaned is None:
            continue
        normalized = normalize_strain_name(cleaned)
        if not normalized:
            continue
        if normalized in name_to_id:
            continue
        candidates.append((normalized, cleaned, row))

    if original_names_for_fuzzy:
        for i, (normalized, _cleaned, _row) in enumerate(candidates):
            match = rfprocess.extractOne(
                normalized, original_names_for_fuzzy,
                scorer=fuzz.ratio, score_cutoff=85.0,
            )
            if match:
                fuzzy_reject.add(normalized)
            if (i + 1) % 2000 == 0:
                print(f"    ... fuzzy checked {i + 1}/{len(candidates)}")
    print(f"  Fuzzy rejects: {len(fuzzy_reject)}")

    stats = {"partial": 0, "search_only": 0, "skipped_dup": 0,
             "skipped_noname": 0, "skipped_product": 0}

    for row in rows:
        name = (row.get("name") or "").strip()
        if not name:
            stats["skipped_noname"] += 1
            continue

        cleaned = clean_strain_name(name)
        if cleaned is None:
            stats["skipped_product"] += 1
            continue

        normalized = normalize_strain_name(cleaned)
        if not normalized:
            stats["skipped_noname"] += 1
            continue

        if normalized in name_to_id:
            stats["skipped_dup"] += 1
            continue

        if normalized in fuzzy_reject:
            stats["skipped_dup"] += 1
            continue

        coverage = kushy_coverage_score(row)
        # MIN_FIELDS = 1 (was 3)
        if coverage < 1:
            stats["skipped_noname"] += 1
            continue

        data_quality = "partial" if coverage >= 3 else "search-only"
        source = KUSHY_SOURCE_PARTIAL if data_quality == "partial" else KUSHY_SOURCE_SEARCH

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

        cursor = conn.execute(
            "INSERT OR IGNORE INTO strains "
            "(name, normalized_name, strain_type, description, source, data_quality) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (cleaned, normalized, strain_type, description, source, data_quality),
        )
        if not cursor.lastrowid:
            stats["skipped_dup"] += 1
            continue

        strain_id = cursor.lastrowid
        name_to_id[normalized] = strain_id
        known_names.append(normalized)

        if data_quality == "partial":
            stats["partial"] += 1
        else:
            stats["search_only"] += 1

        # For search-only strains, only add minimal data (type + default terpenes/cannabinoids)
        if data_quality == "search-only":
            # Add default terpenes so scoring engine can work
            for terp_name, pct in DEFAULT_TERPENES.get(strain_type, DEFAULT_TERPENES["hybrid"]):
                mol_id = get_molecule_id(conn, terp_name)
                if mol_id:
                    conn.execute(
                        "INSERT OR IGNORE INTO strain_compositions "
                        "(strain_id, molecule_id, percentage, measurement_type, source) "
                        "VALUES (?, ?, ?, 'estimated', ?)",
                        (strain_id, mol_id, pct, source),
                    )
            # Add default cannabinoids
            defaults = DEFAULT_CANNABINOIDS.get(strain_type, DEFAULT_CANNABINOIDS["hybrid"])
            for cname, cval in defaults.items():
                mol_id = get_molecule_id(conn, cname)
                if mol_id:
                    conn.execute(
                        "INSERT OR IGNORE INTO strain_compositions "
                        "(strain_id, molecule_id, percentage, measurement_type, source) "
                        "VALUES (?, ?, ?, 'estimated', ?)",
                        (strain_id, mol_id, cval, source),
                    )
            # Minimal metadata
            consumption = CONSUMPTION_BY_TYPE.get(strain_type, CONSUMPTION_BY_TYPE["hybrid"])
            conn.execute(
                "INSERT OR REPLACE INTO strain_metadata "
                "(strain_id, consumption_suitability, price_range, best_for, "
                "not_ideal_for, genetics, lineage, description_extended) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (strain_id, json.dumps(consumption), "mid",
                 "[]", "[]", "", json.dumps({"self": cleaned}), ""),
            )
            continue  # skip detailed import for search-only

        # ── Full partial import (coverage >= 3) ──────────────────────────

        # Effects
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
                (strain_id, eff_id, rc, source),
            )

        # Ailments
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
                    (strain_id, eff_id, rc, source),
                )

        # Negatives
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
                    (strain_id, eff_id, rc, source),
                )

        # Terpenes
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
                    (strain_id, mol_id, pct, source),
                )

        # Cannabinoids
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
                        (strain_id, mol_id, cval, source),
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
                        (strain_id, mol_id, cval, source),
                    )

        # Flavors
        flavors_raw = parse_comma_list(row.get("flavor", ""))
        for flavor in flavors_raw:
            flavor_clean = flavor.strip().lower()
            if flavor_clean:
                conn.execute(
                    "INSERT OR IGNORE INTO strain_flavors (strain_id, flavor) VALUES (?, ?)",
                    (strain_id, flavor_clean),
                )

        # Metadata
        best_for = infer_best_for(mapped_effects)
        not_ideal = infer_not_ideal(mapped_effects)
        consumption = CONSUMPTION_BY_TYPE.get(strain_type, CONSUMPTION_BY_TYPE["hybrid"])

        crosses = (row.get("crosses") or "").strip()
        lineage = {"self": cleaned}
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
                json.dumps(consumption), "mid",
                json.dumps(best_for), json.dumps(not_ideal),
                crosses, json.dumps(lineage),
                description[:200] if description else "",
            ),
        )

        total_created = stats["partial"] + stats["search_only"]
        if total_created % 500 == 0 and total_created > 0:
            print(f"    ... {total_created} Kushy strains imported")
            conn.commit()

    conn.commit()

    print(f"  Kushy partials created:     {stats['partial']}")
    print(f"  Kushy search-only created:  {stats['search_only']}")
    print(f"  Skipped (no name):          {stats['skipped_noname']}")
    print(f"  Skipped (product name):     {stats['skipped_product']}")
    print(f"  Skipped (duplicate):        {stats['skipped_dup']}")

    return stats


def _import_ci_expanded(conn, name_to_id, known_names, original_names_for_fuzzy):
    """Import Cannabis Intelligence strains with MIN_FIELDS=1."""
    print("\n── Importing Cannabis Intelligence strains (expanded) ──")

    if not CI_CSV.exists():
        print(f"  SKIP: {CI_CSV} not found")
        return {"partial": 0, "search_only": 0}

    with open(CI_CSV, encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    print(f"  CSV rows: {len(rows)}")

    # Pre-compute fuzzy exclusions
    print("  Pre-computing fuzzy dedup against existing DB strains...")
    fuzzy_reject = set()
    candidates = []
    for row in rows:
        name = (row.get("strain_name") or "").strip()
        if not name:
            continue
        cleaned = clean_strain_name(name)
        if cleaned is None:
            continue
        normalized = normalize_strain_name(cleaned)
        if not normalized:
            continue
        if normalized in name_to_id:
            continue
        candidates.append((normalized, cleaned, row))

    if original_names_for_fuzzy:
        for i, (normalized, _cleaned, _row) in enumerate(candidates):
            match = rfprocess.extractOne(
                normalized, original_names_for_fuzzy,
                scorer=fuzz.ratio, score_cutoff=85.0,
            )
            if match:
                fuzzy_reject.add(normalized)
            if (i + 1) % 2000 == 0:
                print(f"    ... fuzzy checked {i + 1}/{len(candidates)}")
    print(f"  Fuzzy rejects: {len(fuzzy_reject)}")

    stats = {"partial": 0, "search_only": 0, "skipped_dup": 0,
             "skipped_noname": 0, "skipped_product": 0}

    for row in rows:
        name = (row.get("strain_name") or "").strip()
        if not name:
            stats["skipped_noname"] += 1
            continue

        cleaned = clean_strain_name(name)
        if cleaned is None:
            stats["skipped_product"] += 1
            continue

        normalized = normalize_strain_name(cleaned)
        if not normalized:
            stats["skipped_noname"] += 1
            continue

        if normalized in name_to_id:
            stats["skipped_dup"] += 1
            continue

        if normalized in fuzzy_reject:
            stats["skipped_dup"] += 1
            continue

        coverage = ci_coverage_score(row)
        if coverage < 1:
            stats["skipped_noname"] += 1
            continue

        data_quality = "partial" if coverage >= 3 else "search-only"
        source = CI_SOURCE_PARTIAL if data_quality == "partial" else CI_SOURCE_SEARCH

        # Determine type
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

        cursor = conn.execute(
            "INSERT OR IGNORE INTO strains "
            "(name, normalized_name, strain_type, description, source, data_quality) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (cleaned, normalized, strain_type, description, source, data_quality),
        )
        if not cursor.lastrowid:
            stats["skipped_dup"] += 1
            continue

        strain_id = cursor.lastrowid
        name_to_id[normalized] = strain_id
        known_names.append(normalized)

        if data_quality == "partial":
            stats["partial"] += 1
        else:
            stats["search_only"] += 1

        # For search-only, add minimal data
        if data_quality == "search-only":
            for terp_name, pct in DEFAULT_TERPENES.get(strain_type, DEFAULT_TERPENES["hybrid"]):
                mol_id = get_molecule_id(conn, terp_name)
                if mol_id:
                    conn.execute(
                        "INSERT OR IGNORE INTO strain_compositions "
                        "(strain_id, molecule_id, percentage, measurement_type, source) "
                        "VALUES (?, ?, ?, 'estimated', ?)",
                        (strain_id, mol_id, pct, source),
                    )
            defaults = DEFAULT_CANNABINOIDS.get(strain_type, DEFAULT_CANNABINOIDS["hybrid"])
            for cname, cval in defaults.items():
                mol_id = get_molecule_id(conn, cname)
                if mol_id:
                    conn.execute(
                        "INSERT OR IGNORE INTO strain_compositions "
                        "(strain_id, molecule_id, percentage, measurement_type, source) "
                        "VALUES (?, ?, ?, 'estimated', ?)",
                        (strain_id, mol_id, cval, source),
                    )
            consumption = CONSUMPTION_BY_TYPE.get(strain_type, CONSUMPTION_BY_TYPE["hybrid"])
            conn.execute(
                "INSERT OR REPLACE INTO strain_metadata "
                "(strain_id, consumption_suitability, price_range, best_for, "
                "not_ideal_for, genetics, lineage, description_extended) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (strain_id, json.dumps(consumption), "mid",
                 "[]", "[]", "", json.dumps({"self": cleaned}), ""),
            )
            continue

        # ── Full partial import (coverage >= 3) ──────────────────────────

        # Effects - CI uses Python list syntax ['relaxing', 'uplifting']
        effects_raw = parse_python_list(row.get("effects", ""))
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
                (strain_id, eff_id, rc, source),
            )

        # Terpenes
        terpenes_raw = parse_python_list(row.get("terpenes", ""))
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
                    (strain_id, mol_id, pct, source),
                )

        # Cannabinoids
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
                    (strain_id, mol_id, min(thc_val, 35.0), source),
                )
                has_cannabinoid = True
        if cbd_val:
            mol_id = get_molecule_id(conn, "cbd")
            if mol_id:
                conn.execute(
                    "INSERT OR IGNORE INTO strain_compositions "
                    "(strain_id, molecule_id, percentage, measurement_type, source) "
                    "VALUES (?, ?, ?, 'reported', ?)",
                    (strain_id, mol_id, min(cbd_val, 20.0), source),
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
                        (strain_id, mol_id, cval, source),
                    )

        # Flavors - CI uses Python list syntax
        flavors_raw = parse_python_list(row.get("flavors", ""))
        for flavor in flavors_raw:
            flavor_clean = flavor.strip().lower()
            if flavor_clean:
                conn.execute(
                    "INSERT OR IGNORE INTO strain_flavors (strain_id, flavor) VALUES (?, ?)",
                    (strain_id, flavor_clean),
                )

        # Metadata
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
                json.dumps(consumption), "mid",
                json.dumps(best_for), json.dumps(not_ideal),
                "", json.dumps({"self": cleaned}),
                description[:200] if description else "",
            ),
        )

        total_created = stats["partial"] + stats["search_only"]
        if total_created % 500 == 0 and total_created > 0:
            print(f"    ... {total_created} CI strains imported")
            conn.commit()

    conn.commit()

    print(f"  CI partials created:        {stats['partial']}")
    print(f"  CI search-only created:     {stats['search_only']}")
    print(f"  Skipped (no name):          {stats['skipped_noname']}")
    print(f"  Skipped (product name):     {stats['skipped_product']}")
    print(f"  Skipped (duplicate):        {stats['skipped_dup']}")

    return stats


# ══════════════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════════════

def main():
    print("=" * 60)
    print("CLEAN & EXPAND STRAIN DATABASE")
    print("=" * 60)
    print(f"  DB:     {DB_PATH}")
    print(f"  Backup: {DB_BACKUP}")
    print()

    # ── Backup ───────────────────────────────────────────────────────────
    if not DB_PATH.exists():
        print("ERROR: Database not found!")
        sys.exit(1)

    print("Creating backup...")
    shutil.copy2(DB_PATH, DB_BACKUP)
    print(f"  Backed up to {DB_BACKUP}")
    backup_size = DB_BACKUP.stat().st_size
    print(f"  Backup size: {backup_size:,} bytes ({backup_size / 1_000_000:.1f} MB)")

    # ── Connect ──────────────────────────────────────────────────────────
    conn = init_db(str(DB_PATH))

    # Ensure data_quality column exists before Step 1
    cols = [row[1] for row in conn.execute("PRAGMA table_info(strains)").fetchall()]
    if "data_quality" not in cols:
        conn.execute("ALTER TABLE strains ADD COLUMN data_quality TEXT DEFAULT 'full'")
        conn.execute("UPDATE strains SET data_quality = 'full' WHERE data_quality IS NULL")
        conn.commit()

    try:
        # ── Step 1: Clean dirty names ────────────────────────────────────
        step1_stats = step1_clean_dirty_names(conn)

        # ── Step 2: Expand from CSVs ─────────────────────────────────────
        step2_stats = step2_expand_from_csvs(conn)

        conn.commit()

    except Exception as e:
        print(f"\nERROR: {e}")
        print("Rolling back changes...")
        conn.close()
        # Restore from backup
        shutil.copy2(DB_BACKUP, DB_PATH)
        print("Database restored from backup.")
        raise

    # ── Final stats ──────────────────────────────────────────────────────
    total_full = conn.execute(
        "SELECT COUNT(*) FROM strains WHERE data_quality = 'full'"
    ).fetchone()[0]
    total_partial = conn.execute(
        "SELECT COUNT(*) FROM strains WHERE data_quality = 'partial'"
    ).fetchone()[0]
    total_search = conn.execute(
        "SELECT COUNT(*) FROM strains WHERE data_quality = 'search-only'"
    ).fetchone()[0]
    total = conn.execute("SELECT COUNT(*) FROM strains").fetchone()[0]

    conn.close()

    print("\n" + "=" * 60)
    print("ALL STEPS COMPLETE")
    print("=" * 60)
    print(f"  Step 1 - Deleted dirty:      {step1_stats['total_deleted']}")
    print(f"  Step 1 - Names cleaned:      {step1_stats['cleaned_suffix'] + step1_stats['cleaned_pipe']}")
    print(f"  Step 2 - Kushy partials:     {step2_stats['kushy_partial']}")
    print(f"  Step 2 - Kushy search-only:  {step2_stats['kushy_search']}")
    print(f"  Step 2 - CI partials:        {step2_stats['ci_partial']}")
    print(f"  Step 2 - CI search-only:     {step2_stats['ci_search']}")
    print(f"  ─────────────────────────────")
    print(f"  Full-data strains:           {total_full}")
    print(f"  Partial-data strains:        {total_partial}")
    print(f"  Search-only strains:         {total_search}")
    print(f"  TOTAL STRAINS IN DB:         {total}")
    print("=" * 60)


if __name__ == "__main__":
    main()
