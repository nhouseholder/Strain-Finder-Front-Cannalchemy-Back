"""Strain lookup and enrichment request endpoints.

Provides real-time strain data from the database and triggers background
enrichment for unknown or incomplete strains.
"""
import asyncio
import json
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.app.database import db
from backend.app.services.strain_enricher import enrich_strain_async

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/strains", tags=["strains"])

CANNABINOID_COLORS = {
    "thc": "#ff8c32",
    "cbd": "#9775fa",
    "cbn": "#ffd43b",
    "cbg": "#51cf66",
    "thcv": "#22b8cf",
    "cbc": "#f06595",
}


# ── Response models ───────────────────────────────────────────────────────

class TerpeneData(BaseModel):
    name: str
    pct: str

class CannabinoidData(BaseModel):
    name: str
    value: float
    color: str = ""

class StrainLookupResponse(BaseModel):
    found: bool
    strain: Optional[dict] = None
    enrichmentStatus: str = "none"  # none, pending, complete
    message: str = ""

class StrainRequestBody(BaseModel):
    name: str


# ── Helper: build strain data from DB ─────────────────────────────────────

def _build_strain_data(strain_id: int, name: str, strain_type: str,
                       description: str, data_quality: str) -> dict:
    """Build a complete strain data dict from the database, matching
    the shape that normalizeStrain.js expects on the frontend."""
    conn = db.conn

    # Effects
    effects = []
    for row in conn.execute(
        "SELECT e.name, e.category, er.report_count, er.confidence "
        "FROM effect_reports er JOIN effects e ON e.id = er.effect_id "
        "WHERE er.strain_id = ? ORDER BY er.report_count DESC LIMIT 8",
        (strain_id,),
    ):
        effects.append({
            "name": row[0],
            "category": row[1] or "positive",
            "reports": row[2],
            "confidence": round(row[3], 2) if row[3] else 1.0,
        })

    # Terpenes
    terpenes = []
    for row in conn.execute(
        "SELECT m.name, sc.percentage FROM strain_compositions sc "
        "JOIN molecules m ON m.id = sc.molecule_id "
        "WHERE sc.strain_id = ? AND m.molecule_type = 'terpene' "
        "ORDER BY sc.percentage DESC LIMIT 6",
        (strain_id,),
    ):
        terpenes.append({"name": row[0], "pct": f"{row[1]}%"})

    # Cannabinoids
    cannabinoids = []
    for row in conn.execute(
        "SELECT m.name, sc.percentage FROM strain_compositions sc "
        "JOIN molecules m ON m.id = sc.molecule_id "
        "WHERE sc.strain_id = ? AND m.molecule_type = 'cannabinoid' "
        "ORDER BY sc.percentage DESC",
        (strain_id,),
    ):
        cannabinoids.append({
            "name": row[0].upper(),
            "value": round(row[1], 1),
            "color": CANNABINOID_COLORS.get(row[0].lower(), "#999"),
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

    # Map consumption keys
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

    # Flavors
    flavors = [r[0].title() for r in conn.execute(
        "SELECT flavor FROM strain_flavors WHERE strain_id = ? ORDER BY flavor",
        (strain_id,),
    )]

    # Reviews/sentiment
    sentiment_score = None
    review_count = None
    reviews = conn.execute(
        "SELECT rating, review_count FROM strain_reviews WHERE strain_id = ?",
        (strain_id,),
    ).fetchall()
    if reviews:
        total = sum(r[1] for r in reviews if r[1])
        if total > 0:
            weighted = sum(r[0] * r[1] for r in reviews if r[0] and r[1]) / total
            sentiment_score = round(weighted * 2, 1)
            review_count = total

    # Compute sentiment from effects if no review data
    if sentiment_score is None and effects:
        pos = sum(e["reports"] * e["confidence"] for e in effects if e["category"] == "positive")
        neg = sum(e["reports"] * e["confidence"] for e in effects if e["category"] == "negative")
        total = pos + neg
        if total > 0:
            ratio = pos / total
            sentiment_score = round(max(5.0, min(9.5, ratio * 4 + 5.5)), 1)
        else:
            sentiment_score = 7.0

    # Regional availability
    reg = None
    region_rows = conn.execute(
        "SELECT region_code, availability_score FROM strain_regions WHERE strain_id = ?",
        (strain_id,),
    ).fetchall()
    if region_rows:
        region_order = ["PAC", "MTN", "MWE", "GLK", "SOU", "NEN", "MAT"]
        region_map = {r: 40 for r in region_order}
        for rc, score in region_rows:
            region_map[rc] = score
        reg = [region_map[r] for r in region_order]

    strain_obj = {
        "id": strain_id,
        "name": name,
        "type": strain_type or "hybrid",
        "description": (description or "")[:160],
        "effects": effects,
        "terpenes": terpenes,
        "cannabinoids": cannabinoids,
        "dataCompleteness": data_quality or "partial",
        "genetics": genetics,
        "description_extended": (desc_ext or description or "")[:160],
        "best_for": best_for[:3],
        "not_ideal_for": not_ideal[:2],
        "consumption_suitability": consumption_mapped,
        "price_range": price_range,
        "lineage": lineage,
        "flavors": flavors[:5],
        "availability": 5 if data_quality == "full" else 2,
        "sentimentScore": sentiment_score,
    }
    if review_count:
        strain_obj["reviewCount"] = review_count
    if reg:
        strain_obj["reg"] = reg

    return strain_obj


# ── Endpoints ─────────────────────────────────────────────────────────────

@router.get("/lookup/{name}")
async def lookup_strain(name: str):
    """Look up a strain by name. Returns full data if available.

    This is the real-time API — always reads from the live database,
    not from the pre-exported strains.json.
    """
    if not db.conn:
        raise HTTPException(status_code=503, detail="Database not initialized")

    from cannalchemy.data.normalize import normalize_strain_name
    normalized = normalize_strain_name(name)

    # Exact match first
    row = db.conn.execute(
        "SELECT id, name, strain_type, description, COALESCE(data_quality, 'full') "
        "FROM strains WHERE normalized_name = ?",
        (normalized,),
    ).fetchone()

    if row:
        strain_data = _build_strain_data(row[0], row[1], row[2], row[3], row[4])
        enrichment = db.conn.execute(
            "SELECT pass_name FROM enrichment_log WHERE strain_id = ?", (row[0],)
        ).fetchall()
        status = "complete" if enrichment else "none"
        return StrainLookupResponse(
            found=True,
            strain=strain_data,
            enrichmentStatus=status,
        )

    # Fuzzy match
    from cannalchemy.data.normalize import match_strain_names
    known = [r[0] for r in db.conn.execute("SELECT normalized_name FROM strains").fetchall()]
    matches = match_strain_names(normalized, known, limit=1, score_cutoff=80.0)

    if matches:
        matched_name = matches[0][0]
        row = db.conn.execute(
            "SELECT id, name, strain_type, description, COALESCE(data_quality, 'full') "
            "FROM strains WHERE normalized_name = ?",
            (matched_name,),
        ).fetchone()
        if row:
            strain_data = _build_strain_data(row[0], row[1], row[2], row[3], row[4])
            return StrainLookupResponse(
                found=True,
                strain=strain_data,
                enrichmentStatus="complete" if row[4] == "full" else "none",
                message=f"Showing results for '{row[1]}'",
            )

    return StrainLookupResponse(
        found=False,
        message=f"Strain '{name}' not found in our database.",
    )


@router.post("/request")
async def request_strain(body: StrainRequestBody):
    """Request a strain be added and enriched.

    If the strain exists, returns it immediately.
    If not, creates a minimal record and kicks off background enrichment.
    Returns whatever data is available right away.
    """
    if not db.conn:
        raise HTTPException(status_code=503, detail="Database not initialized")

    name = body.name.strip()
    if not name or len(name) < 2:
        raise HTTPException(status_code=400, detail="Strain name must be at least 2 characters")

    from cannalchemy.data.normalize import normalize_strain_name, match_strain_names
    normalized = normalize_strain_name(name)

    # Check if already exists
    row = db.conn.execute(
        "SELECT id, name, strain_type, description, COALESCE(data_quality, 'full') "
        "FROM strains WHERE normalized_name = ?",
        (normalized,),
    ).fetchone()

    if row:
        strain_data = _build_strain_data(row[0], row[1], row[2], row[3], row[4])
        data_quality = row[4]

        # If not full quality, trigger background enrichment
        if data_quality != "full":
            asyncio.create_task(enrich_strain_async(row[0], row[1]))
            return StrainLookupResponse(
                found=True,
                strain=strain_data,
                enrichmentStatus="pending",
                message=f"Found '{row[1]}' with limited data. Enriching in the background...",
            )

        return StrainLookupResponse(
            found=True,
            strain=strain_data,
            enrichmentStatus="complete",
        )

    # Fuzzy match
    known = [r[0] for r in db.conn.execute("SELECT normalized_name FROM strains").fetchall()]
    matches = match_strain_names(normalized, known, limit=1, score_cutoff=80.0)
    if matches:
        matched_name = matches[0][0]
        row = db.conn.execute(
            "SELECT id, name, strain_type, description, COALESCE(data_quality, 'full') "
            "FROM strains WHERE normalized_name = ?",
            (matched_name,),
        ).fetchone()
        if row:
            strain_data = _build_strain_data(row[0], row[1], row[2], row[3], row[4])
            if row[4] != "full":
                asyncio.create_task(enrich_strain_async(row[0], row[1]))
            return StrainLookupResponse(
                found=True,
                strain=strain_data,
                enrichmentStatus="pending" if row[4] != "full" else "complete",
                message=f"Did you mean '{row[1]}'?",
            )

    # Create a new minimal record
    cursor = db.conn.execute(
        "INSERT OR IGNORE INTO strains (name, normalized_name, strain_type, description, source, data_quality) "
        "VALUES (?, ?, 'hybrid', '', 'user-request', 'search-only')",
        (name, normalized),
    )
    db.conn.commit()

    if cursor.lastrowid:
        strain_id = cursor.lastrowid
        # Insert minimal metadata
        db.conn.execute(
            "INSERT OR IGNORE INTO strain_metadata (strain_id, genetics, lineage) VALUES (?, '', ?)",
            (strain_id, json.dumps({"self": name})),
        )
        db.conn.commit()

        # Build minimal response
        strain_data = {
            "id": strain_id,
            "name": name,
            "type": "hybrid",
            "description": "",
            "effects": [],
            "terpenes": [],
            "cannabinoids": [],
            "dataCompleteness": "search-only",
            "genetics": "",
            "best_for": [],
            "not_ideal_for": [],
            "flavors": [],
            "availability": 1,
        }

        # Kick off background enrichment
        asyncio.create_task(enrich_strain_async(strain_id, name))

        return StrainLookupResponse(
            found=True,
            strain=strain_data,
            enrichmentStatus="pending",
            message=f"'{name}' added to our database. Enriching now — check back shortly for full data.",
        )

    raise HTTPException(status_code=500, detail="Failed to create strain record")
