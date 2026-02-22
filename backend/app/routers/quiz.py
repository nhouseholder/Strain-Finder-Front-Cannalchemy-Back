"""Quiz recommendation endpoint."""
import json
import logging

from fastapi import APIRouter, HTTPException

from backend.app.database import db
from backend.app.models.quiz import (
    QuizRequest,
    RecommendationResponse,
    StrainResult,
    TerpeneInfo,
    CannabinoidInfo,
    ForumAnalysis,
    ForumPro,
    ForumCon,
    SommelierNotes,
    SommelierScores,
    EffectPrediction,
    PathwayInfo,
    Lineage,
    IdealProfile,
)
from backend.app.services.matching_engine import rank_strains
from backend.app.services.effect_mapper import (
    map_quiz_effects,
    canonical_to_display,
    EFFECT_RECEPTOR_PATHWAYS,
)
from backend.app.services.pathway_explainer import (
    explain_strain_match,
    get_strain_pathways,
    build_effect_predictions,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/quiz", tags=["quiz"])

# Cannabinoid display colors (matching SF's frontend)
CANNABINOID_COLORS = {
    "thc": "#ff8c32",
    "cbd": "#9775fa",
    "cbn": "#ffd43b",
    "cbg": "#51cf66",
    "thcv": "#22b8cf",
    "cbc": "#f06595",
}


@router.post("/recommend", response_model=RecommendationResponse)
async def recommend(quiz: QuizRequest):
    """Generate strain recommendations based on quiz answers."""
    if not db.conn or not db.graph:
        raise HTTPException(status_code=503, detail="Database not initialized")

    if not quiz.effects:
        raise HTTPException(status_code=400, detail="At least one effect must be selected")

    quiz_dict = quiz.model_dump()

    # Run matching engine
    ranked = rank_strains(db.conn, db.graph, quiz_dict, top_n=15)

    if not ranked:
        raise HTTPException(status_code=404, detail="No matching strains found")

    # Map quiz effects to canonical for explanations
    desired_canonicals = map_quiz_effects(quiz.effectRanking or quiz.effects)

    # Build response: top 5 as main results, 2 AI picks from 6-15
    main_results = []
    for strain_data in ranked[:5]:
        result = _build_strain_result(
            strain_data, desired_canonicals, quiz_dict
        )
        main_results.append(result)

    # AI Picks: pick 2 from positions 6-15 with type diversity
    ai_picks = _select_ai_picks(ranked[5:], main_results, desired_canonicals, quiz_dict)

    # Build ideal profile from top results
    ideal = _build_ideal_profile(ranked[:5], quiz_dict)

    return RecommendationResponse(
        strains=main_results,
        aiPicks=ai_picks,
        idealProfile=ideal,
    )


def _build_strain_result(
    strain_data: dict,
    desired_canonicals: list[str],
    quiz_state: dict,
) -> StrainResult:
    """Transform a scored strain into a StrainResult for the frontend."""
    name = strain_data["name"]
    strain_type = strain_data["type"] or "hybrid"
    compositions = strain_data["compositions"]
    meta = strain_data.get("metadata", {})

    # Extract cannabinoid values
    cannabinoid_values = {"thc": 0.0, "cbd": 0.0, "cbn": 0.0, "cbg": 0.0, "thcv": 0.0, "cbc": 0.0}
    terpene_list = []

    for comp in compositions:
        mol = comp["molecule"].lower()
        pct = comp["percentage"]
        if mol in cannabinoid_values:
            cannabinoid_values[mol] = pct
        elif comp.get("molecule_type") == "terpene":
            terpene_list.append(TerpeneInfo(
                name=comp["molecule"].capitalize(),
                pct=f"{pct:.1f}%",
            ))

    # Build cannabinoid array (matching SF format)
    cannabinoids = [
        CannabinoidInfo(name=n.upper(), value=v, color=CANNABINOID_COLORS.get(n, "#999"))
        for n, v in cannabinoid_values.items()
    ]

    # Limit terpenes to top 5
    terpene_list = terpene_list[:5]

    # Get effects from reports
    effects = _get_strain_effects(strain_data["strain_id"])

    # WHY explanation
    why_match = explain_strain_match(
        db.graph, name, desired_canonicals, EFFECT_RECEPTOR_PATHWAYS,
    )

    # Effect predictions
    effect_preds = build_effect_predictions(
        db.graph, db.conn, name, desired_canonicals, EFFECT_RECEPTOR_PATHWAYS,
    )

    # Pathway data
    pathways_raw = get_strain_pathways(db.graph, name)
    pathways = [PathwayInfo(**p) for p in pathways_raw[:10]]

    # Forum analysis from real data
    forum = _build_forum_analysis(strain_data["strain_id"])

    # Sommelier notes and scores (from flavors + terpene data)
    flavors = _get_strain_flavors(strain_data["strain_id"])
    sommelier_notes = _build_sommelier_notes(flavors, strain_type)
    sommelier_scores = _compute_sommelier_scores(
        terpene_list, cannabinoid_values, flavors, strain_type, forum
    )

    return StrainResult(
        name=name,
        type=strain_type,
        matchPct=strain_data["score"],
        thc=round(cannabinoid_values["thc"], 1),
        cbd=round(cannabinoid_values["cbd"], 1),
        genetics=meta.get("genetics", ""),
        lineage=Lineage(**meta.get("lineage", {"self": name})) if meta.get("lineage") else Lineage(**{"self": name}),
        effects=effects[:6],
        terpenes=terpene_list,
        cannabinoids=cannabinoids,
        whyMatch=why_match,
        forumAnalysis=forum,
        sentimentScore=forum.sentimentScore if forum else 0.0,
        sommelierNotes=sommelier_notes,
        sommelierScores=sommelier_scores,
        bestFor=meta.get("best_for", []),
        notIdealFor=meta.get("not_ideal_for", []),
        description=meta.get("description", ""),
        effectPredictions=[EffectPrediction(**ep) for ep in effect_preds[:6]],
        pathways=pathways,
    )


def _select_ai_picks(
    candidates: list[dict],
    main_results: list[StrainResult],
    desired_canonicals: list[str],
    quiz_state: dict,
) -> list[StrainResult]:
    """Select 2 diverse 'hidden gem' strains from remaining candidates."""
    if not candidates:
        return []

    main_types = {r.type for r in main_results}
    picks = []

    # First pick: different type if possible
    for c in candidates:
        if c["type"] not in main_types:
            result = _build_strain_result(c, desired_canonicals, quiz_state)
            result.reason = f"A {c['type']} option that brings a different terpene profile to explore."
            picks.append(result)
            break

    if not picks and candidates:
        result = _build_strain_result(candidates[0], desired_canonicals, quiz_state)
        result.reason = "A hidden gem with a unique molecular profile worth exploring."
        picks.append(result)

    # Second pick: from remaining
    remaining = [c for c in candidates if c["name"] != (picks[0].name if picks else "")]
    if remaining:
        result = _build_strain_result(remaining[0], desired_canonicals, quiz_state)
        result.reason = "An unexpected match with complementary receptor activity."
        picks.append(result)

    return picks[:2]


def _get_strain_effects(strain_id: int) -> list[str]:
    """Get display-formatted effect names for a strain."""
    rows = db.conn.execute(
        "SELECT e.name, er.report_count FROM effect_reports er "
        "JOIN effects e ON er.effect_id = e.id "
        "WHERE er.strain_id = ? ORDER BY er.report_count DESC LIMIT 8",
        (strain_id,),
    ).fetchall()

    return [canonical_to_display(row[0]) for row in rows]


def _get_strain_flavors(strain_id: int) -> list[str]:
    """Get flavors for a strain."""
    try:
        rows = db.conn.execute(
            "SELECT flavor FROM strain_flavors WHERE strain_id = ?",
            (strain_id,),
        ).fetchall()
        return [row[0] for row in rows]
    except Exception:
        return []


def _build_forum_analysis(strain_id: int) -> ForumAnalysis:
    """Build forum analysis from real effect report data."""
    rows = db.conn.execute(
        "SELECT e.name, e.category, er.report_count "
        "FROM effect_reports er "
        "JOIN effects e ON er.effect_id = e.id "
        "WHERE er.strain_id = ? ORDER BY er.report_count DESC",
        (strain_id,),
    ).fetchall()

    if not rows:
        return ForumAnalysis(
            totalReviews="Limited data",
            sentimentScore=5.0,
            pros=[ForumPro(effect="Community reported", pct=50, baseline=50)],
            cons=[ForumCon(effect="Limited reviews", pct=10, baseline=15)],
            sources="Strain Tracker community data",
        )

    total = sum(r[2] for r in rows)
    positive_count = sum(r[2] for r in rows if r[1] in ("positive", "medical"))
    negative_count = sum(r[2] for r in rows if r[1] == "negative")

    sentiment = round(
        (positive_count / max(total, 1)) * 10, 1
    ) if total > 0 else 5.0

    # Build pros (top positive/medical effects)
    pros = []
    for name, category, count in rows:
        if category in ("positive", "medical") and len(pros) < 4:
            pct = round((count / max(total, 1)) * 100)
            pros.append(ForumPro(
                effect=canonical_to_display(name),
                pct=min(pct, 95),
                baseline=max(pct - 15, 20),
            ))

    # Build cons (top negative effects)
    cons = []
    for name, category, count in rows:
        if category == "negative" and len(cons) < 3:
            pct = round((count / max(total, 1)) * 100)
            cons.append(ForumCon(
                effect=canonical_to_display(name),
                pct=min(pct, 80),
                baseline=max(pct - 10, 10),
            ))

    if not pros:
        pros = [ForumPro(effect="Positive effects reported", pct=60, baseline=50)]
    if not cons:
        cons = [ForumCon(effect="Minimal negatives reported", pct=10, baseline=15)]

    return ForumAnalysis(
        totalReviews=f"~{total} community reports",
        sentimentScore=sentiment,
        pros=pros,
        cons=cons,
        sources="Strain Tracker community data (24,853 strains)",
    )


def _compute_sommelier_scores(
    terpene_list: list,
    cannabinoid_values: dict,
    flavors: list[str],
    strain_type: str,
    forum: "ForumAnalysis | None",
) -> SommelierScores:
    """Compute sommelier scores from terpene/cannabinoid/flavor data.

    Produces varied, deterministic scores per strain based on actual composition.
    """
    import hashlib

    terp_names = [getattr(t, 'name', '') for t in terpene_list]
    terp_lower = [n.lower() for n in terp_names]
    terp_pcts = [float(getattr(t, 'pct', '0').replace('%', '')) for t in terpene_list]
    total_terp = sum(terp_pcts)
    dominant_terp = terp_lower[0] if terp_lower else ""
    dominant_pct = terp_pcts[0] if terp_pcts else 0
    n_terps = len(terp_names)
    thc = cannabinoid_values.get("thc", 0)
    cbd = cannabinoid_values.get("cbd", 0)
    n_flavors = len(flavors)
    sentiment = forum.sentimentScore if forum else 7.0

    # Deterministic per-strain variation from composition fingerprint
    fingerprint = f"{','.join(terp_lower)}:{thc:.1f}:{cbd:.1f}:{strain_type}"
    h = int(hashlib.md5(fingerprint.encode()).hexdigest()[:8], 16)
    # Extract 5 small offsets (-0.8 to +0.8) from hash
    offsets = [((h >> (i * 5)) & 0x1F) / 31.0 * 1.6 - 0.8 for i in range(5)]

    # === TASTE: dominant terpene flavor profile ===
    taste_terp_map = {"limonene": 1.5, "linalool": 1.2, "terpinolene": 1.3,
                      "ocimene": 1.0, "myrcene": 0.5, "caryophyllene": 0.8,
                      "pinene": 0.7, "humulene": 0.6, "bisabolol": 0.9}
    taste = 5.5 + taste_terp_map.get(dominant_terp, 0.4) + min(n_flavors * 0.6, 1.8)
    taste += min(dominant_pct * 1.2, 1.0) + offsets[0]

    # === AROMA: aromatic terpene richness ===
    aromatic = {"limonene", "linalool", "terpinolene", "ocimene", "bisabolol"}
    aroma_count = sum(1 for t in terp_lower if t in aromatic)
    aroma = 5 + aroma_count * 1.2 + min(total_terp * 0.8, 1.5)
    if dominant_terp in aromatic:
        aroma += 0.8
    aroma += offsets[1]

    # === SMOKE: smoothness from CBD, myrcene, linalool ===
    smooth = {"myrcene", "linalool", "bisabolol"}
    smooth_count = sum(1 for t in terp_lower if t in smooth)
    smoke = 5 + smooth_count * 0.9 + min(cbd * 0.5, 1.5)
    if dominant_terp == "myrcene":
        smoke += 0.7
    smoke += min(total_terp * 0.4, 0.8) + offsets[2]

    # === THROAT: THC harshness vs smoothing agents ===
    throat = 7 - min(max(thc - 18, 0) * 0.15, 2.5)
    if "linalool" in terp_lower:
        throat += 1.0
    if "myrcene" in terp_lower:
        throat += 0.5
    throat += min(cbd * 0.3, 1.0) + offsets[3]

    # === BURN: overall quality indicator from sentiment + composition ===
    burn = 4 + min(sentiment * 0.45, 3.5)
    burn += min(n_terps * 0.3, 1.0) + min(total_terp * 0.3, 0.5) + offsets[4]

    # Strain type adjustments
    if strain_type == "indica":
        smoke += 0.4
        throat += 0.3
    elif strain_type == "sativa":
        aroma += 0.5
        taste += 0.3

    def clamp(v):
        return max(3, min(10, round(v)))

    return SommelierScores(
        taste=clamp(taste),
        aroma=clamp(aroma),
        smoke=clamp(smoke),
        throat=clamp(throat),
        burn=clamp(burn),
    )


def _build_sommelier_notes(flavors: list[str], strain_type: str) -> SommelierNotes:
    """Generate sommelier notes from flavor data."""
    if not flavors:
        type_notes = {
            "indica": SommelierNotes(
                taste="Rich, earthy with deep undertones",
                aroma="Pungent, skunky with herbal notes",
                smoke="Smooth, full-bodied",
                burn="Even, slow burn",
            ),
            "sativa": SommelierNotes(
                taste="Bright, citrusy with floral hints",
                aroma="Sweet, tropical with pine accents",
                smoke="Light, airy draw",
                burn="Clean, white ash",
            ),
            "hybrid": SommelierNotes(
                taste="Balanced blend of sweet and earthy",
                aroma="Complex, layered terpene profile",
                smoke="Medium body, smooth finish",
                burn="Even, consistent burn",
            ),
        }
        return type_notes.get(strain_type, type_notes["hybrid"])

    flavor_str = ", ".join(flavors[:3]).lower()
    return SommelierNotes(
        taste=f"Notes of {flavor_str}",
        aroma=f"Aromatic with {flavor_str} undertones",
        smoke="Smooth, well-balanced draw",
        burn="Even, clean burn",
    )


def _build_ideal_profile(
    top_strains: list[dict],
    quiz_state: dict,
) -> IdealProfile:
    """Build ideal terpene/cannabinoid profile from top matching strains."""
    terpene_totals = {}
    thc_total = 0.0
    cbd_total = 0.0
    count = len(top_strains) or 1

    for strain in top_strains:
        for comp in strain["compositions"]:
            mol = comp["molecule"].lower()
            pct = comp["percentage"]
            if comp.get("molecule_type") == "terpene":
                terpene_totals[mol] = terpene_totals.get(mol, 0) + pct
            elif mol == "thc":
                thc_total += pct
            elif mol == "cbd":
                cbd_total += pct

    # Average and sort terpenes
    avg_terpenes = sorted(
        [(name, total / count) for name, total in terpene_totals.items()],
        key=lambda x: x[1],
        reverse=True,
    )[:5]

    return IdealProfile(
        terpenes=[{"name": name, "ratio": f"{avg:.2f}%"} for name, avg in avg_terpenes],
        cannabinoids={
            "thc": f"{thc_total / count:.0f}%",
            "cbd": f"{cbd_total / count:.1f}%",
        },
        subtype=quiz_state.get("subtype", "hybrid"),
    )
