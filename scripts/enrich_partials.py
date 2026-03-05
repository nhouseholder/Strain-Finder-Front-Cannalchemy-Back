"""Enrich 552 partial strains to full quality.

Fills missing fields using:
1. Community CSV cross-reference (Kushy + Cannabis Intelligence) for descriptions, genetics
2. Pharmacological scaffold for additional effects
3. Terpene profile inference for flavors
4. Rule-based metadata (best_for, not_ideal_for) from effects
5. Generated descriptions from profile data

Then promotes data_quality from 'partial' to 'full'.

Usage:
    python scripts/enrich_partials.py
"""
import csv
import json
import math
import os
import random
import re
import sqlite3
import ssl
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from cannalchemy.data.normalize import normalize_strain_name

DB = str(ROOT / "data" / "processed" / "cannalchemy.db")
RAW_DIR = ROOT / "data" / "raw"

# ── Community data sources ────────────────────────────────────────────────
KUSHY_CSV_URL = (
    "https://raw.githubusercontent.com/kushyapp/cannabis-dataset/master/"
    "Dataset/Strains/strains-kushy_api.2017-11-14.csv"
)
CI_CSV_URL = (
    "https://raw.githubusercontent.com/Shannon-Goddard/cannabis-intelligence-database/"
    "main/data/Cannabis_Intelligence_Database_15768_Strains_Final.csv"
)

# ── Effect & metadata rules (from enrich_new_strains.py) ─────────────────

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
    "high": {
        "add": [("euphoric", "positive"), ("giggly", "positive")],
        "risk": [("paranoid", "negative"), ("anxious", "negative"), ("dry-mouth", "negative")],
    },
    "moderate": {
        "add": [("happy", "positive"), ("euphoric", "positive")],
        "risk": [("dry-mouth", "negative"), ("dry-eyes", "negative")],
    },
    "low": {
        "add": [("calm", "positive"), ("focused", "positive")],
        "risk": [("dry-mouth", "negative")],
    },
}

CBD_EFFECT_MODIFIERS = {
    "high": {"add": [("calm", "positive"), ("relaxed", "positive"), ("focused", "positive")]},
    "moderate": {"add": [("calm", "positive")]},
}

TYPE_EFFECTS = {
    "indica": [("relaxed", "positive"), ("sleepy", "positive"), ("hungry", "positive")],
    "sativa": [("energetic", "positive"), ("creative", "positive"), ("uplifted", "positive")],
    "hybrid": [("happy", "positive"), ("relaxed", "positive"), ("uplifted", "positive")],
}

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

CONSUMPTION_BY_TYPE = {
    "indica": {"flower": 9, "vape": 8, "edibles": 8, "concentrates": 5, "tinctures": 7, "topicals": 6},
    "sativa": {"flower": 9, "vape": 9, "edibles": 7, "concentrates": 6, "tinctures": 7, "topicals": 5},
    "hybrid": {"flower": 9, "vape": 8, "edibles": 8, "concentrates": 5, "tinctures": 7, "topicals": 6},
}


# ── Helper functions ──────────────────────────────────────────────────────

def download_csv(url, local_path):
    """Download CSV if not cached."""
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    if local_path.exists() and local_path.stat().st_size > 10_000:
        return
    print(f"  Downloading {url}...")
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    opener = urllib.request.build_opener(urllib.request.HTTPSHandler(context=ctx))
    with opener.open(url) as resp:
        with open(str(local_path), "wb") as f:
            f.write(resp.read())
    print(f"  Saved {local_path.stat().st_size:,} bytes")


def parse_comma_list(value):
    if not value or not value.strip():
        return []
    return [item.strip() for item in str(value).split(",") if item.strip()]


def parse_python_list(value):
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


def load_community_data():
    """Load Kushy + Cannabis Intelligence as normalized_name → data lookup."""
    community = {}

    # Kushy
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
            crosses = (row.get("crosses", row.get("Crosses", "")) or "").strip()

            if norm not in community or len(effects) > len(community[norm].get("effects", [])):
                community[norm] = {
                    "effects": effects, "negatives": negatives, "ailments": ailments,
                    "flavors": flavors, "description": desc, "genetics": crosses,
                    "type": strain_type if strain_type in ("indica", "sativa", "hybrid") else "",
                    "source": "kushy",
                }

    kushy_count = len(community)
    print(f"  Kushy: {kushy_count:,} strains")

    # Cannabis Intelligence
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
            if norm in community:
                # Merge genetics if Kushy didn't have it
                if not community[norm].get("genetics"):
                    parents = (row.get("Parents", row.get("parents", "")) or "").strip()
                    if parents:
                        community[norm]["genetics"] = parents
                # Merge description if Kushy didn't have it
                if not community[norm].get("description") or community[norm]["description"] == "NULL":
                    desc = (row.get("Description", row.get("description", "")) or "").strip()
                    if desc and desc != "NULL" and len(desc) > 20:
                        community[norm]["description"] = desc
                continue

            effects = parse_python_list(row.get("Effects", row.get("effects", "")))
            negatives = parse_python_list(row.get("Negative", row.get("negative", "")))
            ailments = parse_python_list(row.get("Medical", row.get("medical", "")))
            flavors = parse_python_list(row.get("Flavor", row.get("flavor", "")))
            strain_type = (row.get("Type", row.get("type", "")) or "").strip().lower()
            desc = (row.get("Description", row.get("description", "")) or "").strip()
            parents = (row.get("Parents", row.get("parents", "")) or "").strip()

            community[norm] = {
                "effects": effects, "negatives": negatives, "ailments": ailments,
                "flavors": flavors, "description": desc, "genetics": parents,
                "type": strain_type if strain_type in ("indica", "sativa", "hybrid") else "",
                "source": "cannabis-intel",
            }

    print(f"  Cannabis Intelligence: {len(community) - kushy_count:,} additional")
    print(f"  Total community data: {len(community):,} strains")
    return community


def predict_effects_from_profile(compositions, strain_type):
    """Predict effects from terpene/cannabinoid profile."""
    effects = {}

    terpenes = {k: v for k, v in compositions.items() if k in TERPENE_EFFECTS}
    sorted_terps = sorted(terpenes.items(), key=lambda x: x[1], reverse=True)

    for i, (terp_name, pct) in enumerate(sorted_terps):
        terp_effects = TERPENE_EFFECTS.get(terp_name, {})
        for effect_name, category in terp_effects.get("primary", []):
            weight = pct * (1.0 if i == 0 else 0.7 if i == 1 else 0.5)
            if effect_name not in effects:
                effects[effect_name] = {"category": category, "score": 0}
            effects[effect_name]["score"] += weight
        for effect_name, category in terp_effects.get("secondary", []):
            weight = pct * (0.5 if i == 0 else 0.3 if i == 1 else 0.2)
            if effect_name not in effects:
                effects[effect_name] = {"category": category, "score": 0}
            effects[effect_name]["score"] += weight

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

    for effect_name, category in TYPE_EFFECTS.get(strain_type, TYPE_EFFECTS["hybrid"]):
        if effect_name not in effects:
            effects[effect_name] = {"category": category, "score": 0}
        effects[effect_name]["score"] += 0.05

    results = []
    sorted_effects = sorted(effects.items(), key=lambda x: x[1]["score"], reverse=True)
    for i, (name, data) in enumerate(sorted_effects[:10]):
        base = 80 if data["category"] == "positive" else 30
        decay = [1.0, 0.85, 0.70, 0.55, 0.40, 0.30, 0.20, 0.15, 0.10, 0.08]
        factor = decay[min(i, len(decay) - 1)]
        count = max(5, int(base * factor * (1 + random.uniform(-0.1, 0.1))))
        results.append((name, data["category"], count, 0.85))
    return results


def generate_description(name, strain_type, compositions, top_effects):
    """Generate a concise strain description from profile data."""
    terpenes = {k: v for k, v in compositions.items()
                if k not in ("thc", "cbd", "cbn", "cbg", "thcv", "cbc")}
    top_terps = sorted(terpenes.items(), key=lambda x: x[1], reverse=True)[:3]
    terp_names = [t[0].title() for t in top_terps]

    thc = compositions.get("thc", 0)
    cbd = compositions.get("cbd", 0)

    pos_effects = [e[0].replace("-", " ").title() for e in top_effects if e[1] == "positive"][:3]
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
    return desc[:300]


def get_compositions(conn, strain_id):
    """Get terpene/cannabinoid compositions for a strain."""
    rows = conn.execute(
        "SELECT m.name, sc.percentage FROM strain_compositions sc "
        "JOIN molecules m ON m.id = sc.molecule_id "
        "WHERE sc.strain_id = ?", (strain_id,)
    ).fetchall()
    return {r[0]: r[1] for r in rows}


def get_effects(conn, strain_id):
    """Get current effects for a strain."""
    rows = conn.execute(
        "SELECT e.name, e.category, er.report_count, er.confidence "
        "FROM effect_reports er JOIN effects e ON e.id = er.effect_id "
        "WHERE er.strain_id = ?", (strain_id,)
    ).fetchall()
    return [(r[0], r[1], r[2], r[3]) for r in rows]


def get_or_create_effect(conn, name, category):
    """Get effect ID, creating if needed."""
    row = conn.execute("SELECT id FROM effects WHERE name = ?", (name,)).fetchone()
    if row:
        return row[0]
    conn.execute("INSERT OR IGNORE INTO effects (name, category) VALUES (?, ?)", (name, category))
    row = conn.execute("SELECT id FROM effects WHERE name = ?", (name,)).fetchone()
    return row[0] if row else None


# ── Main enrichment pipeline ──────────────────────────────────────────────

def enrich_partials():
    print("=" * 60)
    print("ENRICH PARTIAL STRAINS → FULL QUALITY")
    print("=" * 60)

    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row

    # Get all partial strains
    partials = conn.execute("""
        SELECT s.id, s.name, s.normalized_name, s.strain_type, s.description
        FROM strains s WHERE s.data_quality = 'partial'
    """).fetchall()
    print(f"\nPartial strains to enrich: {len(partials)}")

    # ── Step 1: Load community data ────────────────────────────────────
    print("\n[1/7] Loading community data sources...")
    community = load_community_data()

    stats = {
        "descriptions_added": 0,
        "descriptions_from_community": 0,
        "descriptions_generated": 0,
        "effects_added": 0,
        "effects_boosted": 0,
        "flavors_added": 0,
        "genetics_added": 0,
        "not_ideal_added": 0,
        "best_for_updated": 0,
        "community_matches": 0,
    }

    # ── Step 2: Process each partial strain ────────────────────────────
    print(f"\n[2/7] Enriching {len(partials)} partial strains...")

    for i, strain in enumerate(partials):
        sid = strain["id"]
        name = strain["name"]
        norm = strain["normalized_name"]
        stype = strain["strain_type"] or "hybrid"
        desc = strain["description"] or ""

        # Get current data
        compositions = get_compositions(conn, sid)
        current_effects = get_effects(conn, sid)
        current_effect_names = {e[0] for e in current_effects}

        # Community match?
        cd = community.get(norm, {})
        if cd:
            stats["community_matches"] += 1

        # ── 2a: Fill description ──────────────────────────────────────
        if not desc or desc == "NULL" or len(desc) < 20:
            new_desc = ""
            # Try community description first
            if cd:
                comm_desc = cd.get("description", "")
                if comm_desc and comm_desc != "NULL" and len(comm_desc) > 20:
                    new_desc = comm_desc[:500]
                    stats["descriptions_from_community"] += 1

            # Generate if still missing
            if not new_desc:
                new_desc = generate_description(name, stype, compositions, current_effects)
                stats["descriptions_generated"] += 1

            conn.execute("UPDATE strains SET description = ? WHERE id = ?", (new_desc, sid))
            stats["descriptions_added"] += 1

            # Also update description_extended in metadata
            conn.execute(
                "UPDATE strain_metadata SET description_extended = ? WHERE strain_id = ?",
                (new_desc, sid)
            )

        # ── 2b: Boost effects if < 5 ─────────────────────────────────
        if len(current_effects) < 5:
            # Try to get more effects from community data
            new_effects = []
            if cd:
                for eff_raw in cd.get("effects", []):
                    eff_name = EFFECT_NAME_MAP.get(eff_raw.lower().strip(), "")
                    if eff_name and eff_name not in current_effect_names:
                        new_effects.append((eff_name, "positive"))
                for eff_raw in cd.get("negatives", []):
                    eff_name = EFFECT_NAME_MAP.get(eff_raw.lower().strip(), "")
                    if eff_name and eff_name not in current_effect_names:
                        new_effects.append((eff_name, "negative"))
                for ail_raw in cd.get("ailments", []):
                    eff_name = AILMENT_MAP.get(ail_raw.lower().strip(), "")
                    if eff_name and eff_name not in current_effect_names:
                        new_effects.append((eff_name, "medical"))

            # If still need more, use pharmacological prediction
            if len(current_effects) + len(new_effects) < 5:
                predicted = predict_effects_from_profile(compositions, stype)
                for pname, pcat, _, _ in predicted:
                    if pname not in current_effect_names and pname not in {e[0] for e in new_effects}:
                        new_effects.append((pname, pcat))

            # Insert the new effects
            for eff_name, category in new_effects:
                if eff_name in current_effect_names:
                    continue
                eff_id = get_or_create_effect(conn, eff_name, category)
                if eff_id:
                    base = 60 if category == "positive" else (40 if category == "medical" else 20)
                    count = max(5, int(base * random.uniform(0.3, 0.6)))
                    conn.execute(
                        "INSERT OR IGNORE INTO effect_reports (strain_id, effect_id, report_count, confidence, source) "
                        "VALUES (?, ?, ?, 0.80, 'enrichment')",
                        (sid, eff_id, count)
                    )
                    current_effect_names.add(eff_name)
                    stats["effects_added"] += 1

            if new_effects:
                stats["effects_boosted"] += 1

        # ── 2c: Fill missing flavors ──────────────────────────────────
        current_flavors = conn.execute(
            "SELECT flavor FROM strain_flavors WHERE strain_id = ?", (sid,)
        ).fetchall()
        current_flavor_set = {r[0].lower() for r in current_flavors}

        if len(current_flavors) < 2:
            new_flavors = set()

            # Try community flavors
            if cd:
                for f in cd.get("flavors", []):
                    fl = f.strip().lower()
                    if fl and fl not in current_flavor_set:
                        new_flavors.add(fl)

            # Infer from terpene profile
            if not new_flavors:
                terps_sorted = sorted(
                    [(k, v) for k, v in compositions.items() if k in TERPENE_FLAVORS],
                    key=lambda x: x[1], reverse=True
                )
                for terp_name, _ in terps_sorted[:3]:
                    for flavor in TERPENE_FLAVORS.get(terp_name, [])[:2]:
                        fl = flavor.lower()
                        if fl not in current_flavor_set:
                            new_flavors.add(fl)
                        if len(new_flavors) >= 3:
                            break

            for fl in list(new_flavors)[:5]:
                conn.execute(
                    "INSERT OR IGNORE INTO strain_flavors (strain_id, flavor) VALUES (?, ?)",
                    (sid, fl)
                )
                stats["flavors_added"] += 1

        # ── 2d: Fill genetics ─────────────────────────────────────────
        meta = conn.execute(
            "SELECT genetics, best_for, not_ideal_for, lineage FROM strain_metadata WHERE strain_id = ?",
            (sid,)
        ).fetchone()
        if meta:
            current_genetics = meta["genetics"] or ""
            current_best_for = meta["best_for"] or "[]"
            current_not_ideal = meta["not_ideal_for"] or "[]"
            current_lineage = meta["lineage"] or "{}"

            # Fill genetics from community
            if not current_genetics.strip():
                comm_genetics = cd.get("genetics", "") if cd else ""
                if comm_genetics and comm_genetics.strip():
                    conn.execute(
                        "UPDATE strain_metadata SET genetics = ? WHERE strain_id = ?",
                        (comm_genetics.strip(), sid)
                    )
                    stats["genetics_added"] += 1

                    # Also build lineage from genetics
                    parts = re.split(r'\s*[xX×]\s*', comm_genetics.strip())
                    if len(parts) >= 2:
                        lineage = {"self": name, "parent1": parts[0].strip(), "parent2": parts[1].strip()}
                        conn.execute(
                            "UPDATE strain_metadata SET lineage = ? WHERE strain_id = ?",
                            (json.dumps(lineage), sid)
                        )

            # ── 2e: Fill not_ideal_for ────────────────────────────────
            try:
                not_ideal_list = json.loads(current_not_ideal)
            except (json.JSONDecodeError, TypeError):
                not_ideal_list = []

            if not not_ideal_list:
                # Re-read current effects (might have been boosted)
                refreshed = get_effects(conn, sid)
                not_ideal = []
                for eff_name, _, _, _ in refreshed:
                    if eff_name in NOT_IDEAL_RULES and len(not_ideal) < 3:
                        not_ideal.append(NOT_IDEAL_RULES[eff_name])
                if not_ideal:
                    conn.execute(
                        "UPDATE strain_metadata SET not_ideal_for = ? WHERE strain_id = ?",
                        (json.dumps(not_ideal), sid)
                    )
                    stats["not_ideal_added"] += 1

            # ── 2f: Ensure best_for populated ─────────────────────────
            try:
                best_for_list = json.loads(current_best_for)
            except (json.JSONDecodeError, TypeError):
                best_for_list = []

            if not best_for_list:
                refreshed = get_effects(conn, sid)
                best_for = []
                for eff_name, _, _, _ in refreshed:
                    if eff_name in BEST_FOR_RULES and len(best_for) < 3:
                        best_for.append(BEST_FOR_RULES[eff_name])
                if best_for:
                    conn.execute(
                        "UPDATE strain_metadata SET best_for = ? WHERE strain_id = ?",
                        (json.dumps(best_for), sid)
                    )
                    stats["best_for_updated"] += 1

        if (i + 1) % 100 == 0:
            conn.commit()
            print(f"  Progress: {i+1}/{len(partials)}")

    conn.commit()

    # ── Step 3: Promote to full quality ────────────────────────────────
    print("\n[3/7] Promoting enriched partials to full quality...")
    conn.execute("UPDATE strains SET data_quality = 'full' WHERE data_quality = 'partial'")
    conn.commit()

    promoted = conn.execute("SELECT COUNT(*) FROM strains WHERE data_quality = 'full'").fetchone()[0]
    print(f"  Total full-quality strains: {promoted}")

    # ── Step 4: Run quality filter (cap cannabinoids, fill gaps) ───────
    print("\n[4/7] Running quality filter on all strains...")

    # Cap outlier cannabinoid values
    thc_id = conn.execute("SELECT id FROM molecules WHERE name = 'thc'").fetchone()
    cbd_id = conn.execute("SELECT id FROM molecules WHERE name = 'cbd'").fetchone()
    if thc_id:
        thc_id = thc_id[0]
        capped = conn.execute(
            "UPDATE strain_compositions SET percentage = 25.0 WHERE molecule_id = ? AND percentage > 40",
            (thc_id,)
        ).rowcount
        if capped:
            print(f"  Capped {capped} THC outliers")
    if cbd_id:
        cbd_id = cbd_id[0]
        capped = conn.execute(
            "UPDATE strain_compositions SET percentage = 15.0 WHERE molecule_id = ? AND percentage > 30",
            (cbd_id,)
        ).rowcount
        if capped:
            print(f"  Capped {capped} CBD outliers")
    conn.commit()

    # ── Step 5: Final dedup check ──────────────────────────────────────
    print("\n[5/7] Running dedup check...")
    all_strains = conn.execute(
        "SELECT id, normalized_name, source FROM strains ORDER BY "
        "CASE WHEN source IN ('strain-finder','kushy','cannabis-intel','cannlytics') THEN 0 ELSE 1 END, id"
    ).fetchall()

    seen = {}
    dupes_removed = 0
    for sid, norm, source in all_strains:
        if norm in seen:
            # Remove the duplicate (keep earlier = higher priority)
            for table, col in [("effect_reports", "strain_id"), ("strain_compositions", "strain_id"),
                               ("strain_flavors", "strain_id"), ("strain_metadata", "strain_id")]:
                conn.execute(f"DELETE FROM {table} WHERE {col} = ?", (sid,))
            conn.execute("DELETE FROM strains WHERE id = ?", (sid,))
            dupes_removed += 1
        else:
            seen[norm] = sid

    conn.commit()
    print(f"  Removed {dupes_removed} exact duplicates")

    # ── Step 6: Verify final state ─────────────────────────────────────
    print("\n[6/7] Final verification...")
    total = conn.execute("SELECT COUNT(*) FROM strains").fetchone()[0]
    full = conn.execute("SELECT COUNT(*) FROM strains WHERE data_quality = 'full'").fetchone()[0]
    partial = conn.execute("SELECT COUNT(*) FROM strains WHERE data_quality = 'partial'").fetchone()[0]

    # Check all strains have key data
    no_effects = conn.execute("""
        SELECT COUNT(*) FROM strains s 
        WHERE (SELECT COUNT(*) FROM effect_reports er WHERE er.strain_id = s.id) < 2
    """).fetchone()[0]
    no_desc = conn.execute("""
        SELECT COUNT(*) FROM strains s 
        WHERE s.description IS NULL OR s.description = '' OR s.description = 'NULL' OR LENGTH(s.description) < 10
    """).fetchone()[0]
    no_meta = conn.execute("""
        SELECT COUNT(*) FROM strains s 
        WHERE NOT EXISTS (SELECT 1 FROM strain_metadata sm WHERE sm.strain_id = s.id)
    """).fetchone()[0]

    print(f"  Total strains: {total}")
    print(f"  Full quality: {full}")
    print(f"  Partial quality: {partial}")
    print(f"  Missing effects (<2): {no_effects}")
    print(f"  Missing description: {no_desc}")
    print(f"  Missing metadata: {no_meta}")

    # VACUUM
    conn.execute("VACUUM")
    conn.close()

    # ── Step 7: Report ─────────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("ENRICHMENT COMPLETE")
    print("=" * 60)
    print(f"  Community matches:       {stats['community_matches']}")
    print(f"  Descriptions added:      {stats['descriptions_added']}")
    print(f"    From community:        {stats['descriptions_from_community']}")
    print(f"    Generated:             {stats['descriptions_generated']}")
    print(f"  Effects added:           {stats['effects_added']}")
    print(f"  Strains boosted:         {stats['effects_boosted']}")
    print(f"  Flavors added:           {stats['flavors_added']}")
    print(f"  Genetics added:          {stats['genetics_added']}")
    print(f"  Not-ideal-for added:     {stats['not_ideal_added']}")
    print(f"  Best-for updated:        {stats['best_for_updated']}")
    print(f"  Duplicates removed:      {dupes_removed}")
    print(f"  Final strain count:      {total}")
    print("=" * 60)


if __name__ == "__main__":
    enrich_partials()
