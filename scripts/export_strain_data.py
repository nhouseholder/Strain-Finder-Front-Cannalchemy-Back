"""Export SQLite database → strain-data.js + strains.json.

Reads all strains, molecules, receptors, bindings, and canonical effects
from the database and generates the exact JSON schema the quiz engine
expects.

Outputs:
  - frontend/netlify/functions/strain-data.js  (edge function import)
  - frontend/src/data/strains.json             (dev/reference)

Size budget: ~1.8MB max for Netlify edge function. At ~1.2KB per strain
(optimized), 1,500 strains ≈ 1.8MB. If over budget, removes lowest-quality
strains first.

Usage:
    python scripts/export_strain_data.py [db_path]
"""
import json
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from cannalchemy.data.schema import init_db

# ── Constants ────────────────────────────────────────────────────────────────

MAX_FILE_SIZE = 1_800_000  # 1.8MB target max
STRAIN_DATA_JS = ROOT / "frontend" / "netlify" / "functions" / "strain-data.js"
STRAINS_JSON = ROOT / "frontend" / "src" / "data" / "strains.json"


def export_strain_data(db_path=None):
    if db_path is None:
        db_path = str(ROOT / "data" / "processed" / "cannalchemy.db")

    print("=" * 60)
    print("EXPORT STRAIN DATA")
    print("=" * 60)

    conn = init_db(db_path)

    # ── 1. Export molecules ──────────────────────────────────────────────
    print("\n[1/6] Exporting molecules...")
    molecules = []
    for row in conn.execute(
        "SELECT id, name, smiles, molecular_weight, molecule_type, description FROM molecules ORDER BY id"
    ):
        molecules.append({
            "id": row[0],
            "name": row[1],
            "smiles": row[2] or "",
            "mw": row[3] or 0,
            "type": row[4] or "other",
            "description": row[5] or "",
        })
    print(f"  {len(molecules)} molecules")

    # ── 2. Export receptors ──────────────────────────────────────────────
    print("\n[2/6] Exporting receptors...")
    receptors = []
    for row in conn.execute(
        "SELECT id, name, gene_name, location, function FROM receptors ORDER BY id"
    ):
        receptors.append({
            "id": row[0],
            "name": row[1],
            "gene": row[2] or "",
            "location": row[3] or "",
            "function": row[4] or "",
        })
    print(f"  {len(receptors)} receptors")

    # ── 3. Export bindings ───────────────────────────────────────────────
    print("\n[3/6] Exporting binding affinities...")
    bindings = []
    for row in conn.execute(
        "SELECT ba.id, m.name, r.name, ba.ki_nm, ba.action_type "
        "FROM binding_affinities ba "
        "JOIN molecules m ON m.id = ba.molecule_id "
        "JOIN receptors r ON r.id = ba.receptor_id "
        "ORDER BY ba.id"
    ):
        bindings.append({
            "id": row[0],
            "molecule": row[1],
            "receptor": row[2],
            "ki_nm": row[3] or 0,
            "action": row[4] or "",
        })
    print(f"  {len(bindings)} bindings")

    # ── 4. Export canonical effects ──────────────────────────────────────
    print("\n[4/6] Exporting canonical effects...")
    canonical_effects = []
    for row in conn.execute(
        "SELECT id, name, category, description, synonyms, receptor_pathway "
        "FROM canonical_effects ORDER BY id"
    ):
        canonical_effects.append({
            "id": row[0],
            "name": row[1],
            "category": row[2],
            "description": row[3] or "",
            "synonyms": json.loads(row[4]) if row[4] else [],
            "receptor_pathway": row[5] or "",
        })
    print(f"  {len(canonical_effects)} canonical effects")

    # ── 5. Export strains ────────────────────────────────────────────────
    print("\n[5/6] Exporting strains...")

    # Get all strains with a quality score for prioritization
    # Quality = effect count + (has real cannabinoid data) + (has terpene data)
    strain_rows = conn.execute("""
        SELECT s.id, s.name, s.strain_type, s.description,
            (SELECT COUNT(*) FROM effect_reports er WHERE er.strain_id = s.id) as effect_count,
            s.source
        FROM strains s
        ORDER BY effect_count DESC, s.id
    """).fetchall()

    strains = []
    for row in strain_rows:
        strain_id, name, strain_type, description, effect_count, source = row

        # Effects
        effects = []
        for er in conn.execute(
            "SELECT e.name, e.category, er.report_count, er.confidence "
            "FROM effect_reports er "
            "JOIN effects e ON e.id = er.effect_id "
            "WHERE er.strain_id = ? "
            "ORDER BY er.report_count DESC",
            (strain_id,),
        ):
            effects.append({
                "name": er[0],
                "category": er[1] or "positive",
                "reports": er[2],
                "confidence": round(er[3], 2) if er[3] else 1.0,
            })

        # Terpenes (molecule_type = 'terpene')
        terpenes = []
        for sc in conn.execute(
            "SELECT m.name, sc.percentage FROM strain_compositions sc "
            "JOIN molecules m ON m.id = sc.molecule_id "
            "WHERE sc.strain_id = ? AND m.molecule_type = 'terpene' "
            "ORDER BY sc.percentage DESC",
            (strain_id,),
        ):
            terpenes.append({
                "name": sc[0],
                "pct": f"{sc[1]}%",
            })

        # Cannabinoids
        cannabinoids = []
        for sc in conn.execute(
            "SELECT m.name, sc.percentage FROM strain_compositions sc "
            "JOIN molecules m ON m.id = sc.molecule_id "
            "WHERE sc.strain_id = ? AND m.molecule_type = 'cannabinoid' "
            "ORDER BY sc.percentage DESC",
            (strain_id,),
        ):
            cannabinoids.append({
                "name": sc[0],
                "value": round(sc[1], 1),
            })

        # Metadata
        meta = conn.execute(
            "SELECT consumption_suitability, price_range, best_for, not_ideal_for, "
            "genetics, lineage, description_extended "
            "FROM strain_metadata WHERE strain_id = ?",
            (strain_id,),
        ).fetchone()

        if meta:
            consumption = json.loads(meta[0]) if meta[0] else {}
            price_range = meta[1] or "mid"
            best_for = json.loads(meta[2]) if meta[2] else []
            not_ideal = json.loads(meta[3]) if meta[3] else []
            genetics = meta[4] or ""
            lineage = json.loads(meta[5]) if meta[5] else {"self": name}
            desc_ext = meta[6] or ""
        else:
            consumption = {}
            price_range = "mid"
            best_for = []
            not_ideal = []
            genetics = ""
            lineage = {"self": name}
            desc_ext = ""

        # Flavors
        flavors = [f[0] for f in conn.execute(
            "SELECT flavor FROM strain_flavors WHERE strain_id = ? ORDER BY flavor",
            (strain_id,),
        )]

        # Map old consumption keys to quiz engine format
        # DB stores: smoking, vaping, edibles, tinctures, topicals
        # Quiz engine expects: flower, vape, edibles, concentrates, tinctures, topicals
        consumption_mapped = {}
        if consumption:
            consumption_mapped = {
                "flower": consumption.get("smoking", consumption.get("flower", 5)),
                "vape": consumption.get("vaping", consumption.get("vape", 5)),
                "edibles": consumption.get("edibles", 4),
                "concentrates": consumption.get("concentrates", 4),
                "tinctures": consumption.get("tinctures", 3),
                "topicals": consumption.get("topicals", 2),
            }

        strain_obj = {
            "id": strain_id,
            "name": name,
            "type": strain_type or "hybrid",
            "description": (description or "")[:200],
            "effects": effects,
            "terpenes": terpenes[:5],  # Limit to top 5
            "cannabinoids": cannabinoids,
            "genetics": genetics,
            "description_extended": (desc_ext or description or "")[:200],
            "best_for": best_for[:3],
            "not_ideal_for": not_ideal[:3],
            "consumption_suitability": consumption_mapped,
            "price_range": price_range,
            "lineage": lineage,
            "flavors": [f.title() for f in flavors[:5]],  # Limit to 5, title case
        }

        strains.append(strain_obj)

    print(f"  {len(strains)} strains exported")

    # ── 6. Assemble and write ────────────────────────────────────────────
    print("\n[6/6] Writing output files...")

    data = {
        "strains": strains,
        "molecules": molecules,
        "receptors": receptors,
        "bindings": bindings,
        "canonicalEffects": canonical_effects,
    }

    # Compact JSON (no whitespace)
    json_str = json.dumps(data, separators=(",", ":"), ensure_ascii=False)

    # Check size
    size_bytes = len(json_str.encode("utf-8"))
    print(f"  JSON size: {size_bytes:,} bytes ({size_bytes / 1_000_000:.2f} MB)")

    # If over budget, trim lowest-quality strains
    if size_bytes > MAX_FILE_SIZE:
        print(f"  Over budget ({MAX_FILE_SIZE:,} bytes)! Trimming strains...")
        while size_bytes > MAX_FILE_SIZE and len(data["strains"]) > 100:
            # Remove last strain (lowest quality, since sorted by effect_count DESC)
            data["strains"].pop()
            json_str = json.dumps(data, separators=(",", ":"), ensure_ascii=False)
            size_bytes = len(json_str.encode("utf-8"))
        print(f"  Trimmed to {len(data['strains'])} strains ({size_bytes:,} bytes)")

    # Write strain-data.js
    js_content = f"// Auto-generated strain database for Netlify edge function\nexport default {json_str};\n"
    STRAIN_DATA_JS.parent.mkdir(parents=True, exist_ok=True)
    with open(STRAIN_DATA_JS, "w", encoding="utf-8") as f:
        f.write(js_content)
    js_size = STRAIN_DATA_JS.stat().st_size
    print(f"  Wrote {STRAIN_DATA_JS} ({js_size:,} bytes)")

    # Write strains.json (just the strains array, for frontend dev)
    STRAINS_JSON.parent.mkdir(parents=True, exist_ok=True)
    with open(STRAINS_JSON, "w", encoding="utf-8") as f:
        json.dump(data["strains"], f, separators=(",", ":"), ensure_ascii=False)
    json_size = STRAINS_JSON.stat().st_size
    print(f"  Wrote {STRAINS_JSON} ({json_size:,} bytes)")

    conn.close()

    print("\n" + "=" * 60)
    print("EXPORT COMPLETE")
    print("=" * 60)
    print(f"  Total strains:    {len(data['strains'])}")
    print(f"  strain-data.js:   {js_size:,} bytes")
    print(f"  strains.json:     {json_size:,} bytes")
    print("=" * 60)

    return len(data["strains"])


if __name__ == "__main__":
    db_path = sys.argv[1] if len(sys.argv) > 1 else None
    export_strain_data(db_path)
