"""Unified strain ingestion engine.

Accepts strain records from any source adapter and inserts them into the
Cannalchemy SQLite database with deduplication, effect mapping, terpene
insertion, and metadata generation.

All source adapters yield normalized StrainRecord dicts and feed into
the single `ingest_strain()` function here.

Usage:
    python scripts/ingest_strains.py --source otreeba [--limit N]
    python scripts/ingest_strains.py --source cannlytics [--limit N]
"""
import argparse
import json
import re
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from cannalchemy.data.normalize import normalize_strain_name, match_strain_names
from cannalchemy.data.schema import init_db
from scripts.lib.ingest_helpers import (
    DEFAULT_CANNABINOIDS,
    DEFAULT_TERPENES,
    TERPENE_PCT_BY_POSITION,
    insert_strain_cannabinoids,
    insert_strain_effects,
    insert_strain_flavors,
    insert_strain_metadata,
    insert_strain_terpenes,
    map_effect_name,
    map_terpene_name,
)


def ingest_strain(
    conn: sqlite3.Connection,
    record: dict,
    known_names: dict[str, int],
    known_names_list: list[str],
    stats: dict,
    enrich_existing: bool = False,
) -> int | None:
    """Ingest a single strain record into the database.

    record shape:
        {
            "name": str,
            "strain_type": str,  # indica/sativa/hybrid
            "description": str,
            "genetics": str,
            "effects": [{"name": str, "category": str}],
            "flavors": [str],
            "terpenes": [{"name": str, "pct": float}],
            "cannabinoids": {"thc": float, "cbd": float, ...},
            "source": str,
            "source_id": str,
        }

    Returns strain_id if inserted, None if skipped.
    """
    name = (record.get("name") or "").strip()
    if not name:
        stats["skipped_noname"] += 1
        return None

    normalized = normalize_strain_name(name)
    if not normalized:
        stats["skipped_noname"] += 1
        return None

    # Exact-match dedup
    if normalized in known_names:
        if enrich_existing:
            return _enrich_existing(conn, known_names[normalized], record, stats)
        stats["skipped_dup"] += 1
        return None

    # Fuzzy-match dedup
    if known_names_list:
        matches = match_strain_names(normalized, known_names_list, limit=1, score_cutoff=85.0)
        if matches:
            if enrich_existing:
                matched_name = matches[0][0]
                return _enrich_existing(conn, known_names[matched_name], record, stats)
            stats["skipped_dup"] += 1
            return None

    # Determine strain type
    raw_type = (record.get("strain_type") or "").lower()
    if raw_type in ("indica", "sativa", "hybrid"):
        strain_type = raw_type
    elif "indica" in raw_type:
        strain_type = "indica"
    elif "sativa" in raw_type:
        strain_type = "sativa"
    else:
        strain_type = "hybrid"

    source = record.get("source", "unknown")
    source_id = record.get("source_id", "")
    description = (record.get("description") or "")[:500]

    # Insert strain
    cursor = conn.execute(
        "INSERT OR IGNORE INTO strains (name, normalized_name, strain_type, description, source, source_id) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        (name, normalized, strain_type, description, source, source_id),
    )
    if not cursor.lastrowid:
        stats["skipped_dup"] += 1
        return None

    strain_id = cursor.lastrowid
    known_names[normalized] = strain_id
    known_names_list.append(normalized)
    stats["created"] += 1

    # Effects
    effects = record.get("effects", [])
    if effects:
        insert_strain_effects(conn, strain_id, effects, source)
        stats["effects"] += len(effects)

    # Terpenes
    terpenes = record.get("terpenes", [])
    measurement_type = "reported"
    if not terpenes:
        # Use type-based defaults
        defaults = DEFAULT_TERPENES.get(strain_type, DEFAULT_TERPENES["hybrid"])
        terpenes = [{"name": t[0], "pct": t[1]} for t in defaults]
        measurement_type = "estimated"
    insert_strain_terpenes(conn, strain_id, terpenes, source, measurement_type)
    stats["terpenes"] += len(terpenes)

    # Cannabinoids
    cannabinoids = record.get("cannabinoids", {})
    cann_measurement = "reported"
    if not cannabinoids:
        cannabinoids = DEFAULT_CANNABINOIDS.get(strain_type, DEFAULT_CANNABINOIDS["hybrid"])
        cann_measurement = "estimated"
    insert_strain_cannabinoids(conn, strain_id, cannabinoids, source, cann_measurement)
    stats["cannabinoids"] += len(cannabinoids)

    # Flavors
    flavors = record.get("flavors", [])
    if flavors:
        insert_strain_flavors(conn, strain_id, flavors)
        stats["flavors"] += len(flavors)

    # Metadata
    genetics = record.get("genetics", "")
    lineage = {"self": name}
    if genetics:
        parents = re.split(r'\s*[xX×]\s*', genetics.strip())
        if len(parents) >= 2:
            lineage["parent1"] = parents[0].strip()
            lineage["parent2"] = parents[1].strip()

    insert_strain_metadata(
        conn, strain_id, name, strain_type, effects,
        genetics=genetics, lineage=lineage, description=description,
    )
    stats["metadata"] += 1

    # Log enrichment
    conn.execute(
        "INSERT OR IGNORE INTO enrichment_log (strain_id, pass_name, status, notes) "
        "VALUES (?, ?, 'completed', ?)",
        (strain_id, f"{source}-import", f"Ingested from {source}"),
    )

    return strain_id


def _enrich_existing(
    conn: sqlite3.Connection,
    strain_id: int,
    record: dict,
    stats: dict,
) -> int | None:
    """Enrich an existing strain with data from a new source (don't overwrite)."""
    source = record.get("source", "unknown")

    # Check if already enriched by this source
    already = conn.execute(
        "SELECT 1 FROM enrichment_log WHERE strain_id = ? AND pass_name = ?",
        (strain_id, f"{source}-enrich"),
    ).fetchone()
    if already:
        stats["skipped_dup"] += 1
        return None

    enriched = False

    # Add terpenes if strain has only estimated data
    terpenes = record.get("terpenes", [])
    if terpenes:
        existing = conn.execute(
            "SELECT measurement_type FROM strain_compositions sc "
            "JOIN molecules m ON m.id = sc.molecule_id "
            "WHERE sc.strain_id = ? AND m.molecule_type = 'terpene' "
            "LIMIT 1",
            (strain_id,),
        ).fetchone()
        if not existing or existing[0] == "estimated":
            insert_strain_terpenes(conn, strain_id, terpenes, source, "reported")
            enriched = True

    # Add cannabinoids if strain has only estimated data
    cannabinoids = record.get("cannabinoids", {})
    if cannabinoids:
        existing = conn.execute(
            "SELECT measurement_type FROM strain_compositions sc "
            "JOIN molecules m ON m.id = sc.molecule_id "
            "WHERE sc.strain_id = ? AND m.molecule_type = 'cannabinoid' "
            "LIMIT 1",
            (strain_id,),
        ).fetchone()
        if not existing or existing[0] == "estimated":
            insert_strain_cannabinoids(conn, strain_id, cannabinoids, source, "reported")
            enriched = True

    # Fill missing genetics
    genetics = record.get("genetics", "")
    if genetics:
        current = conn.execute(
            "SELECT genetics FROM strain_metadata WHERE strain_id = ?",
            (strain_id,),
        ).fetchone()
        if current and not (current[0] or "").strip():
            conn.execute(
                "UPDATE strain_metadata SET genetics = ? WHERE strain_id = ?",
                (genetics, strain_id),
            )
            enriched = True

    # Fill missing description
    description = record.get("description", "")
    if description and len(description) > 20:
        current = conn.execute(
            "SELECT description FROM strains WHERE id = ?", (strain_id,)
        ).fetchone()
        if current and (not current[0] or len(current[0]) < 20):
            conn.execute(
                "UPDATE strains SET description = ? WHERE id = ?",
                (description[:500], strain_id),
            )
            enriched = True

    if enriched:
        stats["enriched"] += 1
        conn.execute(
            "INSERT OR REPLACE INTO enrichment_log (strain_id, pass_name, status, notes) "
            "VALUES (?, ?, 'completed', ?)",
            (strain_id, f"{source}-enrich", f"Enriched from {source}"),
        )
        return strain_id

    stats["skipped_dup"] += 1
    return None


def run_ingestion(source_name: str, limit: int | None = None, enrich_existing: bool = False, db_path: str | None = None):
    """Run a full ingestion pass from a source adapter."""
    if db_path is None:
        db_path = str(ROOT / "data" / "processed" / "cannalchemy.db")

    print("=" * 60)
    print(f"STRAIN INGESTION: {source_name.upper()}")
    print("=" * 60)

    # Import the appropriate adapter
    if source_name == "otreeba":
        from scripts.sources.otreeba_adapter import fetch_strains
    elif source_name == "cannlytics":
        from scripts.sources.cannlytics_adapter import fetch_strains
    else:
        print(f"Unknown source: {source_name}")
        sys.exit(1)

    # Open database
    print("\n[1/4] Opening database...")
    conn = init_db(db_path)

    # Register data source
    conn.execute(
        "INSERT OR IGNORE INTO data_sources (name, source_type, notes) "
        "VALUES (?, 'api', ?)",
        (source_name, f"Imported via ingest_strains.py"),
    )
    conn.commit()

    # Load existing strains for dedup
    existing = conn.execute("SELECT id, normalized_name FROM strains").fetchall()
    known_names = {row[1]: row[0] for row in existing}
    known_names_list = list(known_names.keys())
    print(f"  Database has {len(known_names)} existing strains")

    # Ingest
    print(f"\n[2/4] Fetching strains from {source_name}...")
    stats = {
        "skipped_noname": 0,
        "skipped_dup": 0,
        "created": 0,
        "enriched": 0,
        "effects": 0,
        "terpenes": 0,
        "cannabinoids": 0,
        "flavors": 0,
        "metadata": 0,
    }

    count = 0
    for record in fetch_strains(limit=limit):
        ingest_strain(conn, record, known_names, known_names_list, stats, enrich_existing)
        count += 1
        if count % 100 == 0:
            conn.commit()
            print(f"  Processed {count} records ({stats['created']} new, {stats['enriched']} enriched)")

    # Commit
    print("\n[3/4] Committing...")
    conn.commit()

    # Update data source
    conn.execute(
        "UPDATE data_sources SET record_count = ?, last_updated = CURRENT_TIMESTAMP WHERE name = ?",
        (stats["created"], source_name),
    )
    conn.commit()
    conn.close()

    # Report
    print(f"\n[4/4] Import complete!")
    print("=" * 60)
    print(f"  Records processed:   {count}")
    print(f"  Strains created:     {stats['created']}")
    print(f"  Strains enriched:    {stats['enriched']}")
    print(f"  Skipped (no name):   {stats['skipped_noname']}")
    print(f"  Skipped (duplicate): {stats['skipped_dup']}")
    print(f"  Effect reports:      {stats['effects']}")
    print(f"  Terpene entries:     {stats['terpenes']}")
    print(f"  Cannabinoid entries: {stats['cannabinoids']}")
    print(f"  Flavor entries:      {stats['flavors']}")
    print(f"  Metadata records:    {stats['metadata']}")
    print("=" * 60)

    total = len(known_names)
    print(f"\n  Total strains in database: {total}")
    return stats


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Ingest strains from external sources")
    parser.add_argument("--source", required=True, choices=["otreeba", "cannlytics"],
                        help="Source adapter to use")
    parser.add_argument("--limit", type=int, default=None,
                        help="Max number of records to process")
    parser.add_argument("--enrich", action="store_true",
                        help="Enrich existing strains with new data (don't skip duplicates)")
    parser.add_argument("--db", default=None, help="Database path override")
    args = parser.parse_args()

    run_ingestion(args.source, limit=args.limit, enrich_existing=args.enrich, db_path=args.db)
