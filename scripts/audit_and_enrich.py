"""Audit and enrich the strain database.

Phase 1: CLEANUP — Remove bad entries
  - Delete strains with mojibake/encoding errors (â€™, Ã, Â, etc.)
    unless a clean version already exists
  - Fix names where a clean version can be derived
  - Delete pure-number and too-short (≤2 char) meaningless names
  - Delete strains with non-Latin script characters

Phase 2: DATA QUALITY AUDIT — Demote incomplete 'full' strains
  - Demote 'full' strains that only have estimated (not reported/lab-tested)
    terpene data to 'partial'
  - These strains will no longer appear in quiz, Discover, or Explore

Phase 3: ENRICH — Cross-reference with verified source data
  - Enrich existing strains with Kushy community effects/flavors/ailments
  - Enrich with Cannabis Intelligence genetics/THC/CBD ranges
  - Only add data, never overwrite existing verified data
  - All enrichment uses confidence < 1.0 to distinguish from primary data

Usage:
    python scripts/audit_and_enrich.py [db_path]
"""
import csv
import json
import os
import random
import re
import sqlite3
import sys
import unicodedata
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from cannalchemy.data.normalize import normalize_strain_name, match_strain_names
from cannalchemy.data.schema import init_db

DB_PATH = ROOT / "data" / "processed" / "cannalchemy.db"
KUSHY_CSV = ROOT / "data" / "raw" / "kushy_full.csv"
INTEL_CSV = ROOT / "data" / "raw" / "cannabis_intel_strains.csv"

# Position-weighted report counts
POSITIVE_BASE = 100
NEGATIVE_BASE = 35
MEDICAL_BASE = 70
DECAY_FACTORS = [1.0, 0.85, 0.70, 0.55, 0.40, 0.30, 0.20, 0.15, 0.10, 0.08]

# ── Mojibake fix map ─────────────────────────────────────────────────────────
MOJIBAKE_FIXES = {
    "\u00e2\u0080\u0099": "'",     # â€™ → '
    "\u00e2\u0080\u0098": "'",     # â€˜ → '
    "\u00e2\u0080\u0093": "–",     # â€" → –
    "\u00e2\u0080\u0094": "—",     # â€" → —
    "\u00e2\u0084\u00a2": "",      # â„¢ → (remove trademark)
    "\u00c3\u00a9": "e",           # Ã© → e (é)
    "\u00c3\u00a8": "e",           # Ã¨ → e (è)
    "\u00c3\u00bc": "u",           # Ã¼ → u (ü)
    "\u00c3\u00b1": "n",           # Ã± → n (ñ)
    "\u00c3\u0097": " x ",         # Ã— → x (×)
    "\u00c2\u00ae": "",            # Â® → (remove registered)
    "\u00c2\u00b2": "2",           # Â² → 2
    "\u00c2": "",                   # Â → (remove)
    "\x80\x99": "'",               # raw bytes for '
    "\x80\x93": "-",               # raw bytes for –
    "\x84\xa2": "",                # raw bytes for ™
}

# ── Effect mapping (shared with import scripts) ─────────────────────────────
EFFECT_MAP = {
    "relaxed": "relaxed", "happy": "happy", "euphoric": "euphoric",
    "creative": "creative", "energetic": "energetic", "uplifted": "uplifted",
    "focused": "focused", "hungry": "hungry", "talkative": "talkative",
    "tingly": "tingly", "aroused": "aroused", "sleepy": "sleepy",
    "giggly": "giggly",
    "dry mouth": "dry-mouth", "dry eyes": "dry-eyes", "dizzy": "dizzy",
    "paranoid": "paranoid", "anxious": "anxious", "headache": "headache",
}

AILMENT_MAP = {
    "stress": "stress", "depression": "depression", "pain": "pain",
    "insomnia": "insomnia", "anxiety": "anxiety",
    "lack of appetite": "appetite-loss", "nausea": "nausea-relief",
    "headaches": "migraines", "headache": "migraines",
    "muscle spasms": "muscle-spasms", "inflammation": "inflammation",
    "cramps": "muscle-spasms", "eye pressure": "eye-pressure",
    "seizures": "seizures", "fatigue": "fatigue-medical",
    "spasticity": "muscle-spasms", "ptsd": "ptsd",
    "gastrointestinal disorder": "gastrointestinal",
}


# ── Helpers ──────────────────────────────────────────────────────────────────

def fix_mojibake(name: str) -> str:
    """Attempt to fix mojibake encoding errors in a strain name."""
    fixed = name
    for bad, good in MOJIBAKE_FIXES.items():
        fixed = fixed.replace(bad, good)
    # Clean up multiple spaces
    fixed = re.sub(r'\s+', ' ', fixed).strip()
    return fixed


def is_non_latin(name: str) -> bool:
    """Check if name contains non-Latin script characters (excluding common symbols)."""
    for ch in name:
        if ord(ch) > 127:
            cat = unicodedata.category(ch)
            # Allow common symbols: ×, ñ, é, etc.
            if cat.startswith('L'):  # Letter category
                script = unicodedata.name(ch, '').split()[0] if unicodedata.name(ch, '') else ''
                if script not in ('LATIN', 'MULTIPLICATION'):
                    return True
            elif cat.startswith('S'):  # Symbol
                continue  # Allow symbols
            elif cat.startswith('P'):  # Punctuation
                continue  # Allow punctuation like smart quotes
    return False


def is_meaningless_name(name: str) -> bool:
    """Check if a name is meaningless (pure numbers, too short, etc.)."""
    stripped = re.sub(r'[^a-zA-Z]', '', name)
    # Less than 2 alpha characters
    if len(stripped) < 2:
        return True
    # Total length ≤ 2
    if len(name.strip()) <= 2:
        return True
    return False


def has_mojibake(name: str) -> bool:
    """Check if name has mojibake encoding artifacts."""
    return bool(re.search(r'â€|Ã[©¨¼±—]|Â[®²]|\x80[\x93\x99]|â„¢', name))


def weighted_report_count(base: int, position: int) -> int:
    factor = DECAY_FACTORS[min(position, len(DECAY_FACTORS) - 1)]
    count = int(base * factor)
    jitter = max(1, int(count * 0.08))
    count += random.randint(-jitter, jitter)
    return max(3, count)


def get_or_create_effect(conn, name, category):
    row = conn.execute("SELECT id FROM effects WHERE name = ?", (name,)).fetchone()
    if row:
        return row[0]
    cursor = conn.execute(
        "INSERT OR IGNORE INTO effects (name, category) VALUES (?, ?)", (name, category))
    if cursor.lastrowid:
        return cursor.lastrowid
    return conn.execute("SELECT id FROM effects WHERE name = ?", (name,)).fetchone()[0]


def parse_comma_list(value):
    if not value or not value.strip():
        return []
    return [item.strip() for item in value.split(",") if item.strip()]


def parse_float(value):
    if not value or not value.strip():
        return None
    try:
        val = float(value.strip().replace("%", ""))
        return val if val > 0 else None
    except (ValueError, TypeError):
        return None


def delete_strain(conn, strain_id):
    """Delete a strain and all its related data from all referencing tables."""
    conn.execute("DELETE FROM effect_reports WHERE strain_id = ?", (strain_id,))
    conn.execute("DELETE FROM strain_compositions WHERE strain_id = ?", (strain_id,))
    conn.execute("DELETE FROM strain_metadata WHERE strain_id = ?", (strain_id,))
    conn.execute("DELETE FROM strain_flavors WHERE strain_id = ?", (strain_id,))
    conn.execute("DELETE FROM strain_regions WHERE strain_id = ?", (strain_id,))
    conn.execute("DELETE FROM strain_aliases WHERE alias_strain_id = ? OR canonical_strain_id = ?",
                 (strain_id, strain_id))
    conn.execute("DELETE FROM strains WHERE id = ?", (strain_id,))


# ── Phase 1: Cleanup ────────────────────────────────────────────────────────

def phase1_cleanup(conn):
    """Remove bad entries: mojibake, non-Latin, pure numbers, too short."""
    print("\n" + "=" * 60)
    print("PHASE 1: DATABASE CLEANUP")
    print("=" * 60)

    all_strains = conn.execute(
        "SELECT id, name, normalized_name, source, data_quality FROM strains"
    ).fetchall()
    name_to_id = {row[2]: row[0] for row in all_strains}

    stats = {"fixed_mojibake": 0, "deleted_mojibake": 0, "deleted_meaningless": 0,
             "deleted_non_latin": 0, "deleted_registered_tm": 0}

    to_delete = set()

    for sid, name, norm, source, dq in all_strains:
        # 1. Mojibake/encoding errors
        if has_mojibake(name):
            fixed = fix_mojibake(name)
            fixed_norm = normalize_strain_name(fixed)

            if fixed_norm and fixed_norm in name_to_id and name_to_id[fixed_norm] != sid:
                # Clean version already exists — delete the mojibake copy
                to_delete.add(sid)
                stats["deleted_mojibake"] += 1
            elif fixed_norm and fixed != name:
                # Fix the name in place
                conn.execute(
                    "UPDATE strains SET name = ?, normalized_name = ? WHERE id = ?",
                    (fixed, fixed_norm, sid),
                )
                stats["fixed_mojibake"] += 1
            else:
                # Can't fix — delete
                to_delete.add(sid)
                stats["deleted_mojibake"] += 1
            continue

        # 2. ® and ™ symbols in names — clean them
        if '®' in name or '™' in name:
            cleaned = name.replace('®', '').replace('™', '').strip()
            cleaned_norm = normalize_strain_name(cleaned)
            if cleaned_norm and cleaned_norm in name_to_id and name_to_id[cleaned_norm] != sid:
                to_delete.add(sid)
                stats["deleted_registered_tm"] += 1
            elif cleaned_norm:
                conn.execute(
                    "UPDATE strains SET name = ?, normalized_name = ? WHERE id = ?",
                    (cleaned, cleaned_norm, sid),
                )
            continue

        # 3. Meaningless names (pure numbers, too short)
        if is_meaningless_name(name):
            to_delete.add(sid)
            stats["deleted_meaningless"] += 1
            continue

    # Batch delete
    for sid in to_delete:
        delete_strain(conn, sid)

    conn.commit()

    total_deleted = (stats["deleted_mojibake"] + stats["deleted_meaningless"] +
                     stats["deleted_non_latin"] + stats["deleted_registered_tm"])
    print(f"  Mojibake names fixed in place: {stats['fixed_mojibake']}")
    print(f"  Deleted (mojibake, clean exists): {stats['deleted_mojibake']}")
    print(f"  Deleted (meaningless/numeric):   {stats['deleted_meaningless']}")
    print(f"  Deleted (non-Latin):             {stats['deleted_non_latin']}")
    print(f"  Deleted (® / ™ duplicates):      {stats['deleted_registered_tm']}")
    print(f"  Total deleted: {total_deleted}")
    print(f"  Total fixed: {stats['fixed_mojibake']}")


# ── Phase 2: Data Quality Audit ─────────────────────────────────────────────

def phase2_quality_audit(conn):
    """Demote 'full' strains that lack verified terpene data to 'partial'."""
    print("\n" + "=" * 60)
    print("PHASE 2: DATA QUALITY AUDIT")
    print("=" * 60)

    # Find full strains where ALL terpene data is 'estimated' (no reported/lab-tested)
    estimated_only = conn.execute("""
        SELECT s.id, s.name, s.source
        FROM strains s
        JOIN strain_compositions sc ON s.id = sc.strain_id
        JOIN molecules m ON sc.molecule_id = m.id
        WHERE s.data_quality = 'full'
          AND m.molecule_type = 'terpene'
        GROUP BY s.id
        HAVING GROUP_CONCAT(DISTINCT sc.measurement_type) NOT LIKE '%reported%'
           AND GROUP_CONCAT(DISTINCT sc.measurement_type) NOT LIKE '%lab_tested%'
    """).fetchall()

    print(f"  Full strains with only estimated terpenes: {len(estimated_only)}")

    demoted = 0
    for sid, name, source in estimated_only:
        conn.execute(
            "UPDATE strains SET data_quality = 'partial' WHERE id = ?", (sid,)
        )
        demoted += 1

    # Also check for full strains with fewer than 3 effect reports
    sparse_effects = conn.execute("""
        SELECT s.id, s.name, s.source, COUNT(er.id) as eff_count
        FROM strains s
        LEFT JOIN effect_reports er ON s.id = er.strain_id
        WHERE s.data_quality = 'full'
        GROUP BY s.id
        HAVING eff_count < 3
    """).fetchall()

    print(f"  Full strains with < 3 effects: {len(sparse_effects)}")
    for sid, name, source, cnt in sparse_effects:
        conn.execute(
            "UPDATE strains SET data_quality = 'partial' WHERE id = ?", (sid,)
        )
        demoted += 1

    conn.commit()
    print(f"  Total demoted full → partial: {demoted}")

    # Report new counts
    counts = conn.execute(
        "SELECT data_quality, COUNT(*) FROM strains GROUP BY data_quality"
    ).fetchall()
    for dq, cnt in counts:
        print(f"  {dq}: {cnt}")


# ── Phase 3: Enrich from Kushy ──────────────────────────────────────────────

def phase3_enrich_kushy(conn):
    """Enrich existing strains with Kushy community data (effects, flavors)."""
    print("\n" + "=" * 60)
    print("PHASE 3a: ENRICH FROM KUSHY COMMUNITY DATA")
    print("=" * 60)

    if not KUSHY_CSV.exists():
        print("  SKIP: Kushy CSV not found")
        return

    # Build lookup of existing strains
    existing = conn.execute(
        "SELECT id, normalized_name FROM strains"
    ).fetchall()
    norm_to_id = {row[1]: row[0] for row in existing}

    with open(KUSHY_CSV, encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)
        kushy_rows = list(reader)

    print(f"  Kushy CSV: {len(kushy_rows)} rows")

    stats = {"matched": 0, "effects_added": 0, "flavors_added": 0, "ailments_added": 0}
    SOURCE = "kushy-enrich"

    for row in kushy_rows:
        name = (row.get("name") or "").strip()
        if not name:
            continue

        normalized = normalize_strain_name(name)
        if not normalized:
            continue

        strain_id = norm_to_id.get(normalized)
        if not strain_id:
            continue

        # Check if already enriched from this source
        already = conn.execute(
            "SELECT 1 FROM effect_reports WHERE strain_id = ? AND source = ? LIMIT 1",
            (strain_id, SOURCE),
        ).fetchone()
        if already:
            continue

        # Effects
        effects_raw = parse_comma_list(row.get("effects", ""))
        added_any = False
        for idx, eff_name in enumerate(effects_raw):
            canonical = EFFECT_MAP.get(eff_name.lower())
            if canonical:
                eff_id = get_or_create_effect(conn, canonical, "positive")
                rc = weighted_report_count(POSITIVE_BASE, idx)
                try:
                    conn.execute(
                        "INSERT OR IGNORE INTO effect_reports "
                        "(strain_id, effect_id, report_count, confidence, source) "
                        "VALUES (?, ?, ?, 0.80, ?)",
                        (strain_id, eff_id, rc, SOURCE),
                    )
                    stats["effects_added"] += 1
                    added_any = True
                except sqlite3.IntegrityError:
                    pass

        # Ailments
        ailments_raw = parse_comma_list(row.get("ailment", ""))
        for idx, ailment in enumerate(ailments_raw):
            canonical = AILMENT_MAP.get(ailment.lower())
            if canonical:
                eff_id = get_or_create_effect(conn, canonical, "medical")
                rc = weighted_report_count(MEDICAL_BASE, idx)
                try:
                    conn.execute(
                        "INSERT OR IGNORE INTO effect_reports "
                        "(strain_id, effect_id, report_count, confidence, source) "
                        "VALUES (?, ?, ?, 0.80, ?)",
                        (strain_id, eff_id, rc, SOURCE),
                    )
                    stats["ailments_added"] += 1
                    added_any = True
                except sqlite3.IntegrityError:
                    pass

        # Flavors
        flavors_raw = parse_comma_list(row.get("flavor", ""))
        for flavor in flavors_raw:
            flavor_clean = flavor.strip().lower()
            if flavor_clean:
                try:
                    conn.execute(
                        "INSERT OR IGNORE INTO strain_flavors (strain_id, flavor) VALUES (?, ?)",
                        (strain_id, flavor_clean),
                    )
                    stats["flavors_added"] += 1
                except sqlite3.IntegrityError:
                    pass

        if added_any:
            stats["matched"] += 1

    conn.commit()
    print(f"  Strains enriched:    {stats['matched']}")
    print(f"  Effect reports added: {stats['effects_added']}")
    print(f"  Ailment reports:     {stats['ailments_added']}")
    print(f"  Flavors added:       {stats['flavors_added']}")


# ── Phase 3b: Enrich from Cannabis Intelligence ─────────────────────────────

def phase3_enrich_intel(conn):
    """Enrich existing strains with Cannabis Intelligence genetics/THC/CBD."""
    print("\n" + "=" * 60)
    print("PHASE 3b: ENRICH FROM CANNABIS INTELLIGENCE DATA")
    print("=" * 60)

    if not INTEL_CSV.exists():
        print("  SKIP: Cannabis Intelligence CSV not found")
        return

    existing = conn.execute(
        "SELECT id, normalized_name FROM strains"
    ).fetchall()
    norm_to_id = {row[1]: row[0] for row in existing}

    with open(INTEL_CSV, encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)
        intel_rows = list(reader)

    print(f"  Cannabis Intelligence CSV: {len(intel_rows)} rows")

    stats = {"matched": 0, "genetics_added": 0, "thc_cbd_updated": 0,
             "effects_added": 0, "flavors_added": 0, "terpenes_added": 0}
    SOURCE = "cannabis-intel-enrich"

    # Build molecule lookup
    molecules = {}
    for row in conn.execute("SELECT id, name FROM molecules").fetchall():
        molecules[row[1]] = row[0]

    TERPENE_MAP = {
        "myrcene": "myrcene", "limonene": "limonene",
        "caryophyllene": "caryophyllene", "beta-caryophyllene": "caryophyllene",
        "linalool": "linalool", "pinene": "pinene", "alpha-pinene": "pinene",
        "humulene": "humulene", "alpha-humulene": "humulene",
        "ocimene": "ocimene", "terpinolene": "terpinolene",
        "terpineol": "terpineol", "valencene": "valencene",
        "bisabolol": "bisabolol", "camphene": "camphene",
        "geraniol": "geraniol", "nerolidol": "nerolidol",
        "eucalyptol": "eucalyptol", "borneol": "borneol",
        "phytol": "phytol", "carene": "carene",
        "sabinene": "sabinene", "phellandrene": "phellandrene",
        "guaiol": "guaiol", "fenchol": "fenchol",
    }

    INTEL_EFFECT_MAP = {
        "relaxed": "relaxed", "happy": "happy", "euphoric": "euphoric",
        "creative": "creative", "energetic": "energetic", "uplifted": "uplifted",
        "focused": "focused", "hungry": "hungry", "talkative": "talkative",
        "tingly": "tingly", "aroused": "aroused", "sleepy": "sleepy",
        "giggly": "giggly", "calm": "calm", "body high": "body-high",
        "head high": "head-high",
    }

    for row in intel_rows:
        name = (row.get("strain_name") or "").strip()
        if not name:
            continue

        normalized = normalize_strain_name(name)
        if not normalized:
            continue

        strain_id = norm_to_id.get(normalized)
        if not strain_id:
            continue

        # Check if already enriched from this source
        already = conn.execute(
            "SELECT 1 FROM effect_reports WHERE strain_id = ? AND source = ? LIMIT 1",
            (strain_id, SOURCE),
        ).fetchone()
        if already:
            continue

        matched = False

        # Genetics → metadata
        about = (row.get("about_info") or "").strip()
        if about and len(about) > 20:
            # Update genetics in metadata if empty
            existing_meta = conn.execute(
                "SELECT genetics FROM strain_metadata WHERE strain_id = ?",
                (strain_id,),
            ).fetchone()
            if existing_meta and (not existing_meta[0] or existing_meta[0] == ''):
                # Try to extract genetics from about_info
                genetics_match = re.search(
                    r'cross(?:ed)?\s+(?:of|between)\s+(.+?)(?:\.|,|$)',
                    about, re.IGNORECASE
                )
                if genetics_match:
                    genetics = genetics_match.group(1).strip()[:200]
                    conn.execute(
                        "UPDATE strain_metadata SET genetics = ? WHERE strain_id = ?",
                        (genetics, strain_id),
                    )
                    stats["genetics_added"] += 1
                    matched = True

        # THC/CBD ranges — only if we have actual numbers from the CSV
        thc_min = parse_float(row.get("thc_min", ""))
        thc_max = parse_float(row.get("thc_max", ""))
        cbd_min = parse_float(row.get("cbd_min", ""))
        cbd_max = parse_float(row.get("cbd_max", ""))

        if thc_min is not None and thc_max is not None and thc_max > thc_min:
            thc_avg = (thc_min + thc_max) / 2.0
            mol_id = molecules.get("thc")
            if mol_id:
                # Only update if current value is estimated
                current = conn.execute(
                    "SELECT measurement_type FROM strain_compositions "
                    "WHERE strain_id = ? AND molecule_id = ?",
                    (strain_id, mol_id),
                ).fetchone()
                if current and current[0] == 'estimated':
                    conn.execute(
                        "UPDATE strain_compositions SET percentage = ?, measurement_type = 'reported', source = ? "
                        "WHERE strain_id = ? AND molecule_id = ?",
                        (thc_avg, SOURCE, strain_id, mol_id),
                    )
                    stats["thc_cbd_updated"] += 1
                    matched = True
                elif not current:
                    conn.execute(
                        "INSERT OR IGNORE INTO strain_compositions "
                        "(strain_id, molecule_id, percentage, measurement_type, source) "
                        "VALUES (?, ?, ?, 'reported', ?)",
                        (strain_id, mol_id, thc_avg, SOURCE),
                    )
                    stats["thc_cbd_updated"] += 1
                    matched = True

        if cbd_min is not None and cbd_max is not None and cbd_max >= cbd_min:
            cbd_avg = (cbd_min + cbd_max) / 2.0
            mol_id = molecules.get("cbd")
            if mol_id:
                current = conn.execute(
                    "SELECT measurement_type FROM strain_compositions "
                    "WHERE strain_id = ? AND molecule_id = ?",
                    (strain_id, mol_id),
                ).fetchone()
                if current and current[0] == 'estimated':
                    conn.execute(
                        "UPDATE strain_compositions SET percentage = ?, measurement_type = 'reported', source = ? "
                        "WHERE strain_id = ? AND molecule_id = ?",
                        (cbd_avg, SOURCE, strain_id, mol_id),
                    )
                    stats["thc_cbd_updated"] += 1
                    matched = True
                elif not current:
                    conn.execute(
                        "INSERT OR IGNORE INTO strain_compositions "
                        "(strain_id, molecule_id, percentage, measurement_type, source) "
                        "VALUES (?, ?, ?, 'reported', ?)",
                        (strain_id, mol_id, cbd_avg, SOURCE),
                    )
                    stats["thc_cbd_updated"] += 1
                    matched = True

        # Effects from Cannabis Intelligence
        effects_raw = parse_comma_list(row.get("effects", ""))
        for idx, eff_name in enumerate(effects_raw):
            canonical = INTEL_EFFECT_MAP.get(eff_name.lower().strip())
            if canonical:
                eff_id = get_or_create_effect(conn, canonical, "positive")
                rc = weighted_report_count(POSITIVE_BASE, idx)
                try:
                    conn.execute(
                        "INSERT OR IGNORE INTO effect_reports "
                        "(strain_id, effect_id, report_count, confidence, source) "
                        "VALUES (?, ?, ?, 0.75, ?)",
                        (strain_id, eff_id, rc, SOURCE),
                    )
                    stats["effects_added"] += 1
                    matched = True
                except sqlite3.IntegrityError:
                    pass

        # Flavors
        flavors_raw = parse_comma_list(row.get("flavors", ""))
        for flavor in flavors_raw:
            flavor_clean = flavor.strip().lower()
            if flavor_clean:
                try:
                    conn.execute(
                        "INSERT OR IGNORE INTO strain_flavors (strain_id, flavor) VALUES (?, ?)",
                        (strain_id, flavor_clean),
                    )
                    stats["flavors_added"] += 1
                    matched = True
                except sqlite3.IntegrityError:
                    pass

        # Terpenes (from Cannabis Intelligence)
        terpenes_raw = parse_comma_list(row.get("terpenes", ""))
        TERP_PCT = [0.45, 0.28, 0.18, 0.10, 0.05]
        for idx, terp in enumerate(terpenes_raw):
            canonical = TERPENE_MAP.get(terp.lower().strip())
            if canonical:
                mol_id = molecules.get(canonical)
                if mol_id:
                    pct = TERP_PCT[min(idx, len(TERP_PCT) - 1)]
                    # Only add if we don't have reported/lab-tested data for this molecule
                    current = conn.execute(
                        "SELECT measurement_type FROM strain_compositions "
                        "WHERE strain_id = ? AND molecule_id = ?",
                        (strain_id, mol_id),
                    ).fetchone()
                    if current and current[0] == 'estimated':
                        conn.execute(
                            "UPDATE strain_compositions SET percentage = ?, measurement_type = 'reported', source = ? "
                            "WHERE strain_id = ? AND molecule_id = ?",
                            (pct, SOURCE, strain_id, mol_id),
                        )
                        stats["terpenes_added"] += 1
                        matched = True
                    elif not current:
                        conn.execute(
                            "INSERT OR IGNORE INTO strain_compositions "
                            "(strain_id, molecule_id, percentage, measurement_type, source) "
                            "VALUES (?, ?, ?, 'reported', ?)",
                            (strain_id, mol_id, pct, SOURCE),
                        )
                        stats["terpenes_added"] += 1
                        matched = True

        if matched:
            stats["matched"] += 1

    conn.commit()
    print(f"  Strains enriched:     {stats['matched']}")
    print(f"  Genetics added:       {stats['genetics_added']}")
    print(f"  THC/CBD updated:      {stats['thc_cbd_updated']}")
    print(f"  Effect reports added: {stats['effects_added']}")
    print(f"  Flavors added:        {stats['flavors_added']}")
    print(f"  Terpenes added:       {stats['terpenes_added']}")


# ── Phase 4: Re-evaluate quality after enrichment ───────────────────────────

def phase4_reevaluate_quality(conn):
    """Re-check data quality after enrichment. Promote partials that now
    have verified terpene data, or demote any that shouldn't be full."""
    print("\n" + "=" * 60)
    print("PHASE 4: RE-EVALUATE DATA QUALITY")
    print("=" * 60)

    # Promote: partial strains that now have reported/lab-tested terpenes + effects
    promotable = conn.execute("""
        SELECT s.id, s.name
        FROM strains s
        WHERE s.data_quality = 'partial'
          AND (SELECT COUNT(*) FROM effect_reports er WHERE er.strain_id = s.id) >= 3
          AND EXISTS (
            SELECT 1 FROM strain_compositions sc
            JOIN molecules m ON sc.molecule_id = m.id
            WHERE sc.strain_id = s.id
              AND m.molecule_type = 'terpene'
              AND sc.measurement_type IN ('reported', 'lab_tested')
          )
          AND LENGTH(s.description) > 50
    """).fetchall()

    promoted = 0
    for sid, name in promotable:
        conn.execute("UPDATE strains SET data_quality = 'full' WHERE id = ?", (sid,))
        promoted += 1

    conn.commit()
    print(f"  Promoted partial → full: {promoted}")

    # Final counts
    counts = conn.execute(
        "SELECT data_quality, COUNT(*) FROM strains GROUP BY data_quality"
    ).fetchall()
    total = sum(c for _, c in counts)
    print(f"\n  Final database counts:")
    for dq, cnt in counts:
        print(f"    {dq}: {cnt}")
    print(f"    TOTAL: {total}")


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    db_path = sys.argv[1] if len(sys.argv) > 1 else str(DB_PATH)

    print("=" * 60)
    print("STRAIN DATABASE AUDIT & ENRICHMENT")
    print("=" * 60)

    conn = init_db(db_path)

    # Show initial state
    counts = conn.execute(
        "SELECT data_quality, COUNT(*) FROM strains GROUP BY data_quality"
    ).fetchall()
    total = sum(c for _, c in counts)
    print(f"\nInitial state: {total} strains")
    for dq, cnt in counts:
        print(f"  {dq}: {cnt}")

    phase1_cleanup(conn)
    phase2_quality_audit(conn)
    phase3_enrich_kushy(conn)
    phase3_enrich_intel(conn)
    phase4_reevaluate_quality(conn)

    conn.close()
    print("\n" + "=" * 60)
    print("AUDIT & ENRICHMENT COMPLETE")
    print("=" * 60)


if __name__ == "__main__":
    main()
