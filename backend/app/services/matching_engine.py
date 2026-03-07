"""Matching Engine v2: Combines Strain Finder scoring with Cannalchemy receptor science.

Scoring layers:
  - Receptor Pathway (40%): molecule->receptor->effect binding affinity * concentration
  - Effect Reports   (25%): real crowdsourced effect report counts
  - Avoid Penalty    (15%): penalize strains with reported negative effects
  - Cannabinoid Fit  (10%): THC/CBD range matching
  - Preference Fit   (10%): subtype (5%), consumption (2.5%), budget (2.5%)
"""
import json
import sqlite3

import networkx as nx

from cannalchemy.data.graph import get_molecule_pathways
from backend.app.services.effect_mapper import (
    map_quiz_effects,
    map_avoid_effects,
    EFFECT_RECEPTOR_PATHWAYS,
)


# THC preference ranges (from SF's calcCannabinoidScore)
THC_RANGES = {
    "low": (0, 15),
    "medium": (15, 22),
    "high": (22, 28),
    "very_high": (28, 40),
    "no_preference": (0, 40),
}

# CBD preference ranges
CBD_RANGES = {
    "none": (0, 1),
    "some": (1, 5),
    "high": (5, 15),
    "cbd_dominant": (15, 30),
    "no_preference": (0, 30),
}

BUDGET_ORDER = ["budget", "mid", "premium", "top_shelf"]


def rank_strains(
    conn: sqlite3.Connection,
    graph: nx.DiGraph,
    quiz_state: dict,
    top_n: int = 15,
) -> list[dict]:
    """Score and rank all strains against quiz preferences.

    Returns top_n strains sorted by score descending, each with:
    {strain_id, name, type, score, ...strain data}
    """
    # Map quiz effects to canonical
    desired_canonicals = map_quiz_effects(quiz_state.get("effects", []))
    ranked_canonicals = map_quiz_effects(quiz_state.get("effectRanking", []))
    avoid_canonicals = map_avoid_effects(quiz_state.get("avoidEffects", []))

    # Get desired receptor profile
    desired_receptors = _build_receptor_profile(ranked_canonicals or desired_canonicals)

    # Load all strains with compositions
    strains = _load_scoreable_strains(conn)

    # Pre-load effect report data
    effect_reports = _load_effect_reports(conn)

    # Pre-load metadata
    metadata = _load_strain_metadata(conn)

    scored = []
    for strain in strains:
        sid = strain["id"]
        strain_name = strain["name"]

        # Layer 1: Receptor Pathway Score (40%)
        pathway_score = _calc_pathway_score(
            graph, strain_name, strain["compositions"],
            desired_receptors, ranked_canonicals or desired_canonicals,
        )

        # Layer 2: Effect Report Score (25%)
        effect_score = _calc_effect_report_score(
            effect_reports.get(sid, {}), desired_canonicals,
        )

        # Layer 3: Avoid Penalty (15%)
        avoid_score = _calc_avoid_score(
            effect_reports.get(sid, {}), avoid_canonicals,
        )

        # Layer 4: Cannabinoid Fit (10%)
        cannabinoid_score = _calc_cannabinoid_score(
            strain["compositions"],
            quiz_state.get("thcPreference", "no_preference"),
            quiz_state.get("cbdPreference", "no_preference"),
        )

        # Layer 5: Preference Fit (10%)
        meta = metadata.get(sid, {})
        preference_score = _calc_preference_score(
            strain["type"],
            quiz_state.get("subtype", "no_preference"),
            meta.get("consumption_suitability", {}),
            quiz_state.get("consumptionMethod"),
            meta.get("price_range", "mid"),
            quiz_state.get("budget"),
        )

        total = (
            pathway_score * 0.40
            + effect_score * 0.25
            + avoid_score * 0.15
            + cannabinoid_score * 0.10
            + preference_score * 0.10
        )
        total = max(0, min(100, round(total)))

        scored.append({
            "strain_id": sid,
            "name": strain_name,
            "type": strain["type"],
            "score": total,
            "compositions": strain["compositions"],
            "metadata": meta,
            "scores": {
                "pathway": round(pathway_score, 1),
                "effect": round(effect_score, 1),
                "avoid": round(avoid_score, 1),
                "cannabinoid": round(cannabinoid_score, 1),
                "preference": round(preference_score, 1),
            },
        })

    # Sort by score descending
    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored[:top_n]


def _build_receptor_profile(ranked_effects: list[str]) -> dict[str, float]:
    """Build a weighted receptor importance map from ranked effects.

    Returns {receptor_name: importance_weight}
    """
    receptor_weights = {}
    for i, effect in enumerate(ranked_effects):
        # Ranked effects get diminishing weight: 1.0, 0.8, 0.6, ...
        weight = max(1.0 - (i * 0.2), 0.2)
        pathway_str = EFFECT_RECEPTOR_PATHWAYS.get(effect, "")
        for receptor in pathway_str.split(", "):
            receptor = receptor.strip()
            if receptor:
                receptor_weights[receptor] = max(
                    receptor_weights.get(receptor, 0), weight
                )
    return receptor_weights


def _load_scoreable_strains(conn: sqlite3.Connection) -> list[dict]:
    """Load full-data strains that have composition data.

    Excludes search-only and partial strains so quiz results only contain
    strains with verified, complete profiles.
    """
    strains = {}

    rows = conn.execute(
        "SELECT s.id, s.name, s.strain_type, m.name, sc.percentage, m.molecule_type "
        "FROM strain_compositions sc "
        "JOIN strains s ON sc.strain_id = s.id "
        "JOIN molecules m ON sc.molecule_id = m.id "
        "WHERE COALESCE(s.data_quality, 'full') = 'full' "
        "ORDER BY s.id, sc.percentage DESC"
    ).fetchall()

    for row in rows:
        sid = row[0]
        if sid not in strains:
            strains[sid] = {
                "id": sid,
                "name": row[1],
                "type": row[2] or "unknown",
                "compositions": [],
            }
        strains[sid]["compositions"].append({
            "molecule": row[3],
            "percentage": row[4],
            "molecule_type": row[5],
        })

    return list(strains.values())


def _load_effect_reports(conn: sqlite3.Connection) -> dict[int, dict[str, int]]:
    """Load effect reports indexed by strain_id.

    Returns {strain_id: {effect_name: report_count}}
    """
    reports = {}
    rows = conn.execute(
        "SELECT er.strain_id, e.name, er.report_count "
        "FROM effect_reports er "
        "JOIN effects e ON er.effect_id = e.id"
    ).fetchall()

    for strain_id, effect_name, count in rows:
        if strain_id not in reports:
            reports[strain_id] = {}
        effect_lower = effect_name.lower()
        reports[strain_id][effect_lower] = (
            reports[strain_id].get(effect_lower, 0) + count
        )

    return reports


def _load_strain_metadata(conn: sqlite3.Connection) -> dict[int, dict]:
    """Load strain metadata (consumption suitability, price, etc.)."""
    metadata = {}
    try:
        rows = conn.execute(
            "SELECT strain_id, consumption_suitability, price_range, "
            "best_for, not_ideal_for, genetics, lineage, description_extended "
            "FROM strain_metadata"
        ).fetchall()
    except Exception:
        return metadata

    for row in rows:
        try:
            consumption = json.loads(row[1]) if row[1] else {}
        except (json.JSONDecodeError, TypeError):
            consumption = {}
        try:
            best_for = json.loads(row[3]) if row[3] else []
        except (json.JSONDecodeError, TypeError):
            best_for = []
        try:
            not_ideal = json.loads(row[4]) if row[4] else []
        except (json.JSONDecodeError, TypeError):
            not_ideal = []
        try:
            lineage = json.loads(row[6]) if row[6] else {}
        except (json.JSONDecodeError, TypeError):
            lineage = {}

        metadata[row[0]] = {
            "consumption_suitability": consumption,
            "price_range": row[2] or "mid",
            "best_for": best_for,
            "not_ideal_for": not_ideal,
            "genetics": row[5] or "",
            "lineage": lineage,
            "description": row[7] or "",
        }

    return metadata


def _calc_pathway_score(
    graph: nx.DiGraph,
    strain_name: str,
    compositions: list[dict],
    desired_receptors: dict[str, float],
    desired_effects: list[str],
) -> float:
    """Score a strain's molecular pathways against desired receptor profile.

    For each molecule in the strain:
      - Check which receptors it binds
      - Multiply: molecule_pct * affinity_score * receptor_importance
    """
    if not desired_receptors:
        return 50.0

    total_score = 0.0
    max_possible = sum(desired_receptors.values())

    for comp in compositions:
        mol_name = comp["molecule"]
        pct = comp["percentage"]
        # Normalize percentage contribution (cap at 0.5% for terpenes)
        pct_weight = min(pct / 0.5, 1.0) if comp.get("molecule_type") == "terpene" else min(pct / 20.0, 1.0)

        pathways = get_molecule_pathways(graph, mol_name)
        for p in pathways:
            receptor = p["receptor"]
            if receptor in desired_receptors:
                affinity = p.get("affinity_score", 0.5)
                importance = desired_receptors[receptor]
                total_score += pct_weight * affinity * importance

    if max_possible > 0:
        return min((total_score / max_possible) * 100, 100)
    return 50.0


def _calc_effect_report_score(
    strain_reports: dict[str, int],
    desired_canonicals: list[str],
) -> float:
    """Score based on real crowdsourced effect reports."""
    if not desired_canonicals or not strain_reports:
        return 50.0

    matched = 0
    for effect in desired_canonicals:
        if strain_reports.get(effect, 0) > 0:
            matched += 1

    return (matched / len(desired_canonicals)) * 100


def _calc_avoid_score(
    strain_reports: dict[str, int],
    avoid_canonicals: list[str],
) -> float:
    """Penalize strains with reported negative effects the user wants to avoid."""
    if not avoid_canonicals:
        return 100.0

    if not strain_reports:
        return 80.0  # No data = mild positive assumption

    penalties = 0
    for effect in avoid_canonicals:
        if strain_reports.get(effect, 0) > 0:
            penalties += 1

    penalty_rate = penalties / len(avoid_canonicals)
    return (1 - penalty_rate) * 100


def _calc_cannabinoid_score(
    compositions: list[dict],
    thc_pref: str,
    cbd_pref: str,
) -> float:
    """Score THC/CBD levels against user preferences."""
    # Extract THC and CBD values
    thc_val = 0.0
    cbd_val = 0.0
    for comp in compositions:
        mol = comp["molecule"].lower()
        if mol == "thc":
            thc_val = comp["percentage"]
        elif mol == "cbd":
            cbd_val = comp["percentage"]

    score = 50.0  # baseline

    # THC scoring
    thc_range = THC_RANGES.get(thc_pref, (0, 40))
    if thc_range[0] <= thc_val <= thc_range[1]:
        score += 25
    else:
        distance = min(abs(thc_val - thc_range[0]), abs(thc_val - thc_range[1]))
        score += max(0, 25 - distance * 3)

    # CBD scoring
    cbd_range = CBD_RANGES.get(cbd_pref, (0, 30))
    if cbd_range[0] <= cbd_val <= cbd_range[1]:
        score += 25
    else:
        distance = min(abs(cbd_val - cbd_range[0]), abs(cbd_val - cbd_range[1]))
        score += max(0, 25 - distance * 5)

    return score


def _calc_preference_score(
    strain_type: str,
    subtype_pref: str,
    consumption_suitability: dict,
    consumption_method: str | None,
    price_range: str,
    budget: str | None,
) -> float:
    """Score subtype, consumption, and budget preferences."""
    # Subtype (50% of preference score)
    if subtype_pref == "no_preference" or not subtype_pref:
        subtype_score = 100
    elif strain_type == subtype_pref:
        subtype_score = 100
    else:
        subtype_score = 40

    # Consumption suitability (25%)
    if not consumption_method or consumption_method == "no_preference":
        consumption_score = 100
    elif consumption_suitability:
        suitability = consumption_suitability.get(consumption_method, 3)
        consumption_score = (suitability / 5) * 100
    else:
        consumption_score = 60

    # Budget (25%)
    if not budget or budget == "no_preference":
        budget_score = 100
    else:
        try:
            strain_idx = BUDGET_ORDER.index(price_range)
            user_idx = BUDGET_ORDER.index(budget)
            diff = abs(strain_idx - user_idx)
            budget_score = max(0, 100 - diff * 35)
        except ValueError:
            budget_score = 60

    return subtype_score * 0.5 + consumption_score * 0.25 + budget_score * 0.25
