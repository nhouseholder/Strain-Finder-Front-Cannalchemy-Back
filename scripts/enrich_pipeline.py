"""Unified enrichment pipeline for existing strains.

Runs multiple idempotent passes to fill data gaps:
1. enrich_terpenes  — Upgrade estimated terpene data with Cannlytics lab values
2. enrich_metadata  — Fill descriptions, genetics, flavors, best_for, not_ideal_for
3. enrich_reviews   — Aggregate review data into strain_reviews table (Phase 2)
4. promote_quality  — Recompute data_quality based on actual coverage

Each pass checks enrichment_log before processing and skips already-enriched
strains, making the pipeline safe to re-run.

Usage:
    python scripts/enrich_pipeline.py --pass terpenes [--limit N]
    python scripts/enrich_pipeline.py --pass metadata
    python scripts/enrich_pipeline.py --pass quality
    python scripts/enrich_pipeline.py --all
"""
import argparse
import json
import random
import re
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from cannalchemy.data.normalize import normalize_strain_name
from cannalchemy.data.schema import init_db
from scripts.lib.ingest_helpers import (
    BEST_FOR_RULES,
    CONSUMPTION_BY_TYPE,
    NOT_IDEAL_RULES,
    get_or_create_effect,
    get_molecule_id,
    infer_best_for,
    infer_not_ideal,
)

DB_PATH = str(ROOT / "data" / "processed" / "cannalchemy.db")

# Terpene → flavor inference
TERPENE_FLAVORS = {
    "myrcene": ["earthy", "herbal", "musky"],
    "limonene": ["citrus", "lemon", "orange"],
    "caryophyllene": ["peppery", "spicy", "woody"],
    "linalool": ["floral", "lavender", "sweet"],
    "pinene": ["pine", "woody", "herbal"],
    "humulene": ["earthy", "woody", "herbal"],
    "terpinolene": ["sweet", "herbal", "floral"],
    "ocimene": ["sweet", "herbal", "citrus"],
    "bisabolol": ["floral", "sweet", "honey"],
    "valencene": ["citrus", "orange", "sweet"],
    "geraniol": ["floral", "rose", "sweet"],
    "nerolidol": ["woody", "earthy", "floral"],
    "camphene": ["pine", "earthy", "herbal"],
    "eucalyptol": ["minty", "herbal", "cool"],
    "borneol": ["minty", "herbal", "camphor"],
    "terpineol": ["floral", "pine", "sweet"],
    "guaiol": ["pine", "woody", "earthy"],
    "farnesene": ["sweet", "fruity", "herbal"],
    "carene": ["sweet", "pine", "earthy"],
    "fenchol": ["herbal", "earthy", "citrus"],
    "phellandrene": ["minty", "herbal", "citrus"],
}

# Terpene → predicted effects
TERPENE_EFFECTS = {
    "myrcene": [("relaxed", "positive"), ("sleepy", "positive"), ("calm", "positive")],
    "limonene": [("uplifted", "positive"), ("happy", "positive"), ("energetic", "positive")],
    "caryophyllene": [("relaxed", "positive"), ("calm", "positive")],
    "linalool": [("relaxed", "positive"), ("sleepy", "positive"), ("calm", "positive")],
    "pinene": [("focused", "positive"), ("creative", "positive"), ("energetic", "positive")],
    "humulene": [("relaxed", "positive"), ("calm", "positive")],
    "terpinolene": [("uplifted", "positive"), ("energetic", "positive"), ("creative", "positive")],
    "ocimene": [("uplifted", "positive"), ("energetic", "positive")],
    "bisabolol": [("relaxed", "positive"), ("calm", "positive")],
}


def _is_enriched(conn: sqlite3.Connection, strain_id: int, pass_name: str) -> bool:
    """Check if a strain has already been enriched by this pass."""
    row = conn.execute(
        "SELECT 1 FROM enrichment_log WHERE strain_id = ? AND pass_name = ?",
        (strain_id, pass_name),
    ).fetchone()
    return row is not None


def _mark_enriched(conn: sqlite3.Connection, strain_id: int, pass_name: str, notes: str = ""):
    """Mark a strain as enriched by this pass."""
    conn.execute(
        "INSERT OR REPLACE INTO enrichment_log (strain_id, pass_name, status, notes) "
        "VALUES (?, ?, 'completed', ?)",
        (strain_id, pass_name, notes),
    )


# ── Pass 1: Terpene Enrichment ────────────────────────────────────────────

def enrich_terpenes(conn: sqlite3.Connection, limit: int | None = None):
    """Upgrade estimated terpene data using Cannlytics lab values.

    For strains with only 'estimated' terpene measurements, cross-references
    against the lab_results table and upgrades matching entries.
    """
    pass_name = "terpene-enrich"

    print("\n[PASS] Terpene Enrichment")
    print("-" * 40)

    # Find strains with estimated-only terpenes
    strains = conn.execute("""
        SELECT DISTINCT s.id, s.name, s.normalized_name, s.strain_type
        FROM strains s
        JOIN strain_compositions sc ON sc.strain_id = s.id
        JOIN molecules m ON m.id = sc.molecule_id AND m.molecule_type = 'terpene'
        WHERE sc.measurement_type = 'estimated'
        AND NOT EXISTS (
            SELECT 1 FROM strain_compositions sc2
            JOIN molecules m2 ON m2.id = sc2.molecule_id AND m2.molecule_type = 'terpene'
            WHERE sc2.strain_id = s.id AND sc2.measurement_type IN ('lab_tested', 'reported')
        )
        ORDER BY s.id
    """).fetchall()

    print(f"  Strains with estimated-only terpenes: {len(strains)}")

    stats = {"checked": 0, "upgraded": 0, "skipped": 0}
    processed = 0

    for sid, name, norm_name, stype in strains:
        if limit and processed >= limit:
            break
        if _is_enriched(conn, sid, pass_name):
            stats["skipped"] += 1
            continue

        processed += 1
        stats["checked"] += 1

        # Check lab_results for this strain
        lab_rows = conn.execute("""
            SELECT molecule_name, AVG(concentration) as avg_conc, COUNT(*) as sample_count
            FROM lab_results
            WHERE normalized_strain_name = ? OR strain_name = ?
            GROUP BY molecule_name
            HAVING avg_conc > 0
        """, (norm_name, name)).fetchall()

        if lab_rows:
            # We have lab data! Insert as 'lab_tested' entries
            upgraded = False
            for mol_name, avg_conc, sample_count in lab_rows:
                mol_id = get_molecule_id(conn, mol_name)
                if mol_id and avg_conc > 0:
                    conn.execute(
                        "INSERT OR REPLACE INTO strain_compositions "
                        "(strain_id, molecule_id, percentage, measurement_type, source) "
                        "VALUES (?, ?, ?, 'lab_tested', 'cannlytics-lab')",
                        (sid, mol_id, round(avg_conc, 3)),
                    )
                    upgraded = True

            if upgraded:
                stats["upgraded"] += 1
                _mark_enriched(conn, sid, pass_name, f"Upgraded from lab_results ({len(lab_rows)} molecules)")
            else:
                _mark_enriched(conn, sid, pass_name, "No matching molecules in lab data")
        else:
            _mark_enriched(conn, sid, pass_name, "No lab data found")

        if processed % 200 == 0:
            conn.commit()
            print(f"  Progress: {processed}/{len(strains)} ({stats['upgraded']} upgraded)")

    conn.commit()
    print(f"  Checked: {stats['checked']}, Upgraded: {stats['upgraded']}, Skipped: {stats['skipped']}")


# ── Pass 2: Metadata Enrichment ────────────────────────────────────────────

def enrich_metadata(conn: sqlite3.Connection, limit: int | None = None):
    """Fill missing descriptions, genetics, flavors, best_for, not_ideal_for.

    Incorporates logic from enrich_partials.py but integrated into the
    unified pipeline with enrichment_log tracking.
    """
    pass_name = "metadata-enrich"

    print("\n[PASS] Metadata Enrichment")
    print("-" * 40)

    # Find strains missing key metadata
    strains = conn.execute("""
        SELECT s.id, s.name, s.normalized_name, s.strain_type, s.description,
            COALESCE(s.data_quality, 'full') as data_quality
        FROM strains s
        ORDER BY s.id
    """).fetchall()

    print(f"  Total strains to check: {len(strains)}")

    stats = {
        "descriptions": 0,
        "flavors": 0,
        "best_for": 0,
        "not_ideal": 0,
        "effects_boosted": 0,
        "skipped": 0,
    }
    processed = 0

    for sid, name, norm, stype, desc, dq in strains:
        if limit and processed >= limit:
            break
        if _is_enriched(conn, sid, pass_name):
            stats["skipped"] += 1
            continue

        processed += 1
        enriched_anything = False

        # Get current effects
        effects = conn.execute(
            "SELECT e.name, e.category FROM effect_reports er "
            "JOIN effects e ON e.id = er.effect_id "
            "WHERE er.strain_id = ? ORDER BY er.report_count DESC",
            (sid,),
        ).fetchall()
        effect_names = [e[0] for e in effects]
        effect_count = len(effects)

        # ── Fill missing flavors from terpene profile ──────────────────
        current_flavors = conn.execute(
            "SELECT COUNT(*) FROM strain_flavors WHERE strain_id = ?", (sid,)
        ).fetchone()[0]

        if current_flavors < 2:
            terps = conn.execute(
                "SELECT m.name FROM strain_compositions sc "
                "JOIN molecules m ON m.id = sc.molecule_id "
                "WHERE sc.strain_id = ? AND m.molecule_type = 'terpene' "
                "ORDER BY sc.percentage DESC LIMIT 3",
                (sid,),
            ).fetchall()
            existing_flavors = {r[0] for r in conn.execute(
                "SELECT flavor FROM strain_flavors WHERE strain_id = ?", (sid,)
            ).fetchall()}
            added = 0
            for (terp_name,) in terps:
                for fl in TERPENE_FLAVORS.get(terp_name, [])[:2]:
                    if fl not in existing_flavors and added < 3:
                        conn.execute(
                            "INSERT OR IGNORE INTO strain_flavors (strain_id, flavor) VALUES (?, ?)",
                            (sid, fl),
                        )
                        existing_flavors.add(fl)
                        added += 1
            if added:
                stats["flavors"] += added
                enriched_anything = True

        # ── Fill missing best_for / not_ideal_for ───────────────────────
        meta = conn.execute(
            "SELECT best_for, not_ideal_for FROM strain_metadata WHERE strain_id = ?",
            (sid,),
        ).fetchone()

        if meta:
            try:
                bf = json.loads(meta[0]) if meta[0] else []
            except (json.JSONDecodeError, TypeError):
                bf = []
            try:
                ni = json.loads(meta[1]) if meta[1] else []
            except (json.JSONDecodeError, TypeError):
                ni = []

            if not bf and effect_names:
                pos_effects = [e[0] for e in effects if e[1] == "positive"]
                bf = infer_best_for(pos_effects)
                if bf:
                    conn.execute(
                        "UPDATE strain_metadata SET best_for = ? WHERE strain_id = ?",
                        (json.dumps(bf), sid),
                    )
                    stats["best_for"] += 1
                    enriched_anything = True

            if not ni and effect_names:
                neg_effects = [e[0] for e in effects if e[1] == "negative"]
                pos_effects = [e[0] for e in effects if e[1] == "positive"]
                ni = infer_not_ideal(pos_effects, neg_effects)
                if ni:
                    conn.execute(
                        "UPDATE strain_metadata SET not_ideal_for = ? WHERE strain_id = ?",
                        (json.dumps(ni), sid),
                    )
                    stats["not_ideal"] += 1
                    enriched_anything = True

        # ── Boost effects if < 3 using terpene profile ──────────────────
        if effect_count < 3:
            terps = conn.execute(
                "SELECT m.name, sc.percentage FROM strain_compositions sc "
                "JOIN molecules m ON m.id = sc.molecule_id "
                "WHERE sc.strain_id = ? AND m.molecule_type = 'terpene' "
                "ORDER BY sc.percentage DESC LIMIT 3",
                (sid,),
            ).fetchall()
            current_effect_set = set(effect_names)
            for terp_name, _ in terps:
                for eff_name, cat in TERPENE_EFFECTS.get(terp_name, []):
                    if eff_name not in current_effect_set:
                        eff_id = get_or_create_effect(conn, eff_name, cat)
                        if eff_id:
                            base = 60 if cat == "positive" else 20
                            count = max(5, int(base * random.uniform(0.3, 0.6)))
                            conn.execute(
                                "INSERT OR IGNORE INTO effect_reports "
                                "(strain_id, effect_id, report_count, confidence, source) "
                                "VALUES (?, ?, ?, 0.75, 'enrichment')",
                                (sid, eff_id, count),
                            )
                            current_effect_set.add(eff_name)
                            enriched_anything = True

            if enriched_anything:
                stats["effects_boosted"] += 1

        # ── Generate description if missing ─────────────────────────────
        if not desc or len(desc.strip()) < 20 or desc.strip().upper() == "NULL":
            terps = conn.execute(
                "SELECT m.name FROM strain_compositions sc "
                "JOIN molecules m ON m.id = sc.molecule_id "
                "WHERE sc.strain_id = ? AND m.molecule_type = 'terpene' "
                "ORDER BY sc.percentage DESC LIMIT 2",
                (sid,),
            ).fetchall()
            terp_names = [t[0].title() for t in terps]
            pos_effects = [e[0].replace("-", " ").title() for e in effects if e[1] == "positive"][:2]
            stype_label = (stype or "hybrid").title()

            new_desc = f"{name} is a {stype_label.lower()} strain"
            if terp_names:
                new_desc += f" rich in {' and '.join(terp_names)}"
            if pos_effects:
                new_desc += f", known for {' and '.join(pos_effects).lower()} effects"
            new_desc += "."

            conn.execute("UPDATE strains SET description = ? WHERE id = ?", (new_desc[:300], sid))
            stats["descriptions"] += 1
            enriched_anything = True

        _mark_enriched(conn, sid, pass_name, "enriched" if enriched_anything else "no gaps")

        if processed % 500 == 0:
            conn.commit()
            print(f"  Progress: {processed}/{len(strains)}")

    conn.commit()
    print(f"  Descriptions: {stats['descriptions']}, Flavors: {stats['flavors']}, "
          f"Best-for: {stats['best_for']}, Not-ideal: {stats['not_ideal']}, "
          f"Effects boosted: {stats['effects_boosted']}, Skipped: {stats['skipped']}")


# ── Pass 3: Quality Promotion ──────────────────────────────────────────────

def promote_quality(conn: sqlite3.Connection, limit: int | None = None):
    """Recompute data_quality for all strains based on actual data coverage.

    full: 5+ effects, 3+ terpenes, description > 50 chars, cannabinoid data, metadata
    partial: Has effects OR terpenes but not complete
    search-only: Name and type only
    """
    pass_name = "quality-promote"

    print("\n[PASS] Quality Promotion")
    print("-" * 40)

    strains = conn.execute("""
        SELECT s.id, s.name, s.description,
            COALESCE(s.data_quality, 'full') as current_quality,
            (SELECT COUNT(*) FROM effect_reports er WHERE er.strain_id = s.id) as effect_count,
            (SELECT COUNT(*) FROM strain_compositions sc
             JOIN molecules m ON m.id = sc.molecule_id AND m.molecule_type = 'terpene'
             WHERE sc.strain_id = s.id) as terpene_count,
            (SELECT COUNT(*) FROM strain_compositions sc
             JOIN molecules m ON m.id = sc.molecule_id AND m.molecule_type = 'cannabinoid'
             WHERE sc.strain_id = s.id) as cannabinoid_count,
            (SELECT COUNT(*) FROM strain_metadata sm WHERE sm.strain_id = s.id) as has_metadata
        FROM strains s
        ORDER BY s.id
    """).fetchall()

    stats = {"promoted": 0, "demoted": 0, "unchanged": 0}
    processed = 0

    for sid, name, desc, current, effects, terps, canns, has_meta in strains:
        if limit and processed >= limit:
            break
        processed += 1

        desc_len = len((desc or "").strip())

        # Determine new quality level
        if effects >= 5 and terps >= 3 and desc_len >= 50 and canns >= 1 and has_meta:
            new_quality = "full"
        elif effects >= 1 or terps >= 1:
            new_quality = "partial"
        else:
            new_quality = "search-only"

        if new_quality != current:
            conn.execute(
                "UPDATE strains SET data_quality = ? WHERE id = ?",
                (new_quality, sid),
            )
            if new_quality == "full" and current != "full":
                stats["promoted"] += 1
            elif new_quality != "full" and current == "full":
                stats["demoted"] += 1
            else:
                stats["promoted"] += 1  # partial→full or search-only→partial

    conn.commit()
    print(f"  Promoted: {stats['promoted']}, Demoted: {stats['demoted']}")

    # Show final counts
    for quality in ["full", "partial", "search-only"]:
        count = conn.execute(
            "SELECT COUNT(*) FROM strains WHERE data_quality = ?", (quality,)
        ).fetchone()[0]
        print(f"  {quality}: {count}")


# ── Pipeline orchestrator ──────────────────────────────────────────────────

PASSES = {
    "terpenes": enrich_terpenes,
    "metadata": enrich_metadata,
    "quality": promote_quality,
}


def run_pipeline(passes: list[str] | None = None, limit: int | None = None, db_path: str | None = None):
    """Run enrichment passes in sequence."""
    if db_path is None:
        db_path = DB_PATH

    print("=" * 60)
    print("ENRICHMENT PIPELINE")
    print("=" * 60)

    conn = init_db(db_path)

    if passes is None:
        passes = list(PASSES.keys())

    for pass_name in passes:
        if pass_name not in PASSES:
            print(f"  Unknown pass: {pass_name}, skipping")
            continue
        PASSES[pass_name](conn, limit=limit)

    conn.close()
    print("\n" + "=" * 60)
    print("ENRICHMENT COMPLETE")
    print("=" * 60)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run strain enrichment pipeline")
    parser.add_argument("--pass", dest="pass_name", choices=list(PASSES.keys()),
                        help="Run a specific enrichment pass")
    parser.add_argument("--all", action="store_true", help="Run all passes")
    parser.add_argument("--limit", type=int, default=None, help="Limit strains processed per pass")
    parser.add_argument("--db", default=None, help="Database path override")
    args = parser.parse_args()

    if args.all:
        run_pipeline(passes=None, limit=args.limit, db_path=args.db)
    elif args.pass_name:
        run_pipeline(passes=[args.pass_name], limit=args.limit, db_path=args.db)
    else:
        print("Specify --pass <name> or --all")
        parser.print_help()
