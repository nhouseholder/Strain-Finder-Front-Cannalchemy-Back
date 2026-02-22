"""Generate WHY explanations from knowledge graph pathway data."""
from cannalchemy.data.graph import get_strain_profile, get_molecule_pathways


def explain_strain_match(
    graph,
    strain_name: str,
    desired_effects: list[str],
    effect_receptor_map: dict[str, str],
) -> str:
    """Build a beginner-friendly explanation of why a strain matches.

    Uses receptor binding data but writes in plain language.
    Template-based (no LLM call) for speed.
    """
    profile = get_strain_profile(graph, strain_name)
    if not profile or not profile.get("compositions"):
        return (
            f"{strain_name} is a great match based on what other users report. "
            f"Community data shows this strain aligns well with your desired effects."
        )

    # Get top molecules by percentage
    top_molecules = profile["compositions"][:3]

    # Friendly names for molecule actions
    FRIENDLY_MOLECULE = {
        "myrcene": ("a calming terpene found in mangoes and hops", "relaxation and physical comfort"),
        "limonene": ("an uplifting terpene found in citrus peels", "mood elevation and stress relief"),
        "caryophyllene": ("a spicy terpene found in black pepper", "anti-inflammatory effects and calm focus"),
        "linalool": ("a soothing terpene found in lavender", "relaxation and anxiety relief"),
        "pinene": ("a refreshing terpene found in pine needles", "mental clarity and alertness"),
        "terpinolene": ("a floral terpene found in lilacs and tea tree", "a balanced uplifting-yet-calming effect"),
        "humulene": ("an earthy terpene found in hops", "appetite control and subtle relaxation"),
        "ocimene": ("a sweet terpene found in basil and orchids", "energizing and uplifting effects"),
        "bisabolol": ("a gentle terpene found in chamomile", "soothing effects and anti-irritation"),
        "thc": ("the primary active compound in cannabis", "euphoria, relaxation, and pain relief"),
        "cbd": ("a non-intoxicating cannabinoid", "calming effects without the high"),
        "cbg": ("a minor cannabinoid sometimes called the 'parent molecule'", "focus and gentle relaxation"),
        "cbn": ("a cannabinoid associated with aged cannabis", "drowsiness and deep relaxation"),
    }

    FRIENDLY_RECEPTOR = {
        "CB1": "brain receptors that regulate mood, pain, and appetite",
        "CB2": "immune system receptors that help reduce inflammation",
        "TRPV1": "pain-sensing receptors (the same ones activated by chili peppers)",
        "5-HT1A": "serotonin receptors linked to mood and anxiety",
        "PPARgamma": "receptors involved in reducing inflammation",
        "GPR55": "receptors that help regulate bone health and blood pressure",
    }

    parts = []
    for mol in top_molecules:
        mol_name = mol["molecule"].lower()
        pct = mol["percentage"]
        pathways = get_molecule_pathways(graph, mol_name)
        if not pathways:
            continue

        best_pathway = _find_best_pathway(pathways, desired_effects, effect_receptor_map)
        if not best_pathway:
            best_pathway = pathways[0]

        receptor = best_pathway["receptor"]
        matched_effect = _pathway_matches_effect(receptor, desired_effects, effect_receptor_map)

        mol_info = FRIENDLY_MOLECULE.get(mol_name)
        rec_info = FRIENDLY_RECEPTOR.get(receptor, f"receptors in your body")

        if mol_info:
            description, benefit = mol_info
            effect_str = f" — especially for {matched_effect}" if matched_effect else ""
            parts.append(
                f"{mol_name.capitalize()} ({pct:.1f}%) is {description} that "
                f"works with your {rec_info}, promoting {benefit}{effect_str}."
            )
        else:
            display = mol_name.capitalize()
            parts.append(
                f"{display} ({pct:.1f}%) interacts with your {rec_info}"
                + (f", supporting {matched_effect}." if matched_effect else ".")
            )

    if not parts:
        return (
            f"{strain_name} is a great match based on what other users report. "
            f"Community data shows this strain aligns well with your desired effects."
        )

    intro = f"{strain_name} works with your body's natural chemistry. "
    return intro + " ".join(parts)


def get_strain_pathways(graph, strain_name: str) -> list[dict]:
    """Get structured pathway data for a strain's molecules.

    Returns list of:
    {molecule, receptor, ki_nm, action_type, effect_contribution, confidence}
    """
    profile = get_strain_profile(graph, strain_name)
    if not profile:
        return []

    pathways = []
    seen = set()

    for comp in profile.get("compositions", []):
        mol_name = comp["molecule"]
        mol_pathways = get_molecule_pathways(graph, mol_name)

        for p in mol_pathways:
            key = (mol_name, p["receptor"])
            if key in seen:
                continue
            seen.add(key)

            pathways.append({
                "molecule": mol_name,
                "receptor": p["receptor"],
                "ki_nm": p.get("ki_nm"),
                "action_type": p.get("action_type", ""),
                "effect_contribution": p.get("receptor_function", ""),
                "confidence": p.get("affinity_score", 0.5),
            })

    return pathways


def build_effect_predictions(
    graph,
    conn,
    strain_name: str,
    desired_canonicals: list[str],
    effect_receptor_map: dict[str, str],
) -> list[dict]:
    """Build effect predictions with probability and pathway info.

    Uses a combination of:
    - Effect report frequency (crowdsourced)
    - Receptor pathway alignment (pharmacology)
    """
    profile = get_strain_profile(graph, strain_name)
    if not profile:
        return []

    # Get effect report counts for this strain
    effect_counts = {}
    total_reports = 0
    for e in profile.get("effects", []):
        effect_counts[e["effect"]] = e["report_count"]
        total_reports += e["report_count"]

    # Get strain's molecule -> receptor bindings
    strain_receptors = set()
    for comp in profile.get("compositions", []):
        for p in get_molecule_pathways(graph, comp["molecule"]):
            strain_receptors.add(p["receptor"])

    predictions = []
    for canonical in desired_canonicals:
        # Factor 1: Report frequency (0-1)
        report_count = effect_counts.get(canonical, 0)
        report_prob = min(report_count / max(total_reports, 1) * 5, 1.0) if report_count > 0 else 0.0

        # Factor 2: Pathway alignment (0-1)
        pathway_str = effect_receptor_map.get(canonical, "")
        effect_receptors = {r.strip() for r in pathway_str.split(",") if r.strip()}
        if effect_receptors:
            overlap = len(strain_receptors & effect_receptors)
            pathway_prob = min(overlap / len(effect_receptors), 1.0)
        else:
            pathway_prob = 0.3

        # Combined probability
        probability = round(report_prob * 0.6 + pathway_prob * 0.4, 2)
        confidence = round(min(probability * 0.9, 0.95), 2)

        predictions.append({
            "effect": canonical,
            "probability": probability,
            "confidence": confidence,
            "pathway": pathway_str or "multiple pathways",
        })

    # Sort by probability descending
    predictions.sort(key=lambda x: x["probability"], reverse=True)
    return predictions


def _find_best_pathway(
    pathways: list[dict],
    desired_effects: list[str],
    effect_receptor_map: dict[str, str],
) -> dict | None:
    """Find the pathway most relevant to desired effects."""
    desired_receptors = set()
    for effect in desired_effects:
        pathway_str = effect_receptor_map.get(effect, "")
        for r in pathway_str.split(", "):
            if r.strip():
                desired_receptors.add(r.strip())

    for p in pathways:
        if p["receptor"] in desired_receptors:
            return p
    return None


def _pathway_matches_effect(
    receptor: str,
    desired_effects: list[str],
    effect_receptor_map: dict[str, str],
) -> str | None:
    """Find which desired effect a receptor contributes to."""
    for effect in desired_effects:
        pathway_str = effect_receptor_map.get(effect, "")
        if receptor in pathway_str:
            return effect.replace("-", " ")
    return None
