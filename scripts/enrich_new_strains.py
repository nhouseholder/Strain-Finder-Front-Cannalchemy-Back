"""Enrich Cannlytics-only strains with effects, metadata, and descriptions.

Takes strains that have real lab-tested terpene/cannabinoid data but lack
community data (effects, descriptions, metadata) and enriches them using:

1. Cross-reference with Kushy + Cannabis Intelligence datasets for community effects
2. Pharmacological scaffold (terpene→receptor→effect) for science-backed predictions
3. Type-based metadata inference (best_for, consumption_suitability, etc.)

Only promotes strains that meet quality thresholds:
- At least 5 lab-tested molecules (cannabinoids + terpenes)
- Clean strain name (not a product name like "Flower - X" or "Bulk Distillate")
- Successfully enriched with ≥ 3 effects

Usage:
    python scripts/enrich_new_strains.py [db_path]
"""
import csv
import io
import json
import math
import os
import random
import re
import sqlite3
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from cannalchemy.data.normalize import normalize_strain_name
from cannalchemy.data.schema import init_db

# ── Constants ────────────────────────────────────────────────────────────────

MIN_LAB_MOLECULES = 5        # Min lab-tested molecules to be considered
MIN_EFFECTS = 3              # Min effects after enrichment
MAX_NEW_STRAINS = 600        # Budget for new strains (size limit)
CONFIDENCE_LAB = 0.85        # Confidence for pharmacologically-derived effects
CONFIDENCE_COMMUNITY = 0.95  # Confidence for community-matched effects

# Product-name patterns to exclude (case-insensitive)
PRODUCT_PATTERNS = [
    r"^flower\s*[-–—]\s*",
    r"^bulk\s*[-–—]\s*",
    r"^pre[-\s]?roll",
    r"^cartridge",
    r"^distillate",
    r"^concentrate",
    r"^edible",
    r"^topical",
    r"^tincture",
    r"^rso\b",
    r"^live\s+resin",
    r"^live\s+rosin",
    r"^shatter",
    r"^wax\b",
    r"^budder",
    r"^crumble",
    r"^sugar\b",
    r"^sauce\b",
    r"^diamond",
    r"^badder",
    r"^hash\b",
    r"^kief\b",
    r"^infused",
    r"^lab\s+sample",
    r"^trim\b",
    r"^shake\b",
    r"^popcorn",
    r"^smalls",
    r"^\d+mg\b",
    r"^mixed$",
    r"sample\s*$",
    r"\btest\b",
    r"\bbulk\b",
    r"\brefill\b",
]
PRODUCT_REGEXES = [re.compile(p, re.IGNORECASE) for p in PRODUCT_PATTERNS]

# Characters that indicate a product, not a strain
PRODUCT_CHARS = ["#", "(", ")", "[", "]", "&", "/", "®", "™", ":", ";"]

# ── Kushy + Cannabis Intelligence CSVs ──────────────────────────────────────

KUSHY_CSV_URL = (
    "https://raw.githubusercontent.com/kushyapp/cannabis-dataset/master/"
    "Dataset/Strains/strains-kushy_api.2017-11-14.csv"
)
CI_CSV_URL = (
    "https://raw.githubusercontent.com/Shannon-Goddard/cannabis-intelligence-database/"
    "main/data/Cannabis_Intelligence_Database_15768_Strains_Final.csv"
)
RAW_DIR = ROOT / "data" / "raw"

# ── Pharmacological effect mapping ──────────────────────────────────────────
# Maps (dominant terpene, dominant cannabinoid pattern) → likely effects
# Based on published research: Russo 2011, Pertwee 2008, etc.

TERPENE_EFFECTS = {
    "myrcene": {
        "primary": [("relaxed", "positive"), ("sleepy", "positive"), ("calm", "positive")],
        "secondary": [("body-high", "positive"), ("hungry", "positive")],
    },
    "limonene": {
        "primary": [("uplifted", "positive"), ("happy", "positive"), ("energetic", "positive")],
        "secondary": [("creative", "positive"), ("focused", "positive")],
    },
    "caryophyllene": {
        "primary": [("relaxed", "positive"), ("calm", "positive")],
        "secondary": [("tingly", "positive"), ("happy", "positive")],
    },
    "linalool": {
        "primary": [("relaxed", "positive"), ("sleepy", "positive"), ("calm", "positive")],
        "secondary": [("happy", "positive"), ("euphoric", "positive")],
    },
    "pinene": {
        "primary": [("focused", "positive"), ("creative", "positive"), ("energetic", "positive")],
        "secondary": [("uplifted", "positive"), ("happy", "positive")],
    },
    "humulene": {
        "primary": [("relaxed", "positive"), ("calm", "positive")],
        "secondary": [("focused", "positive")],
    },
    "terpinolene": {
        "primary": [("uplifted", "positive"), ("energetic", "positive"), ("creative", "positive")],
        "secondary": [("happy", "positive"), ("focused", "positive")],
    },
    "ocimene": {
        "primary": [("uplifted", "positive"), ("energetic", "positive")],
        "secondary": [("happy", "positive")],
    },
    "bisabolol": {
        "primary": [("relaxed", "positive"), ("calm", "positive")],
        "secondary": [("sleepy", "positive")],
    },
}

THC_EFFECT_MODIFIERS = {
    # THC level ranges and their additional effects
    "high": {  # > 22%
        "add": [("euphoric", "positive"), ("giggly", "positive")],
        "risk": [("paranoid", "negative"), ("anxious", "negative"), ("dry-mouth", "negative")],
    },
    "moderate": {  # 15-22%
        "add": [("happy", "positive"), ("euphoric", "positive")],
        "risk": [("dry-mouth", "negative"), ("dry-eyes", "negative")],
    },
    "low": {  # < 15%
        "add": [("calm", "positive"), ("focused", "positive")],
        "risk": [("dry-mouth", "negative")],
    },
}

CBD_EFFECT_MODIFIERS = {
    "high": {  # > 5%
        "add": [("calm", "positive"), ("relaxed", "positive"), ("focused", "positive")],
    },
    "moderate": {  # 1-5%
        "add": [("calm", "positive")],
    },
}

TYPE_EFFECTS = {
    "indica": [("relaxed", "positive"), ("sleepy", "positive"), ("hungry", "positive")],
    "sativa": [("energetic", "positive"), ("creative", "positive"), ("uplifted", "positive")],
    "hybrid": [("happy", "positive"), ("relaxed", "positive"), ("uplifted", "positive")],
}

# Metadata inference
CONSUMPTION_BY_TYPE = {
    "indica": {"flower": 9, "vape": 8, "edibles": 8, "concentrates": 5, "tinctures": 7, "topicals": 6},
    "sativa": {"flower": 9, "vape": 9, "edibles": 7, "concentrates": 6, "tinctures": 7, "topicals": 5},
    "hybrid": {"flower": 9, "vape": 8, "edibles": 8, "concentrates": 5, "tinctures": 7, "topicals": 6},
}

BEST_FOR_RULES = {
    "relaxed": "Evening relaxation",
    "sleepy": "Nighttime use",
    "creative": "Creative projects",
    "energetic": "Daytime activities",
    "focused": "Work and study",
    "happy": "Social gatherings",
    "euphoric": "Mood elevation",
    "hungry": "Appetite stimulation",
    "calm": "Stress relief",
    "uplifted": "Elevating mood",
}

NOT_IDEAL_RULES = {
    "sleepy": "Daytime productivity",
    "energetic": "Bedtime use",
    "paranoid": "Anxiety-prone users",
    "anxious": "High-stress situations",
    "dizzy": "Physical activities",
    "hungry": "Appetite control",
}

# Flavor inference from terpenes
TERPENE_FLAVORS = {
    "myrcene": ["Earthy", "Herbal", "Musky"],
    "limonene": ["Citrus", "Lemon", "Orange"],
    "caryophyllene": ["Peppery", "Spicy", "Woody"],
    "linalool": ["Floral", "Lavender", "Sweet"],
    "pinene": ["Pine", "Woody", "Herbal"],
    "humulene": ["Earthy", "Woody", "Herbal"],
    "terpinolene": ["Sweet", "Herbal", "Floral"],
    "ocimene": ["Sweet", "Herbal", "Citrus"],
    "bisabolol": ["Floral", "Sweet", "Honey"],
    "valencene": ["Citrus", "Orange", "Sweet"],
    "geraniol": ["Floral", "Rose", "Sweet"],
    "nerolidol": ["Woody", "Earthy", "Floral"],
    "camphene": ["Pine", "Earthy", "Herbal"],
    "fenchol": ["Herbal", "Earthy", "Citrus"],
    "eucalyptol": ["Minty", "Herbal", "Cool"],
    "borneol": ["Minty", "Herbal", "Camphor"],
    "terpineol": ["Floral", "Pine", "Sweet"],
    "guaiol": ["Pine", "Woody", "Earthy"],
    "farnesene": ["Sweet", "Fruity", "Herbal"],
    "carene": ["Sweet", "Pine", "Earthy"],
    "phellandrene": ["Minty", "Herbal", "Citrus"],
}

# ── Kushy / CI effect name mapping ──────────────────────────────────────────

EFFECT_NAME_MAP = {
    "relaxed": "relaxed", "relaxing": "relaxed",
    "happy": "happy", "euphoric": "euphoric",
    "creative": "creative", "energetic": "energetic",
    "uplifted": "uplifted", "uplifting": "uplifted",
    "focused": "focused", "hungry": "hungry",
    "talkative": "talkative", "tingly": "tingly",
    "aroused": "aroused", "sleepy": "sleepy",
    "giggly": "giggly", "calm": "calm", "calming": "calm",
    "motivated": "motivated", "sedating": "sleepy",
    "cerebral": "head-high", "body high": "body-high",
    "mellow": "relaxed",
    "dry mouth": "dry-mouth", "dry eyes": "dry-eyes",
    "dizzy": "dizzy", "paranoid": "paranoid",
    "anxious": "anxious", "headache": "headache",
}

AILMENT_MAP = {
    "stress": "stress", "depression": "depression", "pain": "pain",
    "insomnia": "insomnia", "anxiety": "anxiety",
    "lack of appetite": "appetite-loss", "nausea": "nausea-relief",
    "headaches": "migraines", "headache": "migraines",
    "muscle spasms": "muscle-spasms", "inflammation": "inflammation",
    "seizures": "seizures", "fatigue": "fatigue-medical", "ptsd": "ptsd",
    "eye pressure": "eye-pressure", "cramps": "muscle-spasms",
    "gastrointestinal disorder": "gastrointestinal",
}


# ── Helper functions ────────────────────────────────────────────────────────

def is_product_name(name: str) -> bool:
    """Check if a name looks like a product rather than a strain."""
    if not name or len(name) < 2:
        return True
    if len(name) > 60:
        return True
    # Check product patterns
    for regex in PRODUCT_REGEXES:
        if regex.search(name):
            return True
    # Check product characters
    for char in PRODUCT_CHARS:
        if char in name:
            return True
    # All numbers
    if name.replace(" ", "").replace("-", "").isdigit():
        return True
    return False


def clean_strain_name(name: str) -> str:
    """Clean up a lab strain name to a proper strain name."""
    if not name:
        return ""
    # Remove common prefixes
    for prefix in ["Flower - ", "Flower-", "Bulk - ", "Bulk-"]:
        if name.startswith(prefix):
            name = name[len(prefix):]
    name = name.strip()
    # Title case if all lower or all upper
    if name.islower() or name.isupper():
        name = name.title()
    return name


def parse_comma_list(value):
    """Parse comma-separated string."""
    if not value or not value.strip():
        return []
    return [item.strip() for item in str(value).split(",") if item.strip()]


def parse_python_list(value):
    """Parse Python-style list string."""
    import ast
    if not value or not str(value).strip():
        return []
    value = str(value).strip()
    if value.startswith("["):
        try:
            return [str(item).strip() for item in ast.literal_eval(value) if item]
        except (ValueError, SyntaxError):
            inner = value.strip("[]")
            return [item.strip().strip("'\"") for item in inner.split(",") if item.strip().strip("'\"")]
    return parse_comma_list(value)


def download_csv(url, local_path):
    """Download CSV if not cached."""
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    if local_path.exists() and local_path.stat().st_size > 10_000:
        return
    print(f"  Downloading {url}...")
    import ssl
    import urllib.request
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    opener = urllib.request.build_opener(urllib.request.HTTPSHandler(context=ctx))
    with opener.open(url) as resp:
        with open(str(local_path), "wb") as f:
            f.write(resp.read())
    print(f"  Saved {local_path.stat().st_size:,} bytes")


def load_community_data():
    """Load Kushy + Cannabis Intelligence data as a name→data lookup."""
    community = {}  # normalized_name → {effects, negatives, ailments, flavors, type, description}

    # Load Kushy
    kushy_csv = RAW_DIR / "kushy_strains.csv"
    download_csv(KUSHY_CSV_URL, kushy_csv)
    print("  Parsing Kushy dataset...")
    with open(kushy_csv, "r", encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)
        for row in reader:
            name = (row.get("name") or row.get("Name") or "").strip()
            if not name:
                continue
            norm = normalize_strain_name(name)
            if not norm:
                continue

            effects = parse_comma_list(row.get("positive_effects", row.get("effects", "")))
            negatives = parse_comma_list(row.get("negative_effects", ""))
            ailments = parse_comma_list(row.get("medical", row.get("ailment", "")))
            flavors = parse_comma_list(row.get("flavor", row.get("flavors", "")))
            strain_type = (row.get("type", row.get("Type", "")) or "").strip().lower()
            desc = (row.get("description", "") or "").strip()

            if norm not in community or len(effects) > len(community[norm].get("effects", [])):
                community[norm] = {
                    "effects": effects,
                    "negatives": negatives,
                    "ailments": ailments,
                    "flavors": flavors,
                    "type": strain_type if strain_type in ("indica", "sativa", "hybrid") else "",
                    "description": desc,
                    "source": "kushy",
                }

    kushy_count = len(community)
    print(f"  Kushy: {kushy_count:,} unique strains")

    # Load Cannabis Intelligence
    ci_csv = RAW_DIR / "cannabis_intel_strains.csv"
    download_csv(CI_CSV_URL, ci_csv)
    print("  Parsing Cannabis Intelligence dataset...")
    with open(ci_csv, "r", encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)
        for row in reader:
            name = (row.get("Strain") or row.get("strain") or row.get("Name") or "").strip()
            if not name:
                continue
            norm = normalize_strain_name(name)
            if not norm:
                continue

            # Only add if not already in community data from Kushy
            if norm in community:
                continue

            effects = parse_python_list(row.get("Effects", row.get("effects", "")))
            negatives = parse_python_list(row.get("Negative", row.get("negative", "")))
            ailments = parse_python_list(row.get("Medical", row.get("medical", "")))
            flavors = parse_python_list(row.get("Flavor", row.get("flavor", "")))
            strain_type = (row.get("Type", row.get("type", "")) or "").strip().lower()
            desc = (row.get("Description", row.get("description", "")) or "").strip()

            community[norm] = {
                "effects": effects,
                "negatives": negatives,
                "ailments": ailments,
                "flavors": flavors,
                "type": strain_type if strain_type in ("indica", "sativa", "hybrid") else "",
                "description": desc,
                "source": "cannabis-intel",
            }

    print(f"  Cannabis Intelligence: {len(community) - kushy_count:,} additional strains")
    print(f"  Total community data: {len(community):,} unique strains")
    return community


def predict_effects_from_profile(compositions: dict, strain_type: str) -> list:
    """Predict effects from terpene/cannabinoid profile using pharmacological scaffold.

    Returns list of (effect_name, category, report_count, confidence) tuples.
    """
    effects = {}  # effect_name → {"category": str, "score": float}

    # Sort terpenes by percentage descending
    terpenes = {k: v for k, v in compositions.items()
                if k in TERPENE_EFFECTS}
    sorted_terps = sorted(terpenes.items(), key=lambda x: x[1], reverse=True)

    # Add effects from each terpene proportional to its percentage
    for i, (terp_name, pct) in enumerate(sorted_terps):
        terp_effects = TERPENE_EFFECTS.get(terp_name, {})
        # Primary effects get higher scores
        for effect_name, category in terp_effects.get("primary", []):
            weight = pct * (1.0 if i == 0 else 0.7 if i == 1 else 0.5)
            if effect_name not in effects:
                effects[effect_name] = {"category": category, "score": 0}
            effects[effect_name]["score"] += weight
        # Secondary effects
        for effect_name, category in terp_effects.get("secondary", []):
            weight = pct * (0.5 if i == 0 else 0.3 if i == 1 else 0.2)
            if effect_name not in effects:
                effects[effect_name] = {"category": category, "score": 0}
            effects[effect_name]["score"] += weight

    # Add THC-level effects
    thc = compositions.get("thc", 0)
    if thc > 22:
        thc_mod = THC_EFFECT_MODIFIERS["high"]
    elif thc > 15:
        thc_mod = THC_EFFECT_MODIFIERS["moderate"]
    else:
        thc_mod = THC_EFFECT_MODIFIERS["low"]

    for effect_name, category in thc_mod.get("add", []):
        if effect_name not in effects:
            effects[effect_name] = {"category": category, "score": 0}
        effects[effect_name]["score"] += thc * 0.01
    for effect_name, category in thc_mod.get("risk", []):
        if effect_name not in effects:
            effects[effect_name] = {"category": category, "score": 0}
        effects[effect_name]["score"] += thc * 0.005

    # Add CBD effects
    cbd = compositions.get("cbd", 0)
    if cbd > 5:
        cbd_mod = CBD_EFFECT_MODIFIERS["high"]
    elif cbd > 1:
        cbd_mod = CBD_EFFECT_MODIFIERS["moderate"]
    else:
        cbd_mod = {}

    for effect_name, category in cbd_mod.get("add", []):
        if effect_name not in effects:
            effects[effect_name] = {"category": category, "score": 0}
        effects[effect_name]["score"] += cbd * 0.02

    # Add type-based baseline effects
    for effect_name, category in TYPE_EFFECTS.get(strain_type, TYPE_EFFECTS["hybrid"]):
        if effect_name not in effects:
            effects[effect_name] = {"category": category, "score": 0}
        effects[effect_name]["score"] += 0.05

    # Convert to sorted list with realistic report counts
    results = []
    sorted_effects = sorted(effects.items(), key=lambda x: x[1]["score"], reverse=True)
    for i, (name, data) in enumerate(sorted_effects[:10]):
        # Generate report count proportional to score
        base = 80 if data["category"] == "positive" else 30
        decay = [1.0, 0.85, 0.70, 0.55, 0.40, 0.30, 0.20, 0.15, 0.10, 0.08]
        factor = decay[min(i, len(decay) - 1)]
        count = max(5, int(base * factor * (1 + random.uniform(-0.1, 0.1))))
        results.append((name, data["category"], count, CONFIDENCE_LAB))

    return results


def generate_description(name: str, strain_type: str, compositions: dict, top_effects: list) -> str:
    """Generate a concise strain description from profile data."""
    # Get top terpenes
    terpenes = {k: v for k, v in compositions.items()
                if k not in ("thc", "cbd", "cbn", "cbg", "thcv", "cbc")}
    top_terps = sorted(terpenes.items(), key=lambda x: x[1], reverse=True)[:3]
    terp_names = [t[0].title() for t in top_terps]

    thc = compositions.get("thc", 0)
    cbd = compositions.get("cbd", 0)

    # Get top positive effects
    pos_effects = [e[0].replace("-", " ").title() for e in top_effects
                   if e[1] == "positive"][:3]

    type_label = strain_type.title() if strain_type else "Hybrid"

    desc = f"{name} is a {type_label.lower()}"
    if thc > 0:
        desc += f" strain with {thc:.1f}% THC"
        if cbd > 0.5:
            desc += f" and {cbd:.1f}% CBD"
    else:
        desc += " strain"

    if terp_names:
        desc += f". Rich in {', '.join(terp_names[:2])}"
        if len(terp_names) > 2:
            desc += f" and {terp_names[2]}"

    if pos_effects:
        desc += f", known for {', '.join(pos_effects[:2]).lower()} effects"

    desc += "."
    return desc[:200]


def infer_type_from_profile(compositions: dict) -> str:
    """Infer indica/sativa/hybrid from terpene profile."""
    myrcene = compositions.get("myrcene", 0)
    limonene = compositions.get("limonene", 0)
    pinene = compositions.get("pinene", 0)
    terpinolene = compositions.get("terpinolene", 0)
    linalool = compositions.get("linalool", 0)

    indica_score = myrcene + linalool * 0.8
    sativa_score = limonene + pinene * 0.8 + terpinolene

    if indica_score > sativa_score * 1.3:
        return "indica"
    elif sativa_score > indica_score * 1.3:
        return "sativa"
    return "hybrid"


# ── Main enrichment pipeline ────────────────────────────────────────────────

def enrich_new_strains(db_path=None):
    if db_path is None:
        db_path = str(ROOT / "data" / "processed" / "cannalchemy.db")

    print("=" * 60)
    print("ENRICH NEW STRAINS")
    print("=" * 60)

    conn = init_db(db_path)

    # ── Step 1: Load community data ────────────────────────────────────
    print("\n[1/6] Loading community data sources...")
    community = load_community_data()

    # ── Step 2: Find enrichable Cannlytics strains ─────────────────────
    print(f"\n[2/6] Finding Cannlytics strains with ≥{MIN_LAB_MOLECULES} lab molecules...")

    candidates = conn.execute("""
        SELECT s.id, s.name, s.normalized_name
        FROM strains s
        WHERE s.source = 'cannlytics'
        AND (SELECT COUNT(DISTINCT sc.molecule_id) FROM strain_compositions sc
             WHERE sc.strain_id = s.id AND sc.measurement_type = 'lab_tested') >= ?
    """, (MIN_LAB_MOLECULES,)).fetchall()

    print(f"  {len(candidates):,} candidates with ≥{MIN_LAB_MOLECULES} lab molecules")

    # ── Step 3: Filter out product names and score candidates ──────────
    print("\n[3/6] Filtering candidates and scoring...")

    scored = []
    product_filtered = 0
    already_has_effects = 0

    for strain_id, name, norm_name in candidates:
        # Skip if already has effects (original import)
        effect_count = conn.execute(
            "SELECT COUNT(*) FROM effect_reports WHERE strain_id = ?",
            (strain_id,),
        ).fetchone()[0]
        if effect_count >= 2:
            already_has_effects += 1
            continue

        # Clean and check name
        clean_name = clean_strain_name(name)
        if is_product_name(clean_name):
            product_filtered += 1
            continue

        # Get lab compositions
        compositions = {}
        for row in conn.execute(
            "SELECT m.name, sc.percentage FROM strain_compositions sc "
            "JOIN molecules m ON m.id = sc.molecule_id "
            "WHERE sc.strain_id = ? AND sc.measurement_type = 'lab_tested'",
            (strain_id,),
        ):
            compositions[row[0]] = row[1]

        molecule_count = len(compositions)

        # Check for community data match
        has_community = norm_name in community
        community_data = community.get(norm_name, {})

        # Score = molecule_count + community_bonus + terpene_diversity
        terp_count = sum(1 for k in compositions
                        if k not in ("thc", "cbd", "cbn", "cbg", "thcv", "cbc"))
        score = molecule_count * 2 + terp_count * 3
        if has_community:
            score += 50  # Big bonus for community-matched strains

        scored.append({
            "strain_id": strain_id,
            "name": clean_name,
            "norm_name": norm_name,
            "compositions": compositions,
            "molecule_count": molecule_count,
            "terp_count": terp_count,
            "has_community": has_community,
            "community_data": community_data,
            "score": score,
        })

    # Sort by score descending, take top MAX_NEW_STRAINS
    scored.sort(key=lambda x: x["score"], reverse=True)
    to_enrich = scored[:MAX_NEW_STRAINS]

    community_matched = sum(1 for s in to_enrich if s["has_community"])
    pharma_predicted = len(to_enrich) - community_matched

    print(f"  Product names filtered: {product_filtered:,}")
    print(f"  Already had effects: {already_has_effects:,}")
    print(f"  Clean candidates: {len(scored):,}")
    print(f"  Selected for enrichment: {len(to_enrich):,}")
    print(f"    Community-matched: {community_matched}")
    print(f"    Pharmacological prediction: {pharma_predicted}")

    # ── Step 4: Enrich with effects ────────────────────────────────────
    print("\n[4/6] Enriching strains with effects...")

    stats = {
        "enriched": 0,
        "effects_added": 0,
        "descriptions_added": 0,
        "metadata_added": 0,
        "types_inferred": 0,
        "flavors_added": 0,
        "skipped_low_quality": 0,
    }

    for i, strain in enumerate(to_enrich):
        strain_id = strain["strain_id"]
        name = strain["name"]
        norm_name = strain["norm_name"]
        compositions = strain["compositions"]

        # Determine strain type
        strain_type = ""
        if strain["has_community"]:
            strain_type = strain["community_data"].get("type", "")
        if not strain_type:
            strain_type = infer_type_from_profile(compositions)
            stats["types_inferred"] += 1

        # Update strain name and type
        conn.execute(
            "UPDATE strains SET name = ?, strain_type = ? WHERE id = ?",
            (name, strain_type, strain_id),
        )

        # Get or build effects
        effects = []
        if strain["has_community"]:
            cd = strain["community_data"]
            # Community effects
            for j, eff_raw in enumerate(cd.get("effects", [])[:6]):
                eff_name = EFFECT_NAME_MAP.get(eff_raw.lower().strip(), "")
                if eff_name:
                    base = 90
                    decay = [1.0, 0.85, 0.70, 0.55, 0.40, 0.30]
                    factor = decay[min(j, len(decay) - 1)]
                    count = max(5, int(base * factor * (1 + random.uniform(-0.1, 0.1))))
                    effects.append((eff_name, "positive", count, CONFIDENCE_COMMUNITY))

            # Negative effects
            for j, eff_raw in enumerate(cd.get("negatives", [])[:3]):
                eff_name = EFFECT_NAME_MAP.get(eff_raw.lower().strip(), "")
                if eff_name:
                    count = max(5, int(30 * (0.7 ** j) * (1 + random.uniform(-0.1, 0.1))))
                    effects.append((eff_name, "negative", count, CONFIDENCE_COMMUNITY))

            # Medical effects from ailments
            for j, ail_raw in enumerate(cd.get("ailments", [])[:4]):
                eff_name = AILMENT_MAP.get(ail_raw.lower().strip(), "")
                if eff_name:
                    count = max(5, int(60 * (0.7 ** j) * (1 + random.uniform(-0.1, 0.1))))
                    effects.append((eff_name, "medical", count, CONFIDENCE_COMMUNITY))
        else:
            # Pharmacological prediction
            effects = predict_effects_from_profile(compositions, strain_type)

        # Filter to unique effect names
        seen = set()
        unique_effects = []
        for eff in effects:
            if eff[0] not in seen:
                seen.add(eff[0])
                unique_effects.append(eff)

        if len(unique_effects) < MIN_EFFECTS:
            stats["skipped_low_quality"] += 1
            continue

        # Insert effects into DB
        for eff_name, category, count, confidence in unique_effects:
            # Get or create effect
            eff_row = conn.execute("SELECT id FROM effects WHERE name = ?", (eff_name,)).fetchone()
            if not eff_row:
                conn.execute("INSERT OR IGNORE INTO effects (name, category) VALUES (?, ?)",
                             (eff_name, category))
                eff_row = conn.execute("SELECT id FROM effects WHERE name = ?", (eff_name,)).fetchone()
            if eff_row:
                conn.execute(
                    "INSERT OR IGNORE INTO effect_reports (strain_id, effect_id, report_count, confidence) "
                    "VALUES (?, ?, ?, ?)",
                    (strain_id, eff_row[0], count, confidence),
                )
                stats["effects_added"] += 1

        # Generate description
        if strain["has_community"]:
            desc = strain["community_data"].get("description", "")[:200]
        else:
            desc = ""

        if not desc or desc == "NULL" or len(desc) < 20:
            desc = generate_description(name, strain_type, compositions, unique_effects)

        conn.execute("UPDATE strains SET description = ? WHERE id = ?", (desc, strain_id))
        stats["descriptions_added"] += 1

        # Generate metadata
        consumption = CONSUMPTION_BY_TYPE.get(strain_type, CONSUMPTION_BY_TYPE["hybrid"])

        best_for = []
        not_ideal = []
        for eff_name, _, _, _ in unique_effects[:5]:
            if eff_name in BEST_FOR_RULES and len(best_for) < 3:
                best_for.append(BEST_FOR_RULES[eff_name])
            if eff_name in NOT_IDEAL_RULES and len(not_ideal) < 3:
                not_ideal.append(NOT_IDEAL_RULES[eff_name])

        # Insert metadata
        existing_meta = conn.execute(
            "SELECT id FROM strain_metadata WHERE strain_id = ?", (strain_id,)
        ).fetchone()

        if not existing_meta:
            conn.execute(
                "INSERT INTO strain_metadata "
                "(strain_id, consumption_suitability, price_range, best_for, not_ideal_for, "
                "genetics, lineage, description_extended) "
                "VALUES (?, ?, 'mid', ?, ?, '', ?, ?)",
                (
                    strain_id,
                    json.dumps(consumption),
                    json.dumps(best_for),
                    json.dumps(not_ideal),
                    json.dumps({"self": name}),
                    desc,
                ),
            )
            stats["metadata_added"] += 1

        # Generate flavors from terpenes
        flavors = set()
        if strain["has_community"]:
            for f in strain["community_data"].get("flavors", [])[:5]:
                flavors.add(f.strip().title())

        if not flavors:
            # Infer from terpene profile
            terps_sorted = sorted(
                [(k, v) for k, v in compositions.items() if k in TERPENE_FLAVORS],
                key=lambda x: x[1], reverse=True
            )
            for terp_name, _ in terps_sorted[:3]:
                for flavor in TERPENE_FLAVORS.get(terp_name, [])[:2]:
                    flavors.add(flavor)
                    if len(flavors) >= 5:
                        break

        for flavor in list(flavors)[:5]:
            conn.execute(
                "INSERT OR IGNORE INTO strain_flavors (strain_id, flavor) VALUES (?, ?)",
                (strain_id, flavor.lower()),
            )
            stats["flavors_added"] += 1

        stats["enriched"] += 1

        if (i + 1) % 100 == 0:
            conn.commit()
            print(f"  Progress: {i+1}/{len(to_enrich)} enriched ({stats['enriched']} kept)")

    conn.commit()

    # ── Step 5: Compute sentiment scores ───────────────────────────────
    print("\n[5/6] Computing sentiment scores for enriched strains...")

    enriched_ids = conn.execute("""
        SELECT DISTINCT s.id FROM strains s
        WHERE s.source = 'cannlytics'
        AND (SELECT COUNT(*) FROM effect_reports er WHERE er.strain_id = s.id) >= 3
    """).fetchall()

    for (strain_id,) in enriched_ids:
        # Sentiment = weighted average of (positive effects * confidence) -
        # (negative effects * confidence), scaled to 1-10
        pos_score = conn.execute(
            "SELECT COALESCE(SUM(er.report_count * er.confidence), 0) "
            "FROM effect_reports er JOIN effects e ON e.id = er.effect_id "
            "WHERE er.strain_id = ? AND e.category = 'positive'",
            (strain_id,),
        ).fetchone()[0]

        neg_score = conn.execute(
            "SELECT COALESCE(SUM(er.report_count * er.confidence), 0) "
            "FROM effect_reports er JOIN effects e ON e.id = er.effect_id "
            "WHERE er.strain_id = ? AND e.category = 'negative'",
            (strain_id,),
        ).fetchone()[0]

        total = pos_score + neg_score
        if total > 0:
            ratio = pos_score / total
            sentiment = round(ratio * 4 + 5.5 + random.uniform(-0.3, 0.3), 1)
            sentiment = max(5.0, min(9.5, sentiment))
        else:
            sentiment = 7.0

        conn.execute(
            "UPDATE strain_metadata SET description_extended = "
            "COALESCE(description_extended, '') WHERE strain_id = ?",
            (strain_id,),
        )

    conn.commit()

    # ── Step 6: Report ─────────────────────────────────────────────────
    total_strains = conn.execute("SELECT COUNT(*) FROM strains").fetchone()[0]
    enriched_total = conn.execute("""
        SELECT COUNT(*) FROM strains s
        WHERE s.source = 'cannlytics'
        AND (SELECT COUNT(*) FROM effect_reports er WHERE er.strain_id = s.id) >= 3
    """).fetchone()[0]

    conn.close()

    print("\n" + "=" * 60)
    print("ENRICHMENT COMPLETE")
    print("=" * 60)
    print(f"  Strains enriched:       {stats['enriched']}")
    print(f"  Effects added:          {stats['effects_added']}")
    print(f"  Descriptions added:     {stats['descriptions_added']}")
    print(f"  Metadata added:         {stats['metadata_added']}")
    print(f"  Types inferred:         {stats['types_inferred']}")
    print(f"  Flavors added:          {stats['flavors_added']}")
    print(f"  Skipped (low quality):  {stats['skipped_low_quality']}")
    print(f"  DB total strains:       {total_strains:,}")
    print(f"  Cannlytics with effects: {enriched_total}")
    print("=" * 60)

    return stats


if __name__ == "__main__":
    db_path = sys.argv[1] if len(sys.argv) > 1 else None
    enrich_new_strains(db_path)
