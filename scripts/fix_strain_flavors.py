"""Fix and normalize strain flavor tags across the database.

Generates clean flavor tags for ALL strains using a multi-source approach:
1. TERPENE SCIENCE — each terpene maps to specific flavor categories
2. COMMUNITY DATA — existing user-reported flavors from the current JSON export
3. GENETICS INHERITANCE — parse parent strains, inherit their flavors
4. NAME ANALYSIS — expanded keyword extraction from strain names + genetics text
5. TYPE-BASED DEFAULTS — scientifically-backed fallbacks by indica/sativa/hybrid

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
    'citrus': 'citrus', 'lemon': 'citrus', 'lime': 'citrus', 'orange': 'citrus',
    'grapefruit': 'citrus', 'tangerine': 'citrus', 'tangy': 'citrus',
    'pine': 'pine', 'piney': 'pine', 'woody': 'pine', 'cedar': 'pine', 'wood': 'pine',
    'earthy': 'earthy', 'earth': 'earthy', 'pungent': 'earthy', 'nutty': 'earthy',
    'coffee': 'earthy', 'tobacco': 'earthy', 'mushroom': 'earthy', 'tea': 'earthy',
    'chocolate': 'earthy', 'hash': 'earthy',
    'berry': 'berry', 'fruity': 'berry', 'blueberry': 'berry', 'grape': 'berry',
    'strawberry': 'berry', 'tropical': 'berry', 'mango': 'berry', 'pineapple': 'berry',
    'banana': 'berry', 'apple': 'berry', 'peach': 'berry', 'cherry': 'berry',
    'plum': 'berry', 'watermelon': 'berry', 'melon': 'berry',
    'diesel': 'diesel', 'chemical': 'diesel', 'ammonia': 'diesel', 'tar': 'diesel',
    'gas': 'diesel', 'fuel': 'diesel', 'gasoline': 'diesel',
    'sweet': 'sweet', 'candy': 'sweet', 'vanilla': 'sweet', 'butter': 'sweet',
    'caramel': 'sweet', 'cream': 'sweet', 'honey': 'sweet', 'cake': 'sweet',
    'cookie': 'sweet', 'sugary': 'sweet', 'syrup': 'sweet',
    'spicy': 'spicy', 'herbal': 'spicy', 'peppery': 'spicy', 'pepper': 'spicy',
    'sage': 'spicy', 'mint': 'spicy', 'minty': 'spicy', 'basil': 'spicy',
    'clove': 'spicy', 'cinnamon': 'spicy',
    'skunky': 'skunky', 'skunk': 'skunky', 'dank': 'skunky', 'musky': 'skunky',
    'cheese': 'skunky', 'cheesy': 'skunky', 'funky': 'skunky',
    'floral': 'floral', 'flowery': 'floral', 'lavender': 'floral', 'rose': 'floral',
    'jasmine': 'floral', 'violet': 'floral',
}

# ── Extended name/genetics keyword → flavor map ──
# Applied to both strain name AND genetics text for broader matching
KEYWORD_FLAVOR_MAP = [
    # Citrus family
    (r'lemon|citrus|tangi[e]?|clementine|mandarin|orange|lime|grapefruit|mimosa|sunshine|sunrise|tang|satsuma|kumquat|zest', 'citrus'),
    # Pine/Kush/OG family
    (r'\bpine\b|kush|og\b|afghan|hindu|master\s*kush|bubba|hash\s*plant|landrace', 'pine'),
    # Berry/Fruit family
    (r'berry|blueberry|strawberry|grape|fruit|cherry|punch|zkittl|runtz|watermelon|mango|pineapple|papaya|guava|tropical|peach|apricot|plum|banana|apple|melon|acai|razz|sorbet', 'berry'),
    # Diesel/Chem family
    (r'diesel|sour|chem|fuel|gas\b|gmo|gassy|gorilla\s*glue|gg[#]?\d|stank|motor', 'diesel'),
    # Sweet/Dessert family
    (r'cake|cookie|gelato|sherb|ice\s*cream|candy|sweet|vanilla|sugar|cream|pie|biscotti|dough|frosting|glazed|honey|syrup|caramel|tiramisu|brownie|fudge|waffle|macaroon|truffle|parfait|sundae|custard|pudding|batter|frosted|zushi|mochi', 'sweet'),
    # Skunky/Cheese family
    (r'skunk|cheese|funk|garlic|stink|dank|musky|uk\s*cheese|stilton|gouda|roquefort', 'skunky'),
    # Floral family
    (r'lavender|rose|floral|flower|lilac|jasmine|violet|hibiscus|chamomile|blossom', 'floral'),
    # Spicy/Herbal family
    (r'haze|sage|herb|jack\s*herer|durban|thai|spice|mint|menthol|eucalyptus|trainwreck|amnesia|malawi|lamb', 'spicy'),
    # Earthy family
    (r'earth|mud|soil|forest|moss|mushroom|truffle|coffee|chocolate|cocoa|mocha|hash', 'earthy'),
]

# ── Well-known parent strains and their verified flavor profiles ──
# Used for genetics inheritance when a child strain has no direct data
KNOWN_PARENT_FLAVORS = {
    'og kush':          ['pine', 'earthy', 'diesel'],
    'kush':             ['pine', 'earthy'],
    'girl scout cookies': ['sweet', 'earthy', 'spicy'],
    'gsc':              ['sweet', 'earthy', 'spicy'],
    'blue dream':       ['berry', 'earthy', 'sweet'],
    'gelato':           ['sweet', 'berry', 'citrus'],
    'wedding cake':     ['sweet', 'earthy', 'spicy'],
    'sour diesel':      ['diesel', 'earthy', 'citrus'],
    'gorilla glue':     ['diesel', 'earthy', 'pine'],
    'gg4':              ['diesel', 'earthy', 'pine'],
    'northern lights':  ['earthy', 'pine', 'sweet'],
    'jack herer':       ['pine', 'spicy', 'earthy'],
    'granddaddy purple':['berry', 'earthy', 'sweet'],
    'gdp':              ['berry', 'earthy', 'sweet'],
    'purple punch':     ['berry', 'sweet', 'floral'],
    'zkittlez':         ['berry', 'sweet', 'floral'],
    'runtz':            ['sweet', 'berry', 'floral'],
    'blue cheese':      ['skunky', 'berry', 'earthy'],
    'cheese':           ['skunky', 'earthy', 'spicy'],
    'uk cheese':        ['skunky', 'earthy', 'spicy'],
    'trainwreck':       ['spicy', 'pine', 'earthy'],
    'haze':             ['spicy', 'citrus', 'earthy'],
    'super silver haze':['spicy', 'citrus', 'earthy'],
    'amnesia haze':     ['spicy', 'citrus', 'earthy'],
    'durban poison':    ['spicy', 'earthy', 'sweet'],
    'ak-47':            ['earthy', 'spicy', 'pine'],
    'ak47':             ['earthy', 'spicy', 'pine'],
    'white widow':      ['spicy', 'earthy', 'pine'],
    'skunk':            ['skunky', 'earthy', 'sweet'],
    'super skunk':      ['skunky', 'earthy', 'sweet'],
    'blueberry':        ['berry', 'sweet', 'earthy'],
    'strawberry':       ['berry', 'sweet'],
    'grape ape':        ['berry', 'earthy', 'sweet'],
    'tangie':           ['citrus', 'sweet'],
    'lemon':            ['citrus'],
    'cherry':           ['berry', 'sweet'],
    'mango':            ['berry', 'sweet'],
    'pineapple':        ['berry', 'citrus'],
    'lavender':         ['floral', 'earthy', 'spicy'],
    'afghani':          ['earthy', 'pine', 'spicy'],
    'afghan':           ['earthy', 'pine', 'spicy'],
    'hindu kush':       ['earthy', 'pine', 'sweet'],
    'bubba kush':       ['earthy', 'sweet', 'pine'],
    'chemdawg':         ['diesel', 'earthy', 'spicy'],
    'chem dawg':        ['diesel', 'earthy', 'spicy'],
    'diesel':           ['diesel', 'earthy'],
    'nyc diesel':       ['diesel', 'citrus', 'earthy'],
    'headband':         ['diesel', 'earthy', 'citrus'],
    'ice cream cake':   ['sweet', 'earthy', 'pine'],
    'mac':              ['citrus', 'diesel', 'earthy'],
    'thin mint':        ['sweet', 'spicy', 'earthy'],
    'cookies':          ['sweet', 'earthy', 'spicy'],
    'dosidos':          ['earthy', 'sweet', 'floral'],
    'do-si-dos':        ['earthy', 'sweet', 'floral'],
    'sherbert':         ['sweet', 'berry', 'citrus'],
    'sunset sherbert':  ['sweet', 'berry', 'citrus'],
    'acdc':             ['earthy', 'pine', 'spicy'],
    'cannatonic':       ['earthy', 'citrus'],
    'critical':         ['earthy', 'spicy'],
    'white rhino':      ['earthy', 'pine', 'sweet'],
    'banana':           ['berry', 'sweet'],
    'papaya':           ['berry', 'sweet'],
    'guava':            ['berry', 'citrus'],
    'mimosa':           ['citrus', 'berry', 'sweet'],
    'purple':           ['berry', 'earthy'],
    'fire og':          ['diesel', 'pine', 'earthy'],
    'sfv og':           ['pine', 'earthy', 'diesel'],
    'skywalker':        ['earthy', 'pine', 'spicy'],
    'blackberry':       ['berry', 'earthy', 'sweet'],
    'mint':             ['spicy', 'sweet'],
    'garlic':           ['skunky', 'earthy', 'diesel'],
    'gmo':              ['skunky', 'diesel', 'earthy'],
    'biscotti':         ['sweet', 'earthy'],
    'tropicana':        ['citrus', 'berry', 'sweet'],
    'animal mints':     ['spicy', 'sweet', 'earthy'],
    'london pound cake':['sweet', 'berry', 'earthy'],
    'oreoz':            ['sweet', 'earthy', 'diesel'],
    'jealousy':         ['sweet', 'earthy', 'berry'],
    'gary payton':      ['sweet', 'spicy', 'earthy'],
}

# ── Type-based flavor defaults (when all else fails) ──
# Based on the dominant terpene profiles typical of each type
TYPE_DEFAULTS = {
    'indica':  ['earthy', 'sweet', 'pine'],     # Myrcene-heavy → earthy
    'sativa':  ['citrus', 'spicy', 'earthy'],    # Limonene/terpinolene → citrus/herbal
    'hybrid':  ['earthy', 'sweet', 'spicy'],     # Balanced terpene mix
}


def clean_raw_flavor(raw):
    """Clean a messy raw flavor string and normalize to quiz category."""
    cleaned = re.sub(r"[\[\]'\"]", "", raw).strip().lower()
    if not cleaned or cleaned in ('null', 'none', ''):
        return None
    return RAW_FLAVOR_MAP.get(cleaned, None)


def compute_terpene_flavors(terpenes):
    """Compute flavor scores from a strain's terpene profile."""
    scores = Counter()
    for i, (terp_name, pct) in enumerate(terpenes):
        terp_lower = terp_name.lower()
        if terp_lower not in TERPENE_FLAVOR_MAP:
            continue
        position_weight = max(0.2, 1.0 - (i * 0.15))
        for flavor_cat, base_score in TERPENE_FLAVOR_MAP[terp_lower].items():
            scores[flavor_cat] += base_score * position_weight
    return scores


def get_keyword_flavors(text):
    """Get flavor hints from any text (strain name, genetics, description)."""
    scores = Counter()
    lower = text.lower()
    for pattern, flavor in KEYWORD_FLAVOR_MAP:
        if re.search(pattern, lower):
            scores[flavor] += 0.5
    return scores


def get_genetics_inheritance(genetics_text):
    """Parse genetics text and look up parent strain flavors."""
    if not genetics_text or genetics_text.upper() == 'NULL':
        return Counter()

    scores = Counter()
    lower = genetics_text.lower()

    # Try to match known parent strains
    for parent, flavors in KNOWN_PARENT_FLAVORS.items():
        if parent in lower:
            for f in flavors:
                scores[f] += 1.2  # Strong inheritance signal
            break  # Only use first match to avoid double-counting

    # Also run keyword analysis on genetics text
    kw = get_keyword_flavors(genetics_text)
    for cat, score in kw.items():
        scores[cat] += score * 0.8  # Slightly less weight than direct match

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

    # Get all strains with genetics
    strains = conn.execute("""
        SELECT s.id, s.name, s.strain_type, sm.genetics
        FROM strains s
        LEFT JOIN strain_metadata sm ON sm.strain_id = s.id
        ORDER BY s.id
    """).fetchall()

    total = len(strains)
    updated = 0
    source_stats = Counter()
    flavor_stats = Counter()

    for strain_id, name, strain_type, genetics in strains:
        flavor_scores = Counter()
        sources_used = []

        # Source 1: Terpene profile (science) — strongest signal
        terpenes = conn.execute("""
            SELECT m.name, sc.percentage
            FROM strain_compositions sc
            JOIN molecules m ON m.id = sc.molecule_id
            WHERE sc.strain_id = ? AND m.molecule_type = 'terpene'
            ORDER BY sc.percentage DESC
        """, (strain_id,)).fetchall()

        if terpenes:
            terp_flavors = compute_terpene_flavors(terpenes)
            for cat, score in terp_flavors.items():
                flavor_scores[cat] += score * 1.5
            sources_used.append('terpene')

        # Source 2: Community-reported flavors — strong real-world signal
        comm = community_flavors.get(name, [])
        if comm:
            for cat in comm:
                flavor_scores[cat] += 2.0
            sources_used.append('community')

        # Source 3: Genetics inheritance — inherit from known parents
        if genetics and genetics.strip() and genetics.upper() != 'NULL':
            gen_flavors = get_genetics_inheritance(genetics)
            if gen_flavors:
                for cat, score in gen_flavors.items():
                    flavor_scores[cat] += score
                sources_used.append('genetics')

        # Source 4: Name-based keyword analysis
        name_kw = get_keyword_flavors(name)
        if name_kw:
            for cat, score in name_kw.items():
                flavor_scores[cat] += score
            if name_kw:
                sources_used.append('name')

        # Source 5: Type-based defaults (fallback) — only if nothing else worked
        if not flavor_scores and strain_type in TYPE_DEFAULTS:
            for f in TYPE_DEFAULTS[strain_type]:
                flavor_scores[f] += 0.6
            sources_used.append('type-default')

        if not flavor_scores:
            # Absolute fallback: hybrid defaults
            for f in TYPE_DEFAULTS['hybrid']:
                flavor_scores[f] += 0.6
            sources_used.append('fallback')

        # Select top flavors — lower threshold for inherited/inferred data
        min_threshold = 0.5 if ('terpene' in sources_used or 'community' in sources_used) else 0.3
        sorted_flavors = [
            (cat, score) for cat, score in flavor_scores.most_common(5)
            if score >= min_threshold
        ]

        if not sorted_flavors:
            # Still nothing — use type defaults directly
            sorted_flavors = [(f, 1.0) for f in TYPE_DEFAULTS.get(strain_type, TYPE_DEFAULTS['hybrid'])]
            sources_used = ['type-default']

        # Cap at 4 flavors
        final_flavors = [cat for cat, score in sorted_flavors[:4]]

        for flavor in final_flavors:
            conn.execute(
                "INSERT OR IGNORE INTO strain_flavors (strain_id, flavor) VALUES (?, ?)",
                (strain_id, flavor)
            )
            flavor_stats[flavor] += 1

        # Track source usage
        for src in set(sources_used):
            source_stats[src] += 1

        updated += 1
        if updated <= 25:
            print(f"  {name}: {final_flavors}  (via: {', '.join(sources_used)})")

    if updated > 25:
        print(f"  ... and {updated - 25} more\n")

    conn.commit()
    conn.close()

    print(f"\nSummary:")
    print(f"  Updated: {updated} / {total} strains (100% coverage)")
    print(f"\nData sources used:")
    for src in ['terpene', 'community', 'genetics', 'name', 'type-default', 'fallback']:
        print(f"  {src}: {source_stats.get(src, 0)}")
    print(f"\nFlavor distribution:")
    for cat in QUIZ_FLAVORS:
        print(f"  {cat}: {flavor_stats.get(cat, 0)}")


if __name__ == "__main__":
    fix_flavors()
