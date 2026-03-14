"""Fix and normalize strain flavor tags across the database.

Generates clean flavor tags for all strains using a dual-source approach:
1. TERPENE SCIENCE — each terpene maps to specific flavor categories
2. COMMUNITY DATA — existing user-reported flavors from the current JSON export

Flavor categories match the quiz options:
  citrus, pine, earthy, berry, diesel, sweet, spicy, skunky, floral

Usage:
    python3 scripts/fix_strain_flavors.py
"""
import json
import sqlite3
import re
from pathlib import Path
from collections import Counter

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "data" / "processed" / "cannalchemy.db"
JSON_PATH = ROOT / "frontend" / "src" / "data" / "strains.json"

# ── Quiz flavor categories (must match frontend/src/data/flavors.js) ──
QUIZ_FLAVORS = ['citrus', 'pine', 'earthy', 'berry', 'diesel', 'sweet', 'spicy', 'skunky', 'floral']

# ── Terpene → flavor category mappings (science-based) ──
# Primary flavors weighted higher, secondary lower
TERPENE_FLAVOR_MAP = {
    'myrcene':      {'earthy': 0.8, 'spicy': 0.3},
    'limonene':     {'citrus': 1.0, 'sweet': 0.2},
    'caryophyllene':{'spicy': 0.9, 'earthy': 0.2},
    'linalool':     {'floral': 1.0, 'sweet': 0.3},
    'pinene':       {'pine': 1.0},
    'terpinolene':  {'sweet': 0.5, 'floral': 0.4, 'berry': 0.3},
    'humulene':     {'earthy': 0.6, 'spicy': 0.3},
    'ocimene':      {'sweet': 0.6, 'floral': 0.3, 'berry': 0.2},
    'bisabolol':    {'floral': 0.7, 'sweet': 0.2},
    'valencene':    {'citrus': 0.9},
    'camphene':     {'pine': 0.6, 'earthy': 0.3},
    'geraniol':     {'floral': 0.8, 'sweet': 0.3, 'citrus': 0.2},
    'nerolidol':    {'floral': 0.5, 'earthy': 0.4},
    'borneol':      {'spicy': 0.4, 'pine': 0.4},
    'fenchol':      {'pine': 0.3, 'earthy': 0.3},
    'farnesene':    {'sweet': 0.7, 'berry': 0.5},
    'terpineol':    {'floral': 0.4, 'pine': 0.4},
    'guaiol':       {'pine': 0.5, 'earthy': 0.4},
}

# ── Raw flavor text → quiz category normalization ──
RAW_FLAVOR_MAP = {
    # Citrus
    'citrus': 'citrus', 'lemon': 'citrus', 'lime': 'citrus', 'orange': 'citrus',
    'grapefruit': 'citrus', 'tangerine': 'citrus', 'tangy': 'citrus',
    # Pine
    'pine': 'pine', 'piney': 'pine', 'woody': 'pine', 'cedar': 'pine', 'wood': 'pine',
    # Earthy
    'earthy': 'earthy', 'earth': 'earthy', 'pungent': 'earthy', 'nutty': 'earthy',
    'coffee': 'earthy', 'tobacco': 'earthy', 'mushroom': 'earthy', 'tea': 'earthy',
    'chocolate': 'earthy', 'hash': 'earthy',
    # Berry/Fruity
    'berry': 'berry', 'fruity': 'berry', 'blueberry': 'berry', 'grape': 'berry',
    'strawberry': 'berry', 'tropical': 'berry', 'mango': 'berry', 'pineapple': 'berry',
    'banana': 'berry', 'apple': 'berry', 'peach': 'berry', 'cherry': 'berry',
    'plum': 'berry', 'watermelon': 'berry', 'melon': 'berry',
    # Diesel/Fuel
    'diesel': 'diesel', 'chemical': 'diesel', 'ammonia': 'diesel', 'tar': 'diesel',
    'gas': 'diesel', 'fuel': 'diesel', 'gasoline': 'diesel',
    # Sweet/Dessert
    'sweet': 'sweet', 'candy': 'sweet', 'vanilla': 'sweet', 'butter': 'sweet',
    'caramel': 'sweet', 'cream': 'sweet', 'honey': 'sweet', 'cake': 'sweet',
    'cookie': 'sweet', 'sugary': 'sweet', 'syrup': 'sweet',
    # Spicy/Herbal
    'spicy': 'spicy', 'herbal': 'spicy', 'peppery': 'spicy', 'pepper': 'spicy',
    'sage': 'spicy', 'mint': 'spicy', 'minty': 'spicy', 'basil': 'spicy',
    'clove': 'spicy', 'cinnamon': 'spicy',
    # Skunky
    'skunky': 'skunky', 'skunk': 'skunky', 'dank': 'skunky', 'musky': 'skunky',
    'cheese': 'skunky', 'cheesy': 'skunky', 'funky': 'skunky',
    # Floral
    'floral': 'floral', 'flowery': 'floral', 'lavender': 'floral', 'rose': 'floral',
    'jasmine': 'floral', 'violet': 'floral',
}

# ── Strain name hints — some strain names strongly imply flavors ──
NAME_FLAVOR_HINTS = [
    (r'lemon|citrus|tangie|clementine|mandarin|orange', 'citrus'),
    (r'pine|kush|og\b', 'pine'),
    (r'berry|blueberry|strawberry|grape|fruit|cherry|punch|zkittl', 'berry'),
    (r'diesel|sour|chem|fuel|gas', 'diesel'),
    (r'cake|cookie|gelato|sherb|ice\s*cream|candy|runtz|sweet|vanilla', 'sweet'),
    (r'skunk|cheese|funk', 'skunky'),
    (r'lavender|rose|floral', 'floral'),
    (r'haze|sage|herb', 'spicy'),
]


def clean_raw_flavor(raw):
    """Clean a messy raw flavor string and normalize to quiz category."""
    cleaned = re.sub(r"[\[\]'\"]", "", raw).strip().lower()
    if not cleaned or cleaned in ('null', 'none', ''):
        return None
    return RAW_FLAVOR_MAP.get(cleaned, None)


def compute_terpene_flavors(terpenes):
    """Compute flavor scores from a strain's terpene profile.

    terpenes: list of (terpene_name, percentage)
    Returns: Counter of {flavor_category: score}
    """
    scores = Counter()
    for i, (terp_name, pct) in enumerate(terpenes):
        terp_lower = terp_name.lower()
        if terp_lower not in TERPENE_FLAVOR_MAP:
            continue
        # Position weight: top terpene = 1.0x, each subsequent decreases
        position_weight = max(0.2, 1.0 - (i * 0.15))
        for flavor_cat, base_score in TERPENE_FLAVOR_MAP[terp_lower].items():
            scores[flavor_cat] += base_score * position_weight
    return scores


def get_name_hints(name):
    """Get flavor hints from the strain name."""
    scores = Counter()
    lower = name.lower()
    for pattern, flavor in NAME_FLAVOR_HINTS:
        if re.search(pattern, lower):
            scores[flavor] += 0.5  # Moderate boost
    return scores


def fix_flavors():
    conn = sqlite3.connect(str(DB_PATH))

    # Load existing community flavor data from JSON export
    community_flavors = {}
    try:
        with open(JSON_PATH) as f:
            json_data = json.load(f)
        for s in json_data:
            name = s.get('name', '')
            raw_flavors = s.get('flavors', [])
            if raw_flavors:
                cleaned = []
                for rf in raw_flavors:
                    cat = clean_raw_flavor(rf)
                    if cat:
                        cleaned.append(cat)
                if cleaned:
                    community_flavors[name] = cleaned
    except Exception as e:
        print(f"Warning: Could not load community flavors from JSON: {e}")

    print(f"Loaded community flavor data for {len(community_flavors)} strains")

    # Clear existing flavor data to rebuild
    conn.execute("DELETE FROM strain_flavors")

    # Get all strains
    strains = conn.execute("""
        SELECT s.id, s.name, s.strain_type FROM strains s ORDER BY s.id
    """).fetchall()

    total = len(strains)
    updated = 0
    no_flavors = 0
    stats = Counter()

    for strain_id, name, strain_type in strains:
        flavor_scores = Counter()

        # Source 1: Terpene profile (science) — 1.5x weight
        terpenes = conn.execute("""
            SELECT m.name, sc.percentage
            FROM strain_compositions sc
            JOIN molecules m ON m.id = sc.molecule_id
            WHERE sc.strain_id = ? AND m.molecule_type = 'terpene'
            ORDER BY sc.percentage DESC
        """, (strain_id,)).fetchall()

        terp_flavors = compute_terpene_flavors(terpenes)
        for cat, score in terp_flavors.items():
            flavor_scores[cat] += score * 1.5

        # Source 2: Community-reported flavors — 2x weight (real user data)
        comm = community_flavors.get(name, [])
        for cat in comm:
            flavor_scores[cat] += 2.0
            stats['community_used'] += 1

        # Source 3: Name-based hints — 0.5x weight (gentle nudge)
        name_hints = get_name_hints(name)
        for cat, score in name_hints.items():
            flavor_scores[cat] += score

        if not flavor_scores:
            no_flavors += 1
            continue

        # Select top flavors with minimum threshold
        sorted_flavors = [
            (cat, score) for cat, score in flavor_scores.most_common(5)
            if score >= 0.5
        ]

        if not sorted_flavors:
            no_flavors += 1
            continue

        # Cap at 4 flavors
        final_flavors = [cat for cat, score in sorted_flavors[:4]]

        for flavor in final_flavors:
            conn.execute(
                "INSERT OR IGNORE INTO strain_flavors (strain_id, flavor) VALUES (?, ?)",
                (strain_id, flavor)
            )
            stats[flavor] = stats.get(flavor, 0) + 1

        updated += 1
        if updated <= 20:
            sources = []
            if terpenes:
                sources.append(f"terps:{[t[0] for t in terpenes[:3]]}")
            if comm:
                sources.append(f"comm:{comm}")
            print(f"  {name}: {final_flavors}  ({', '.join(sources)})")

    if updated > 20:
        print(f"  ... and {updated - 20} more\n")

    conn.commit()
    conn.close()

    print(f"\nSummary:")
    print(f"  Updated: {updated} strains with flavor tags")
    print(f"  No data: {no_flavors} strains")
    print(f"  Total:   {total} strains")
    print(f"\nFlavor distribution:")
    for cat in QUIZ_FLAVORS:
        print(f"  {cat}: {stats.get(cat, 0)}")
    print(f"\n  Community flavors applied: {stats.get('community_used', 0)}")


if __name__ == "__main__":
    fix_flavors()
