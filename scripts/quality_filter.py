"""Quality filter: dedup, fill gaps, enforce minimums, cap outliers.

Runs AFTER all imports. Ensures every strain in the database meets minimum
quality thresholds for the quiz matching engine:
  - Has a valid name and type
  - Has >= 2 effect reports (otherwise matching engine can't score)
  - Has >= 1 terpene composition
  - Has a valid THC value (0-40%)
  - Caps unrealistic cannabinoid values (THC > 40% → 25%, CBD > 30% → 15%)
  - Fills missing terpenes/cannabinoids with type-based defaults

Also runs a final fuzzy dedup pass to catch any remaining near-duplicates
across sources.

Usage:
    python scripts/quality_filter.py [db_path]
"""
import json
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from cannalchemy.data.normalize import normalize_strain_name, match_strain_names
from cannalchemy.data.schema import init_db

# ── Constants ────────────────────────────────────────────────────────────────

MIN_EFFECTS = 2          # Minimum effect reports per strain
MAX_THC = 40.0           # Cap THC at 40%
MAX_CBD = 30.0           # Cap CBD at 30%
DEFAULT_THC_CAP = 25.0   # Replace outlier THC with this
DEFAULT_CBD_CAP = 15.0   # Replace outlier CBD with this
DEDUP_THRESHOLD = 90.0   # Fuzzy match threshold for final dedup

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


def quality_filter(db_path=None):
    if db_path is None:
        db_path = str(ROOT / "data" / "processed" / "cannalchemy.db")

    print("=" * 60)
    print("QUALITY FILTER")
    print("=" * 60)

    conn = init_db(db_path)
    stats = {
        "total_before": 0,
        "removed_sparse": 0,
        "removed_dedup": 0,
        "capped_thc": 0,
        "capped_cbd": 0,
        "filled_terpenes": 0,
        "filled_cannabinoids": 0,
        "total_after": 0,
    }

    # ── Step 1: Count initial state ──────────────────────────────────────
    stats["total_before"] = conn.execute("SELECT COUNT(*) FROM strains").fetchone()[0]
    print(f"\n[1/5] Starting with {stats['total_before']} strains")

    # ── Step 2: Cap outlier cannabinoid values ───────────────────────────
    print("\n[2/5] Capping outlier cannabinoid values...")

    # Get THC and CBD molecule IDs
    thc_row = conn.execute("SELECT id FROM molecules WHERE name = 'thc'").fetchone()
    cbd_row = conn.execute("SELECT id FROM molecules WHERE name = 'cbd'").fetchone()
    thc_id = thc_row[0] if thc_row else None
    cbd_id = cbd_row[0] if cbd_row else None

    if thc_id:
        # Cap THC > 40%
        outliers = conn.execute(
            "SELECT COUNT(*) FROM strain_compositions WHERE molecule_id = ? AND percentage > ?",
            (thc_id, MAX_THC),
        ).fetchone()[0]
        if outliers:
            conn.execute(
                "UPDATE strain_compositions SET percentage = ? WHERE molecule_id = ? AND percentage > ?",
                (DEFAULT_THC_CAP, thc_id, MAX_THC),
            )
            stats["capped_thc"] = outliers
            print(f"  Capped {outliers} THC values > {MAX_THC}% to {DEFAULT_THC_CAP}%")

    if cbd_id:
        outliers = conn.execute(
            "SELECT COUNT(*) FROM strain_compositions WHERE molecule_id = ? AND percentage > ?",
            (cbd_id, MAX_CBD),
        ).fetchone()[0]
        if outliers:
            conn.execute(
                "UPDATE strain_compositions SET percentage = ? WHERE molecule_id = ? AND percentage > ?",
                (DEFAULT_CBD_CAP, cbd_id, MAX_CBD),
            )
            stats["capped_cbd"] = outliers
            print(f"  Capped {outliers} CBD values > {MAX_CBD}% to {DEFAULT_CBD_CAP}%")

    conn.commit()

    # ── Step 3: Fill missing terpenes and cannabinoids ───────────────────
    print("\n[3/5] Filling missing terpenes and cannabinoids...")

    all_strains = conn.execute(
        "SELECT id, strain_type FROM strains"
    ).fetchall()

    for strain_id, strain_type in all_strains:
        stype = strain_type if strain_type in ("indica", "sativa", "hybrid") else "hybrid"

        # Check if strain has any terpene compositions
        terp_count = conn.execute(
            "SELECT COUNT(*) FROM strain_compositions sc "
            "JOIN molecules m ON m.id = sc.molecule_id "
            "WHERE sc.strain_id = ? AND m.molecule_type = 'terpene'",
            (strain_id,),
        ).fetchone()[0]

        if terp_count == 0:
            for terp_name, pct in DEFAULT_TERPENES.get(stype, DEFAULT_TERPENES["hybrid"]):
                mol_row = conn.execute(
                    "SELECT id FROM molecules WHERE name = ?", (terp_name,)
                ).fetchone()
                if mol_row:
                    conn.execute(
                        "INSERT OR IGNORE INTO strain_compositions "
                        "(strain_id, molecule_id, percentage, measurement_type, source) "
                        "VALUES (?, ?, ?, 'estimated', 'quality-filter')",
                        (strain_id, mol_row[0], pct),
                    )
                    stats["filled_terpenes"] += 1

        # Check if strain has THC
        if thc_id:
            has_thc = conn.execute(
                "SELECT COUNT(*) FROM strain_compositions WHERE strain_id = ? AND molecule_id = ?",
                (strain_id, thc_id),
            ).fetchone()[0]
            if not has_thc:
                defaults = DEFAULT_CANNABINOIDS.get(stype, DEFAULT_CANNABINOIDS["hybrid"])
                conn.execute(
                    "INSERT OR IGNORE INTO strain_compositions "
                    "(strain_id, molecule_id, percentage, measurement_type, source) "
                    "VALUES (?, ?, ?, 'estimated', 'quality-filter')",
                    (strain_id, thc_id, defaults["thc"]),
                )
                stats["filled_cannabinoids"] += 1

        # Check if strain has CBD
        if cbd_id:
            has_cbd = conn.execute(
                "SELECT COUNT(*) FROM strain_compositions WHERE strain_id = ? AND molecule_id = ?",
                (strain_id, cbd_id),
            ).fetchone()[0]
            if not has_cbd:
                defaults = DEFAULT_CANNABINOIDS.get(stype, DEFAULT_CANNABINOIDS["hybrid"])
                conn.execute(
                    "INSERT OR IGNORE INTO strain_compositions "
                    "(strain_id, molecule_id, percentage, measurement_type, source) "
                    "VALUES (?, ?, ?, 'estimated', 'quality-filter')",
                    (strain_id, cbd_id, defaults["cbd"]),
                )
                stats["filled_cannabinoids"] += 1

    conn.commit()
    print(f"  Filled {stats['filled_terpenes']} terpene entries")
    print(f"  Filled {stats['filled_cannabinoids']} cannabinoid entries")

    # ── Step 4: Remove sparse strains (< 2 effects) ─────────────────────
    print(f"\n[4/5] Removing sparse strains (< {MIN_EFFECTS} effects)...")

    sparse_strains = conn.execute(
        "SELECT s.id, s.name FROM strains s "
        "WHERE (SELECT COUNT(*) FROM effect_reports er WHERE er.strain_id = s.id) < ?",
        (MIN_EFFECTS,),
    ).fetchall()

    for strain_id, strain_name in sparse_strains:
        # Delete related data
        conn.execute("DELETE FROM effect_reports WHERE strain_id = ?", (strain_id,))
        conn.execute("DELETE FROM strain_compositions WHERE strain_id = ?", (strain_id,))
        conn.execute("DELETE FROM strain_flavors WHERE strain_id = ?", (strain_id,))
        conn.execute("DELETE FROM strain_metadata WHERE strain_id = ?", (strain_id,))
        conn.execute("DELETE FROM strain_aliases WHERE alias_strain_id = ? OR canonical_strain_id = ?",
                      (strain_id, strain_id))
        conn.execute("DELETE FROM strains WHERE id = ?", (strain_id,))
        stats["removed_sparse"] += 1

    conn.commit()
    print(f"  Removed {stats['removed_sparse']} strains with < {MIN_EFFECTS} effects")

    # ── Step 5: Final dedup pass ─────────────────────────────────────────
    print("\n[5/5] Running final dedup pass...")

    remaining = conn.execute(
        "SELECT id, normalized_name, source FROM strains ORDER BY "
        "CASE source WHEN 'strain-finder' THEN 1 WHEN 'kushy' THEN 2 ELSE 3 END, id"
    ).fetchall()

    seen_names = {}  # normalized_name -> strain_id (keep first seen = highest priority source)
    to_remove = []

    for strain_id, norm_name, source in remaining:
        if norm_name in seen_names:
            to_remove.append(strain_id)
            continue

        # Check fuzzy match against already-seen names
        if seen_names:
            known = list(seen_names.keys())
            matches = match_strain_names(norm_name, known, limit=1, score_cutoff=DEDUP_THRESHOLD)
            if matches:
                to_remove.append(strain_id)
                continue

        seen_names[norm_name] = strain_id

    for strain_id in to_remove:
        conn.execute("DELETE FROM effect_reports WHERE strain_id = ?", (strain_id,))
        conn.execute("DELETE FROM strain_compositions WHERE strain_id = ?", (strain_id,))
        conn.execute("DELETE FROM strain_flavors WHERE strain_id = ?", (strain_id,))
        conn.execute("DELETE FROM strain_metadata WHERE strain_id = ?", (strain_id,))
        conn.execute("DELETE FROM strain_aliases WHERE alias_strain_id = ? OR canonical_strain_id = ?",
                      (strain_id, strain_id))
        conn.execute("DELETE FROM strains WHERE id = ?", (strain_id,))
        stats["removed_dedup"] += 1

    conn.commit()
    print(f"  Removed {stats['removed_dedup']} duplicate strains")

    # ── Report ───────────────────────────────────────────────────────────
    stats["total_after"] = conn.execute("SELECT COUNT(*) FROM strains").fetchone()[0]
    effect_count = conn.execute("SELECT COUNT(*) FROM effect_reports").fetchone()[0]
    comp_count = conn.execute("SELECT COUNT(*) FROM strain_compositions").fetchone()[0]

    conn.close()

    print("\n" + "=" * 60)
    print("QUALITY FILTER COMPLETE")
    print("=" * 60)
    print(f"  Strains before:       {stats['total_before']}")
    print(f"  Removed (sparse):     {stats['removed_sparse']}")
    print(f"  Removed (duplicate):  {stats['removed_dedup']}")
    print(f"  THC values capped:    {stats['capped_thc']}")
    print(f"  CBD values capped:    {stats['capped_cbd']}")
    print(f"  Terpenes filled:      {stats['filled_terpenes']}")
    print(f"  Cannabinoids filled:  {stats['filled_cannabinoids']}")
    print(f"  Strains after:        {stats['total_after']}")
    print(f"  Total effect reports: {effect_count}")
    print(f"  Total compositions:   {comp_count}")
    print("=" * 60)


if __name__ == "__main__":
    db_path = sys.argv[1] if len(sys.argv) > 1 else None
    quality_filter(db_path)
