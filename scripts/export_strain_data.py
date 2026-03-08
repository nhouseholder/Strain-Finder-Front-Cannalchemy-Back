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

MAX_FILE_SIZE = 8_000_000  # 8MB target max (Cloudflare Pages Functions support up to 10MB)
STRAIN_DATA_JS = ROOT / "frontend" / "functions" / "_data" / "strain-data.js"
STRAINS_JSON = ROOT / "frontend" / "src" / "data" / "strains.json"


def _compute_sentiment(effects):
    """Compute a sentiment score (1-10) from effect list."""
    import random
    pos = sum(e.get("reports", 0) * e.get("confidence", 1.0) for e in effects
              if e.get("category") == "positive")
    neg = sum(e.get("reports", 0) * e.get("confidence", 1.0) for e in effects
              if e.get("category") == "negative")
    total = pos + neg
    if total > 0:
        ratio = pos / total
        score = ratio * 4 + 5.5 + random.uniform(-0.3, 0.3)
        return max(5.0, min(9.5, score))
    return 7.0


def export_strain_data(db_path=None):
    if db_path is None:
        db_path = str(ROOT / "data" / "processed" / "cannalchemy.db")

    print("=" * 60)
    print("EXPORT STRAIN DATA")
    print("=" * 60)

    conn = init_db(db_path)

    # ── 1. Export molecules ──────────────────────────────────────────────
    print("\n[1/7] Exporting molecules...")
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
    print("\n[2/7] Exporting receptors...")
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
    print("\n[3/7] Exporting binding affinities...")
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
    print("\n[4/7] Exporting canonical effects...")
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

    # ── 4b. Load regional availability ───────────────────────────────────
    print("\n[4b/7] Loading regional availability scores...")
    REGION_ORDER = ["PAC", "MTN", "MWE", "GLK", "SOU", "NEN", "MAT"]
    region_map = {}  # strain_id → [PAC, MTN, MWE, GLK, SOU, NEN, MAT]
    for row in conn.execute(
        "SELECT strain_id, region_code, availability_score FROM strain_regions ORDER BY strain_id"
    ):
        sid, rc, score = row
        if sid not in region_map:
            region_map[sid] = {r: 40 for r in REGION_ORDER}
        region_map[sid][rc] = score
    print(f"  {len(region_map)} strains with regional data")

    # ── 5. Export strains ────────────────────────────────────────────────
    print("\n[5/7] Exporting strains...")

    # Get all strains with a quality score for prioritization
    # Quality = effect count + (has real cannabinoid data) + (has terpene data)
    # Full-data strains first, then partials sorted by effect count
    strain_rows = conn.execute("""
        SELECT s.id, s.name, s.strain_type, s.description,
            (SELECT COUNT(*) FROM effect_reports er WHERE er.strain_id = s.id) as effect_count,
            s.source,
            COALESCE(s.data_quality, 'full') as data_quality
        FROM strains s
        ORDER BY
            CASE COALESCE(s.data_quality, 'full')
                WHEN 'full' THEN 0
                WHEN 'partial' THEN 1
                WHEN 'search-only' THEN 2
                ELSE 3
            END,
            effect_count DESC, s.id
    """).fetchall()

    strains = []
    partial_count = 0
    for row in strain_rows:
        strain_id, name, strain_type, description, effect_count, source, data_quality = row
        # Enrichment strains are always treated as partial (archetype-estimated)
        is_partial = (data_quality in ("partial", "search-only")) or (source == "archetype")
        is_search_only = (data_quality == "search-only")

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

        if is_search_only:
            # Ultra-compact format for search-only strains (name + type only)
            # No fake terpene/cannabinoid data — only include if real data exists
            partial_count += 1
            strain_obj = {
                "id": strain_id,
                "name": name,
                "type": strain_type or "hybrid",
                "dataCompleteness": "search-only",
                "availability": 1,  # lowest commonness — safety net
            }
            # Regional availability
            if strain_id in region_map:
                strain_obj["reg"] = [region_map[strain_id][r] for r in REGION_ORDER]
            # Only add fields if real data exists
            if terpenes:
                strain_obj["terpenes"] = terpenes[:3]
            if cannabinoids:
                strain_obj["cannabinoids"] = cannabinoids[:2]
            if description and description.strip() and description.strip().upper() != "NULL":
                strain_obj["description"] = description[:100]
        elif is_partial:
            # Compact format: fewer fields for partial strains to save space
            # Only include terpenes/cannabinoids if real data exists
            partial_count += 1
            desc = (description or "").strip()
            if desc.upper() == "NULL":
                desc = ""
            strain_obj = {
                "id": strain_id,
                "name": name,
                "type": strain_type or "hybrid",
                "effects": effects[:5],
                "dataCompleteness": "partial",
                "availability": 2,  # low commonness — safety net
            }
            # Regional availability
            if strain_id in region_map:
                strain_obj["reg"] = [region_map[strain_id][r] for r in REGION_ORDER]
            if desc:
                strain_obj["description"] = desc[:160]
            if terpenes:
                strain_obj["terpenes"] = terpenes[:4]
            if cannabinoids:
                strain_obj["cannabinoids"] = cannabinoids
            if flavors:
                strain_obj["flavors"] = [f.title() for f in flavors[:3]]
            if genetics:
                strain_obj["genetics"] = genetics
            if source == "archetype":
                strain_obj["source"] = "archetype"
        else:
            # Full format: all fields for fully-verified strains
            strain_obj = {
                "id": strain_id,
                "name": name,
                "type": strain_type or "hybrid",
                "description": (description or "")[:160],
                "effects": effects[:8],
                "terpenes": terpenes[:6],
                "cannabinoids": cannabinoids,
                "dataCompleteness": "full",
                "genetics": genetics,
                "description_extended": (desc_ext or description or "")[:160],
                "best_for": best_for[:3],
                "not_ideal_for": not_ideal[:2],
                "consumption_suitability": consumption_mapped,
                "price_range": price_range,
                "lineage": lineage,
                "flavors": [f.title() for f in flavors[:5]],
                "availability": 5,
                "sentimentScore": round(_compute_sentiment(effects), 1),
            }
            # Regional availability
            if strain_id in region_map:
                strain_obj["reg"] = [region_map[strain_id][r] for r in REGION_ORDER]

        strains.append(strain_obj)

    search_only_count = sum(1 for s in strains if s.get("dataCompleteness") == "search-only")
    partial_only_count = partial_count - search_only_count
    full_count = len(strains) - partial_count
    print(f"  {len(strains)} strains exported ({full_count} full, {partial_only_count} partial, {search_only_count} search-only)")

    # ── 6. Build zip prefix → region map ─────────────────────────────────
    print("\n[6/7] Building zip prefix → region map...")
    # 3-digit zip prefix → region code
    ZIP_PREFIX_REGIONS = {
        # PAC: CA, OR, WA, HI, AK
        **{str(z).zfill(3): "PAC" for z in range(900, 962)},  # CA
        **{str(z).zfill(3): "PAC" for z in range(970, 979)},  # OR
        **{str(z).zfill(3): "PAC" for z in range(980, 995)},  # WA
        **{str(z).zfill(3): "PAC" for z in range(967, 969)},  # HI
        **{str(z).zfill(3): "PAC" for z in range(995, 1000)},  # AK
        "968": "PAC",  # HI
        "969": "PAC",  # Guam but map to PAC
        # MTN: CO, NV, AZ, NM, UT, MT, ID, WY
        **{str(z).zfill(3): "MTN" for z in range(800, 817)},  # CO
        **{str(z).zfill(3): "MTN" for z in range(889, 899)},  # NV
        **{str(z).zfill(3): "MTN" for z in range(850, 866)},  # AZ
        **{str(z).zfill(3): "MTN" for z in range(870, 885)},  # NM
        **{str(z).zfill(3): "MTN" for z in range(840, 848)},  # UT
        **{str(z).zfill(3): "MTN" for z in range(590, 600)},  # MT
        **{str(z).zfill(3): "MTN" for z in range(832, 839)},  # ID
        **{str(z).zfill(3): "MTN" for z in range(820, 832)},  # WY
        # MWE: IL, MI, MO, MN, WI, IN, IA, KS, NE, ND, SD
        **{str(z).zfill(3): "MWE" for z in range(600, 630)},  # IL
        **{str(z).zfill(3): "MWE" for z in range(480, 500)},  # MI
        **{str(z).zfill(3): "MWE" for z in range(630, 659)},  # MO
        **{str(z).zfill(3): "MWE" for z in range(550, 568)},  # MN
        **{str(z).zfill(3): "MWE" for z in range(530, 550)},  # WI
        **{str(z).zfill(3): "MWE" for z in range(460, 480)},  # IN
        **{str(z).zfill(3): "MWE" for z in range(500, 529)},  # IA
        **{str(z).zfill(3): "MWE" for z in range(660, 680)},  # KS
        **{str(z).zfill(3): "MWE" for z in range(680, 694)},  # NE
        **{str(z).zfill(3): "MWE" for z in range(580, 589)},  # ND
        **{str(z).zfill(3): "MWE" for z in range(570, 578)},  # SD
        # GLK: OH, PA (upstate)
        **{str(z).zfill(3): "GLK" for z in range(430, 459)},  # OH
        **{str(z).zfill(3): "GLK" for z in range(150, 197)},  # PA
        # SOU: FL, GA, TX, NC, VA, LA, SC, TN, AL, MS, AR, KY, WV, OK, MD, DC
        **{str(z).zfill(3): "SOU" for z in range(320, 350)},  # FL
        **{str(z).zfill(3): "SOU" for z in range(300, 320)},  # GA
        **{str(z).zfill(3): "SOU" for z in range(399, 400)},  # GA
        **{str(z).zfill(3): "SOU" for z in range(750, 800)},  # TX
        **{str(z).zfill(3): "SOU" for z in range(270, 290)},  # NC
        **{str(z).zfill(3): "SOU" for z in range(220, 247)},  # VA
        **{str(z).zfill(3): "SOU" for z in range(700, 715)},  # LA
        **{str(z).zfill(3): "SOU" for z in range(290, 300)},  # SC
        **{str(z).zfill(3): "SOU" for z in range(370, 386)},  # TN
        **{str(z).zfill(3): "SOU" for z in range(350, 370)},  # AL
        **{str(z).zfill(3): "SOU" for z in range(386, 398)},  # MS
        **{str(z).zfill(3): "SOU" for z in range(716, 730)},  # AR
        **{str(z).zfill(3): "SOU" for z in range(400, 428)},  # KY
        **{str(z).zfill(3): "SOU" for z in range(247, 270)},  # WV
        **{str(z).zfill(3): "SOU" for z in range(730, 750)},  # OK
        **{str(z).zfill(3): "SOU" for z in range(206, 219)},  # MD
        "200": "SOU", "201": "SOU", "202": "SOU", "203": "SOU", "204": "SOU", "205": "SOU",  # DC
        # NEN: MA, CT, ME, VT, NH, RI
        **{str(z).zfill(3): "NEN" for z in range(10, 28)},   # MA
        **{str(z).zfill(3): "NEN" for z in range(60, 70)},   # CT
        **{str(z).zfill(3): "NEN" for z in range(39, 50)},   # ME
        **{str(z).zfill(3): "NEN" for z in range(50, 60)},   # VT
        **{str(z).zfill(3): "NEN" for z in range(30, 39)},   # NH
        **{str(z).zfill(3): "NEN" for z in range(28, 30)},   # RI
        # MAT: NY, NJ, DE
        **{str(z).zfill(3): "MAT" for z in range(100, 150)},  # NY
        **{str(z).zfill(3): "MAT" for z in range(70, 90)},    # NJ
        **{str(z).zfill(3): "MAT" for z in range(197, 200)},  # DE
    }
    print(f"  {len(ZIP_PREFIX_REGIONS)} zip prefixes mapped")

    # ── 7. Assemble and write ────────────────────────────────────────────
    print("\n[7/7] Writing output files...")

    data = {
        "strains": strains,
        "molecules": molecules,
        "receptors": receptors,
        "bindings": bindings,
        "canonicalEffects": canonical_effects,
        "regionOrder": REGION_ORDER,
        "regionMap": ZIP_PREFIX_REGIONS,
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
    js_content = f"// Auto-generated strain database for Cloudflare Workers\nexport default {json_str};\n"
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
