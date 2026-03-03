"""Optimized quality filter for large database with Cannlytics strains.

Runs AFTER enrich_new_strains.py. Removes sparse strains (< 2 effects),
caps outliers, fills gaps, and deduplicates. Optimized for batch SQL
operations when dealing with 60K+ strains.

Usage:
    python scripts/quality_filter_v2.py [db_path]
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

MIN_EFFECTS = 2
MAX_THC = 40.0
MAX_CBD = 30.0
DEFAULT_THC_CAP = 25.0
DEFAULT_CBD_CAP = 15.0
DEDUP_THRESHOLD = 90.0

DEFAULT_TERPENES = {
    "indica": [("myrcene", 0.35), ("linalool", 0.18), ("caryophyllene", 0.12),
               ("humulene", 0.08), ("pinene", 0.06), ("bisabolol", 0.04)],
    "sativa": [("limonene", 0.30), ("pinene", 0.20), ("terpinolene", 0.12),
               ("caryophyllene", 0.08), ("myrcene", 0.06), ("ocimene", 0.04)],
    "hybrid": [("caryophyllene", 0.25), ("myrcene", 0.18), ("limonene", 0.12),
               ("humulene", 0.08), ("linalool", 0.06), ("pinene", 0.04)],
}

DEFAULT_CANNABINOIDS = {
    "indica": {"thc": 18.0, "cbd": 0.5},
    "sativa": {"thc": 17.0, "cbd": 0.3},
    "hybrid": {"thc": 17.5, "cbd": 0.4},
}


def quality_filter_v2(db_path=None):
    if db_path is None:
        db_path = str(ROOT / "data" / "processed" / "cannalchemy.db")

    print("=" * 60)
    print("QUALITY FILTER v2 (Optimized)")
    print("=" * 60)

    conn = init_db(db_path)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")

    stats = {
        "total_before": 0,
        "removed_sparse": 0,
        "removed_dedup": 0,
        "capped_thc": 0,
        "capped_cbd": 0,
        "filled_terpenes": 0,
        "filled_cannabinoids": 0,
        "lab_upgraded": 0,
        "total_after": 0,
    }

    # ── Step 1: Count initial state ──────────────────────────────────────
    stats["total_before"] = conn.execute("SELECT COUNT(*) FROM strains").fetchone()[0]
    print(f"\n[1/7] Starting with {stats['total_before']:,} strains")

    # ── Step 2: Batch remove sparse strains ──────────────────────────────
    print(f"\n[2/7] Removing sparse strains (< {MIN_EFFECTS} effects)...")

    # Get IDs of strains to remove (no effects or < MIN_EFFECTS)
    sparse_ids = conn.execute("""
        SELECT s.id FROM strains s
        WHERE (SELECT COUNT(*) FROM effect_reports er WHERE er.strain_id = s.id) < ?
    """, (MIN_EFFECTS,)).fetchall()
    sparse_ids = [row[0] for row in sparse_ids]

    if sparse_ids:
        # Batch delete using temp table for efficiency
        conn.execute("CREATE TEMP TABLE IF NOT EXISTS ids_to_remove (id INTEGER PRIMARY KEY)")
        conn.execute("DELETE FROM ids_to_remove")
        conn.executemany("INSERT INTO ids_to_remove VALUES (?)", [(i,) for i in sparse_ids])

        conn.execute("DELETE FROM effect_reports WHERE strain_id IN (SELECT id FROM ids_to_remove)")
        conn.execute("DELETE FROM strain_compositions WHERE strain_id IN (SELECT id FROM ids_to_remove)")
        conn.execute("DELETE FROM strain_flavors WHERE strain_id IN (SELECT id FROM ids_to_remove)")
        conn.execute("DELETE FROM strain_metadata WHERE strain_id IN (SELECT id FROM ids_to_remove)")
        conn.execute("DELETE FROM strain_aliases WHERE alias_strain_id IN (SELECT id FROM ids_to_remove) "
                     "OR canonical_strain_id IN (SELECT id FROM ids_to_remove)")
        conn.execute("DELETE FROM strains WHERE id IN (SELECT id FROM ids_to_remove)")
        conn.execute("DROP TABLE ids_to_remove")
        conn.commit()

        stats["removed_sparse"] = len(sparse_ids)
    print(f"  Removed {stats['removed_sparse']:,} sparse strains")

    remaining = conn.execute("SELECT COUNT(*) FROM strains").fetchone()[0]
    print(f"  Remaining: {remaining:,}")

    # ── Step 3: Cap outlier cannabinoid values ───────────────────────────
    print("\n[3/7] Capping outlier cannabinoid values...")

    thc_row = conn.execute("SELECT id FROM molecules WHERE name = 'thc'").fetchone()
    cbd_row = conn.execute("SELECT id FROM molecules WHERE name = 'cbd'").fetchone()
    thc_id = thc_row[0] if thc_row else None
    cbd_id = cbd_row[0] if cbd_row else None

    if thc_id:
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

    # ── Step 4: Prefer lab-tested over estimated compositions ────────────
    print("\n[4/7] Upgrading estimated compositions with lab-tested values...")

    # For strains that have BOTH estimated and lab_tested for the same molecule,
    # remove the estimated and keep lab_tested
    upgraded = conn.execute("""
        DELETE FROM strain_compositions
        WHERE id IN (
            SELECT est.id FROM strain_compositions est
            INNER JOIN strain_compositions lab
            ON est.strain_id = lab.strain_id AND est.molecule_id = lab.molecule_id
            WHERE est.measurement_type = 'estimated' AND lab.measurement_type = 'lab_tested'
        )
    """).rowcount
    stats["lab_upgraded"] = upgraded
    conn.commit()
    print(f"  Replaced {upgraded} estimated compositions with lab-tested values")

    # Also prefer 'reported' source data over 'estimated'
    upgraded2 = conn.execute("""
        DELETE FROM strain_compositions
        WHERE id IN (
            SELECT est.id FROM strain_compositions est
            INNER JOIN strain_compositions rep
            ON est.strain_id = rep.strain_id AND est.molecule_id = rep.molecule_id
            WHERE est.measurement_type = 'estimated' AND rep.measurement_type = 'reported'
        )
    """).rowcount
    conn.commit()
    if upgraded2:
        print(f"  Replaced {upgraded2} estimated compositions with reported values")

    # ── Step 5: Fill missing terpenes and cannabinoids ───────────────────
    print("\n[5/7] Filling missing terpenes and cannabinoids...")

    all_strains = conn.execute("SELECT id, strain_type FROM strains").fetchall()

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
                mol_row = conn.execute("SELECT id FROM molecules WHERE name = ?", (terp_name,)).fetchone()
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

    # ── Step 6: Final dedup pass ─────────────────────────────────────────
    print("\n[6/7] Running final dedup pass...")

    # Priority: strain-finder > kushy > cannabis-intel > cannlytics
    remaining = conn.execute("""
        SELECT id, normalized_name, source FROM strains ORDER BY
        CASE source
            WHEN 'strain-finder' THEN 1
            WHEN 'kushy' THEN 2
            WHEN 'cannabis-intel' THEN 3
            WHEN 'cannlytics' THEN 4
            ELSE 5
        END, id
    """).fetchall()

    seen_names = {}
    to_remove = []

    for strain_id, norm_name, source in remaining:
        if norm_name in seen_names:
            to_remove.append(strain_id)
            continue

        # Only do fuzzy matching if we have a manageable number of strains
        if len(seen_names) < 5000 and seen_names:
            known = list(seen_names.keys())
            matches = match_strain_names(norm_name, known, limit=1, score_cutoff=DEDUP_THRESHOLD)
            if matches:
                to_remove.append(strain_id)
                continue

        seen_names[norm_name] = strain_id

    if to_remove:
        conn.execute("CREATE TEMP TABLE IF NOT EXISTS dedup_remove (id INTEGER PRIMARY KEY)")
        conn.execute("DELETE FROM dedup_remove")
        conn.executemany("INSERT INTO dedup_remove VALUES (?)", [(i,) for i in to_remove])

        conn.execute("DELETE FROM effect_reports WHERE strain_id IN (SELECT id FROM dedup_remove)")
        conn.execute("DELETE FROM strain_compositions WHERE strain_id IN (SELECT id FROM dedup_remove)")
        conn.execute("DELETE FROM strain_flavors WHERE strain_id IN (SELECT id FROM dedup_remove)")
        conn.execute("DELETE FROM strain_metadata WHERE strain_id IN (SELECT id FROM dedup_remove)")
        conn.execute("DELETE FROM strain_aliases WHERE alias_strain_id IN (SELECT id FROM dedup_remove) "
                     "OR canonical_strain_id IN (SELECT id FROM dedup_remove)")
        conn.execute("DELETE FROM strains WHERE id IN (SELECT id FROM dedup_remove)")
        conn.execute("DROP TABLE dedup_remove")
        conn.commit()

    stats["removed_dedup"] = len(to_remove)
    print(f"  Removed {stats['removed_dedup']} duplicate strains")

    # ── Step 7: Clean up orphaned lab_results ────────────────────────────
    print("\n[7/7] Cleaning up...")

    # Vacuum to reclaim space
    stats["total_after"] = conn.execute("SELECT COUNT(*) FROM strains").fetchone()[0]
    effect_count = conn.execute("SELECT COUNT(*) FROM effect_reports").fetchone()[0]
    comp_count = conn.execute("SELECT COUNT(*) FROM strain_compositions").fetchone()[0]

    # Count by source
    source_counts = conn.execute(
        "SELECT source, COUNT(*) FROM strains GROUP BY source ORDER BY COUNT(*) DESC"
    ).fetchall()

    # Count lab-tested vs estimated
    lab_tested = conn.execute(
        "SELECT COUNT(DISTINCT strain_id) FROM strain_compositions WHERE measurement_type = 'lab_tested'"
    ).fetchone()[0]

    conn.close()

    print("\n" + "=" * 60)
    print("QUALITY FILTER v2 COMPLETE")
    print("=" * 60)
    print(f"  Strains before:       {stats['total_before']:,}")
    print(f"  Removed (sparse):     {stats['removed_sparse']:,}")
    print(f"  Removed (duplicate):  {stats['removed_dedup']}")
    print(f"  THC values capped:    {stats['capped_thc']}")
    print(f"  CBD values capped:    {stats['capped_cbd']}")
    print(f"  Lab upgrades:         {stats['lab_upgraded']}")
    print(f"  Terpenes filled:      {stats['filled_terpenes']}")
    print(f"  Cannabinoids filled:  {stats['filled_cannabinoids']}")
    print(f"  Strains after:        {stats['total_after']:,}")
    print(f"  By source:")
    for source, count in source_counts:
        print(f"    {source}: {count}")
    print(f"  Lab-tested strains:   {lab_tested}")
    print(f"  Total effect reports: {effect_count:,}")
    print(f"  Total compositions:   {comp_count:,}")
    print("=" * 60)


if __name__ == "__main__":
    db_path = sys.argv[1] if len(sys.argv) > 1 else None
    quality_filter_v2(db_path)
