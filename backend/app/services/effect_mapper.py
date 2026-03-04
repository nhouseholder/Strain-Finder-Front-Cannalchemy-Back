"""Map Strain Finder quiz effect IDs to Cannalchemy canonical effects."""

# SF quiz effects -> canonical effect names (from taxonomy.py)
SF_TO_CANONICAL = {
    "relaxation": ["relaxed", "calm", "body-high"],
    "pain_relief": ["pain", "inflammation", "arthritis", "fibromyalgia"],
    "creativity": ["creative", "head-high"],
    "energy": ["energetic", "motivated", "uplifted"],
    "sleep": ["sleepy", "insomnia"],
    "anxiety_relief": ["calm", "anxiety", "stress"],
    "focus": ["focused"],
    "euphoria": ["euphoric", "happy", "giggly"],
    "social": ["talkative", "giggly", "uplifted"],
    "giggles": ["giggly", "happy", "euphoric"],
}

# SF avoid effects -> canonical negative effect names
SF_AVOID_TO_CANONICAL = {
    "anxiety": ["anxious", "paranoid"],
    "couch_lock": ["couch-lock"],
    "dry_mouth": ["dry-mouth"],
    "munchies": ["hungry"],
    "racing_heart": ["rapid-heartbeat"],
    "dizziness": ["dizzy"],
    "brain_fog": ["disoriented", "spacey"],
    "headache": ["headache"],
}

# Reverse map: canonical name -> SF display label
CANONICAL_TO_DISPLAY = {
    "relaxed": "Relaxed", "calm": "Calm", "body-high": "Body High",
    "euphoric": "Euphoric", "happy": "Happy", "creative": "Creative",
    "energetic": "Energetic", "focused": "Focused", "uplifted": "Uplifted",
    "giggly": "Giggly", "talkative": "Talkative", "tingly": "Tingly",
    "aroused": "Aroused", "hungry": "Hungry", "sleepy": "Sleepy",
    "motivated": "Motivated", "meditative": "Meditative",
    "head-high": "Head High", "spacey": "Spacey", "mouth-watering": "Mouth Watering",
    # Negatives
    "dry-mouth": "Dry Mouth", "dry-eyes": "Dry Eyes", "dizzy": "Dizzy",
    "paranoid": "Paranoid", "anxious": "Anxious", "headache": "Headache",
    "nauseous": "Nauseous", "rapid-heartbeat": "Rapid Heartbeat",
    "couch-lock": "Couch Lock", "disoriented": "Disoriented",
    "fatigued": "Fatigued", "irritable": "Irritable",
    # Medical
    "pain": "Pain Relief", "stress": "Stress Relief", "anxiety": "Anxiety Relief",
    "depression": "Depression Relief", "insomnia": "Sleep Aid",
    "nausea-relief": "Nausea Relief", "appetite-loss": "Appetite Stimulant",
    "inflammation": "Anti-Inflammatory", "muscle-spasms": "Muscle Spasm Relief",
    "seizures": "Seizure Relief", "ptsd": "PTSD Relief", "migraines": "Migraine Relief",
}

# Receptor pathway descriptions for each canonical effect (from taxonomy.py)
EFFECT_RECEPTOR_PATHWAYS = {
    "relaxed": "CB1, GABA-A",
    "euphoric": "CB1, dopamine D2",
    "happy": "CB1, 5-HT1A",
    "creative": "CB1, dopamine D2",
    "energetic": "CB1, TRPV1, norepinephrine",
    "focused": "CB1, dopamine D1, AChE",
    "uplifted": "CB1, 5-HT1A, dopamine",
    "sleepy": "CB1, GABA-A, adenosine",
    "calm": "CB1, 5-HT1A, GABA-A",
    "hungry": "CB1, ghrelin, hypothalamic",
    "motivated": "CB1, dopamine D1, D2",
    "talkative": "CB1, dopamine, GABA-A",
    "giggly": "CB1, dopamine D2",
    "body-high": "CB1, CB2, TRPV1",
    "head-high": "CB1, dopamine, serotonin",
    "pain": "CB1, CB2, TRPV1, mu-opioid",
    "stress": "CB1, 5-HT1A, HPA axis",
    "anxiety": "CB1, 5-HT1A, GABA-A",
    "inflammation": "CB2, PPARgamma, NF-kB",
    "insomnia": "CB1, GABA-A, adenosine",
    "arthritis": "CB1, CB2, TRPV1, PPARgamma",
    "fibromyalgia": "CB1, CB2, 5-HT1A, TRPV1",
    "appetite-loss": "CB1, ghrelin, hypothalamic",
}


def map_quiz_effects(sf_effect_ids: list[str]) -> list[str]:
    """Map SF quiz effect IDs to canonical effect names."""
    canonical = []
    for eid in sf_effect_ids:
        canonical.extend(SF_TO_CANONICAL.get(eid, []))
    return list(dict.fromkeys(canonical))  # dedupe preserving order


def map_avoid_effects(sf_avoid_ids: list[str]) -> list[str]:
    """Map SF avoid effect IDs to canonical negative effect names."""
    canonical = []
    for aid in sf_avoid_ids:
        canonical.extend(SF_AVOID_TO_CANONICAL.get(aid, []))
    return list(dict.fromkeys(canonical))


def get_receptors_for_effects(canonical_effects: list[str]) -> set[str]:
    """Get the set of receptors involved in a list of canonical effects."""
    receptors = set()
    for effect in canonical_effects:
        pathway = EFFECT_RECEPTOR_PATHWAYS.get(effect, "")
        for receptor in pathway.split(", "):
            receptor = receptor.strip()
            if receptor:
                receptors.add(receptor)
    return receptors


def canonical_to_display(canonical_name: str) -> str:
    """Convert canonical effect name to display label."""
    return CANONICAL_TO_DISPLAY.get(canonical_name, canonical_name.replace("-", " ").title())
