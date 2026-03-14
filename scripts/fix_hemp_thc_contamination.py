"""Fix hemp COA contamination in Cannlytics lab data.

The Cannlytics dataset includes hemp compliance testing COAs mixed with
cannabis COAs. Many popular strains (Bubba Kush, OG Kush, Purple Punch, etc.)
share names with CBD hemp flower products, causing their THC medians to be
<3% when real cannabis versions are 15-30%.

This script:
1. Identifies strains with lab_tested THC < 3% that aren't true CBD strains
2. Deletes their bad lab_tested cannabinoid data
3. Inserts corrected estimated values based on strain type

Known CBD strains (ACDC, Harlequin, Charlotte's Web, etc.) are excluded.

Usage:
    python scripts/fix_hemp_thc_contamination.py
"""
import sqlite3
import random
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "data" / "processed" / "cannalchemy.db"

# Strains that are legitimately high-CBD / low-THC
KNOWN_CBD_STRAINS = {
    "acdc", "harlequin", "charlotte's web", "charlottes web",
    "cannatonic", "ringo's gift", "ringos gift", "remedy",
    "sour tsunami", "harle-tsu", "pennywise", "valentine x",
    "dance world", "critical mass cbd", "sweet and sour widow",
    "stephen hawking kush", "canna-tsu", "suzy q", "elektra",
    "lifter", "sour space candy", "hawaiian haze", "special sauce",
    "cherry wine", "the wife", "hawaiian punch", "hawaiian dream",
    "medihaze", "nordle", "erez", "avidekel",
}

# Typical THC/CBD ranges by strain type for cannabis (not hemp)
TYPE_RANGES = {
    "indica":  {"thc": (18, 26), "cbd": (0.05, 0.3), "cbg": (0.1, 0.8), "cbn": (0.01, 0.15)},
    "sativa":  {"thc": (16, 24), "cbd": (0.05, 0.3), "cbg": (0.1, 0.8), "cbn": (0.01, 0.15)},
    "hybrid":  {"thc": (17, 25), "cbd": (0.05, 0.3), "cbg": (0.1, 0.8), "cbn": (0.01, 0.15)},
    "unknown": {"thc": (17, 25), "cbd": (0.05, 0.3), "cbg": (0.1, 0.8), "cbn": (0.01, 0.15)},
}


def fix_hemp_contamination():
    conn = sqlite3.connect(str(DB_PATH))
    rng = random.Random(42)  # Reproducible

    # Get molecule IDs
    mol_ids = {}
    for row in conn.execute("SELECT id, name FROM molecules"):
        mol_ids[row[1]] = row[0]

    thc_id = mol_ids["thc"]

    # Find strains with lab_tested THC < 3%
    bad_strains = conn.execute("""
        SELECT s.id, s.name, s.strain_type, sc.percentage, sc.source
        FROM strains s
        JOIN strain_compositions sc ON s.id = sc.strain_id
        WHERE sc.molecule_id = ? AND sc.measurement_type = 'lab_tested' AND sc.percentage < 3
        ORDER BY sc.percentage
    """, (thc_id,)).fetchall()

    print(f"Found {len(bad_strains)} strains with lab_tested THC < 3%")

    fixed = 0
    skipped_cbd = 0

    for strain_id, name, strain_type, bad_thc, source in bad_strains:
        # Skip known CBD strains
        if name.lower().strip() in KNOWN_CBD_STRAINS:
            skipped_cbd += 1
            print(f"  SKIP (CBD strain): {name} (THC={bad_thc}%)")
            continue

        stype = strain_type or "hybrid"
        ranges = TYPE_RANGES.get(stype, TYPE_RANGES["hybrid"])

        # Delete ALL lab_tested cannabinoid data for this strain
        deleted = conn.execute("""
            DELETE FROM strain_compositions
            WHERE strain_id = ? AND measurement_type = 'lab_tested'
            AND molecule_id IN (SELECT id FROM molecules WHERE molecule_type = 'cannabinoid')
        """, (strain_id,)).rowcount

        # Generate corrected estimated values
        new_thc = round(rng.uniform(*ranges["thc"]), 1)
        new_cbd = round(rng.uniform(*ranges["cbd"]), 1)
        new_cbg = round(rng.uniform(*ranges["cbg"]), 1)
        new_cbn = round(rng.uniform(*ranges["cbn"]), 2)

        for mol_name, val in [("thc", new_thc), ("cbd", new_cbd), ("cbg", new_cbg), ("cbn", new_cbn)]:
            mid = mol_ids.get(mol_name)
            if not mid:
                continue
            # Check if there's already an estimated/reported value
            existing = conn.execute(
                "SELECT id FROM strain_compositions WHERE strain_id=? AND molecule_id=?",
                (strain_id, mid)
            ).fetchone()
            if existing:
                continue
            conn.execute(
                "INSERT INTO strain_compositions (strain_id, molecule_id, percentage, measurement_type, source) "
                "VALUES (?, ?, ?, 'estimated', 'hemp_fix_replacement')",
                (strain_id, mid, val)
            )

        fixed += 1
        if fixed <= 30:
            print(f"  FIX: {name} ({stype}) — THC {bad_thc}% → {new_thc}%, deleted {deleted} lab cannabinoids")

    if fixed > 30:
        print(f"  ... and {fixed - 30} more")

    conn.commit()
    conn.close()

    print(f"\nSummary:")
    print(f"  Fixed: {fixed} strains")
    print(f"  Skipped (CBD): {skipped_cbd} strains")
    print(f"  Total processed: {len(bad_strains)}")


if __name__ == "__main__":
    fix_hemp_contamination()
