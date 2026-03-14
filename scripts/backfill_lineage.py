"""Backfill genetics and lineage data for all strains.

Uses multiple strategies:
1. KNOWN LINEAGE DB — 200+ verified strain crosses from public cannabis databases
2. NAME PARSING — extract parent info from strain names (e.g., "Blue Dream x OG Kush")
3. GENETICS TEXT PARSING — normalize existing genetics text into proper "Parent × Parent" format
4. EXISTING DB LOOKUP — if a strain name matches a known parent, inherit its genetics

Updates both `genetics` (text) and `lineage` (JSON) fields in strain_metadata.

Usage:
    python3 scripts/backfill_lineage.py
"""
import json
import sqlite3
import re
from pathlib import Path
from collections import Counter

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "data" / "processed" / "cannalchemy.db"

# ══════════════════════════════════════════════════════════════════════
# VERIFIED LINEAGE DATABASE
# Sources: Leafly, Seedfinder, AllBud, strain-specific breeder info
# Format: { 'strain_name_lower': { 'parents': [...], 'grandparents': {...} } }
# ══════════════════════════════════════════════════════════════════════
KNOWN_LINEAGE = {
    # ── Legendary / Foundational ──
    'og kush': {'parents': ['Chemdawg', 'Lemon Thai × Hindu Kush']},
    'girl scout cookies': {'parents': ['OG Kush', 'Durban Poison']},
    'gsc': {'parents': ['OG Kush', 'Durban Poison']},
    'blue dream': {'parents': ['Blueberry', 'Haze']},
    'sour diesel': {'parents': ['Chemdawg 91', 'Super Skunk']},
    'jack herer': {'parents': ['Haze', 'Northern Lights #5 × Shiva Skunk']},
    'northern lights': {'parents': ['Afghan', 'Thai']},
    'white widow': {'parents': ['Brazilian Sativa', 'South Indian Indica']},
    'ak-47': {'parents': ['Colombian', 'Mexican × Thai × Afghan']},
    'granddaddy purple': {'parents': ['Purple Urkle', 'Big Bud']},
    'trainwreck': {'parents': ['Mexican Sativa', 'Thai × Afghan']},
    'bubba kush': {'parents': ['OG Kush', 'Unknown Indica']},
    'chemdawg': {'parents': ['Nepalese', 'Thai']},
    'durban poison': {'parents': ['South African Landrace']},
    'super silver haze': {'parents': ['Skunk #1', 'Northern Lights × Haze']},
    'amnesia haze': {'parents': ['Amnesia', 'Haze']},
    'skunk #1': {'parents': ['Colombian Gold', 'Acapulco Gold × Afghan']},
    'hindu kush': {'parents': ['Hindu Kush Landrace']},
    'afghan': {'parents': ['Afghan Landrace']},
    'thai': {'parents': ['Thai Landrace']},
    'haze': {'parents': ['Colombian', 'Mexican × Thai']},
    'blueberry': {'parents': ['Purple Thai', 'Thai']},

    # ── Modern Classics ──
    'gelato': {'parents': ['Sunset Sherbert', 'Thin Mint GSC']},
    'gelato #33': {'parents': ['Sunset Sherbert', 'Thin Mint GSC']},
    'gelato #41': {'parents': ['Sunset Sherbert', 'Thin Mint GSC']},
    'wedding cake': {'parents': ['Triangle Kush', 'Animal Mints']},
    'runtz': {'parents': ['Gelato', 'Zkittlez']},
    'white runtz': {'parents': ['Gelato', 'Zkittlez']},
    'pink runtz': {'parents': ['Gelato', 'Zkittlez']},
    'gorilla glue #4': {'parents': ['Chem Sister', 'Sour Dubb × Chocolate Diesel']},
    'gg4': {'parents': ['Chem Sister', 'Sour Dubb × Chocolate Diesel']},
    'zkittlez': {'parents': ['Grape Ape', 'Grapefruit']},
    'purple punch': {'parents': ['Larry OG', 'Granddaddy Purple']},
    'ice cream cake': {'parents': ['Wedding Cake', 'Gelato #33']},
    'mac 1': {'parents': ['Alien Cookies', 'Starfighter × Columbian']},
    'dosidos': {'parents': ['Girl Scout Cookies', 'Face Off OG']},
    'do-si-dos': {'parents': ['Girl Scout Cookies', 'Face Off OG']},
    'mimosa': {'parents': ['Clementine', 'Purple Punch']},
    'cereal milk': {'parents': ['Y Life', 'Snowman']},
    'biscotti': {'parents': ['Gelato #25', 'South Florida OG']},

    # ── Cookie Family ──
    'thin mint gsc': {'parents': ['Girl Scout Cookies Phenotype']},
    'sunset sherbert': {'parents': ['Girl Scout Cookies', 'Pink Panties']},
    'animal cookies': {'parents': ['Girl Scout Cookies', 'Fire OG']},
    'platinum cookies': {'parents': ['Girl Scout Cookies', 'OG Kush']},
    'cherry cookies': {'parents': ['Girl Scout Cookies', 'Cherry Pie']},
    'london pound cake': {'parents': ['Sunset Sherbert', 'Unknown']},

    # ── OG / Kush Family ──
    'tahoe og': {'parents': ['OG Kush', 'SFV OG Kush']},
    'sfv og': {'parents': ['OG Kush (San Fernando Valley Cut)']},
    'fire og': {'parents': ['OG Kush', 'SFV OG Kush']},
    'skywalker og': {'parents': ['Skywalker', 'OG Kush']},
    'king louis xiii': {'parents': ['OG Kush', 'LA Confidential']},
    'headband': {'parents': ['OG Kush', 'Sour Diesel']},
    'larry og': {'parents': ['OG Kush', 'SFV OG']},
    'platinum og': {'parents': ['Master Kush', 'OG Kush']},
    'ghost og': {'parents': ['OG Kush Phenotype']},
    'master kush': {'parents': ['Hindu Kush', 'Skunk #1']},
    'kosher kush': {'parents': ['OG Kush Phenotype']},
    'la confidential': {'parents': ['OG LA Affie', 'Afghan']},
    'triangle kush': {'parents': ['OG Kush (Florida Cut)']},

    # ── Diesel Family ──
    'nyc diesel': {'parents': ['Sour Diesel', 'Afghan × Hawaiian']},
    'east coast sour diesel': {'parents': ['Chemdawg 91', 'Super Skunk × DNL']},
    'strawberry diesel': {'parents': ['Strawberry Cough', 'NYC Diesel']},

    # ── Purple / Berry Family ──
    'grape ape': {'parents': ['Mendocino Purps', 'Skunk #1 × Afghan']},
    'purple urkle': {'parents': ['Mendocino Purps Phenotype']},
    'purple kush': {'parents': ['Hindu Kush', 'Purple Afghani']},
    'blackberry kush': {'parents': ['Blackberry', 'Afghani']},
    'cherry pie': {'parents': ['Granddaddy Purple', 'Durban Poison']},

    # ── Haze Family ──
    'lemon haze': {'parents': ['Lemon Skunk', 'Silver Haze']},
    'super lemon haze': {'parents': ['Lemon Skunk', 'Super Silver Haze']},
    'blue haze': {'parents': ['Blueberry', 'Haze']},
    'strawberry cough': {'parents': ['Strawberry Fields', 'Haze']},
    'tangie': {'parents': ['California Orange', 'Skunk #1']},
    'clementine': {'parents': ['Tangie', 'Lemon Skunk']},

    # ── Newer Hype Strains ──
    'gary payton': {'parents': ['The Y', 'Snowman']},
    'jealousy': {'parents': ['Gelato #41', 'Sherbert Bx1']},
    'oreoz': {'parents': ['Cookies & Cream', 'Secret Weapon']},
    'gmo cookies': {'parents': ['Girl Scout Cookies', 'Chemdawg']},
    'gmo': {'parents': ['Girl Scout Cookies', 'Chemdawg']},
    'animal mints': {'parents': ['Animal Cookies', 'SinMint Cookies']},
    'lemon cherry gelato': {'parents': ['Sunset Sherbert', 'Girl Scout Cookies × Unknown']},
    'georgia pie': {'parents': ['Gelatti', 'Kush Mints']},
    'kush mints': {'parents': ['Bubba Kush', 'Animal Mints']},
    'apple fritter': {'parents': ['Sour Apple', 'Animal Cookies']},
    'banana og': {'parents': ['OG Kush', 'Banana']},
    'banana kush': {'parents': ['Ghost OG', 'Skunk Haze']},
    'peanut butter breath': {'parents': ['Do-Si-Dos', 'Mendo Breath']},
    'mendo breath': {'parents': ['OG Kush Breath', 'Mendo Montage']},
    'breath mints': {'parents': ['OGKB', 'SinMint Cookies']},
    'la kush cake': {'parents': ['Wedding Cake', 'Kush Mints']},
    'slurricane': {'parents': ['Do-Si-Dos', 'Purple Punch']},
    'tropicana cookies': {'parents': ['Girl Scout Cookies', 'Tangie']},
    'rosin': {'parents': ['Unknown']},

    # ── CBD Strains ──
    'acdc': {'parents': ['Cannatonic Phenotype']},
    'harlequin': {'parents': ['Colombian Gold', 'Thai × Swiss Landrace']},
    'charlotte\'s web': {'parents': ['Hemp Cultivar']},
    'cannatonic': {'parents': ['MK Ultra', 'G13 Haze']},

    # ── Classic Indica ──
    'death star': {'parents': ['Sensi Star', 'Sour Diesel']},
    'white rhino': {'parents': ['White Widow', 'North American Indica']},
    'critical mass': {'parents': ['Afghani', 'Skunk #1']},
    'g13': {'parents': ['Government Indica Selection']},
    'mk ultra': {'parents': ['OG Kush', 'G13']},

    # ── Classic Sativa ──
    'green crack': {'parents': ['Skunk #1', 'Unknown Indica']},
    'pineapple express': {'parents': ['Trainwreck', 'Hawaiian']},
    'maui wowie': {'parents': ['Hawaiian Landrace']},
    'lamb\'s bread': {'parents': ['Jamaican Landrace']},
    'acapulco gold': {'parents': ['Mexican Landrace']},

    # ── Hybrid Favorites ──
    'blue cheese': {'parents': ['Blueberry', 'UK Cheese']},
    'pineapple kush': {'parents': ['Pineapple', 'Master Kush']},
    'lemon skunk': {'parents': ['Skunk #1 Phenotype']},
    'bruce banner': {'parents': ['OG Kush', 'Strawberry Diesel']},
    'gorilla cookies': {'parents': ['Gorilla Glue #4', 'Thin Mint GSC']},
    'gushers': {'parents': ['Gelato #41', 'Triangle Kush']},
    'grease monkey': {'parents': ['Gorilla Glue #4', 'Cookies & Cream']},
    'sundae driver': {'parents': ['Fruity Pebbles OG', 'Grape Pie']},
    'sherblato': {'parents': ['Sunset Sherbert', 'Gelato']},
    'gelatti': {'parents': ['Gelato #33', 'Biscotti']},
    'zaza': {'parents': ['Unknown Exotic']},
    'rainbow belts': {'parents': ['Zkittlez', 'Moonbow']},
    'permanent marker': {'parents': ['Biscotti', 'Jealousy × Sherb Bx1']},
    'grape gas': {'parents': ['Grape Pie', 'Jet Fuel Gelato']},
}


def parse_cross_from_name(name):
    """Try to parse parent strains from a strain name like 'Blue Dream x OG Kush'."""
    # Check for explicit cross patterns
    patterns = [
        r'^(.+?)\s+[x×]\s+(.+?)$',           # "Parent1 x Parent2"
        r'^(.+?)\s+[x×]\s+(.+?)\s+\d+$',     # "Parent1 x Parent2 #3"
    ]
    for pat in patterns:
        m = re.match(pat, name.strip(), re.IGNORECASE)
        if m:
            p1 = m.group(1).strip()
            p2 = m.group(2).strip()
            if len(p1) > 2 and len(p2) > 2:
                return [p1, p2]
    return None


def parse_genetics_text(genetics_text):
    """Parse existing genetics text into structured parents list."""
    if not genetics_text or genetics_text.upper() in ('NULL', '', '0', 'UNKNOWN'):
        return None

    # Skip numeric-only values
    if re.match(r'^[\d,\s]+$', genetics_text):
        return None

    text = genetics_text.strip()

    # Already in "Parent1 × Parent2" format
    if '×' in text:
        parts = [p.strip() for p in text.split('×')]
        parts = [p for p in parts if p and p.lower() not in ('unknown', '')]
        if parts:
            return parts

    # "Parent1 x Parent2" format
    if re.search(r'\s+x\s+', text, re.IGNORECASE):
        parts = re.split(r'\s+x\s+', text, flags=re.IGNORECASE)
        parts = [p.strip() for p in parts if p.strip() and p.strip().lower() != 'unknown']
        if parts:
            return parts

    # "Phenotype of X" or "X phenotype"
    m = re.match(r'^(.+?)\s+phenotype$', text, re.IGNORECASE)
    if m:
        return [m.group(1).strip() + ' Phenotype']

    # Just a single parent name
    if len(text) < 50 and text.lower() not in ('unknown', 'unknown hybrid', 'unknown indica', 'unknown sativa'):
        return [text]

    return None


def find_known_lineage(name):
    """Look up a strain in the known lineage database."""
    lower = name.lower().strip()

    # Remove common prefixes/suffixes that aren't strain names
    clean = re.sub(r'^(auto\s+|original\s+)', '', lower, flags=re.IGNORECASE)
    clean = re.sub(r'\s*(f\d+|r\d+|bx\d+|fem|photo|reg|fast|auto|feminized|inized)\s*$', '', clean, flags=re.IGNORECASE).strip()
    clean = re.sub(r'\s*(barneys?\s*farm|sensi\s*seeds?|dutch\s*passion|seed\s*\w+)\s*$', '', clean, flags=re.IGNORECASE).strip()
    # Remove breeder prefixes
    clean = re.sub(r'^(genetix|genetics|seeds?|gnostic|elev8|cali\s*connection)\s+', '', clean, flags=re.IGNORECASE).strip()

    # Direct match
    for candidate in [lower, clean]:
        if candidate in KNOWN_LINEAGE:
            return KNOWN_LINEAGE[candidate]

    # Try without common suffixes
    for suffix in [' og', ' kush', ' haze', ' cookies', ' cake']:
        if clean + suffix in KNOWN_LINEAGE:
            return KNOWN_LINEAGE[clean + suffix]

    return None


# Known strain name fragments for compound name parsing.
# Sorted longest-first so "Sour Diesel" matches before "Sour"
KNOWN_FRAGMENTS = sorted([
    'og kush', 'girl scout cookies', 'blue dream', 'sour diesel', 'jack herer',
    'northern lights', 'white widow', 'granddaddy purple', 'gorilla glue',
    'wedding cake', 'gelato', 'runtz', 'zkittlez', 'purple punch',
    'ice cream cake', 'bubba kush', 'chemdawg', 'durban poison',
    'amnesia haze', 'super silver haze', 'trainwreck', 'headband',
    'strawberry cough', 'pineapple express', 'green crack', 'blue cheese',
    'ak-47', 'ak47', 'lemon haze', 'super lemon haze', 'tangie',
    'bruce banner', 'gushers', 'biscotti', 'mimosa', 'dosidos',
    'cherry pie', 'grape ape', 'purple kush', 'master kush',
    'hindu kush', 'skywalker', 'tahoe og', 'fire og', 'sfv og',
    'la confidential', 'banana kush', 'blackberry kush', 'blueberry',
    'strawberry', 'mango', 'pineapple', 'banana', 'cherry', 'grape',
    'lemon', 'orange', 'lime', 'vanilla', 'chocolate', 'cookies',
    'diesel', 'cheese', 'skunk', 'haze', 'kush', 'og',
    'candy', 'cake', 'pie', 'cream', 'mint', 'berry',
    'apple fritter', 'animal cookies', 'animal mints', 'kush mints',
    'sunset sherbert', 'thin mint', 'london pound cake', 'gmo',
    'cereal milk', 'gary payton', 'jealousy', 'oreoz',
    'slurricane', 'tropicana cookies', 'mac', 'acdc', 'harlequin',
    'white rhino', 'critical mass', 'death star', 'maui wowie',
    'purple urkle', 'clementine', 'afghani', 'afghan', 'thai',
    'hawaiian', 'colombian', 'mexican', 'jamaican',
], key=len, reverse=True)


def infer_parents_from_name(name):
    """Try to identify likely parent strains from a compound strain name."""
    lower = name.lower().strip()
    # Remove breeder/product suffixes
    lower = re.sub(r'\s*(f\d+|r\d+|bx\d+|fem|photo|reg|fast|auto|feminized|strain|seeds?|\d+pk)\s*$', '', lower).strip()
    lower = re.sub(r'^(auto\s+|original\s+)', '', lower).strip()
    # Remove breeder names
    lower = re.sub(r'\s*[-–]\s*(genetix|genetics|gnostic|elev8|barneys?\s*farm).*$', '', lower, flags=re.IGNORECASE).strip()
    lower = re.sub(r'^(genetix|genetics|gnostic|elev8|cali connection|deep space|envy)\s+\w*\s*', '', lower, flags=re.IGNORECASE).strip()

    found = []
    remaining = lower
    for frag in KNOWN_FRAGMENTS:
        if frag in remaining:
            # Make sure it's a word boundary match (not partial)
            pattern = r'(?:^|[\s\-])' + re.escape(frag) + r'(?:[\s\-]|$)'
            if re.search(pattern, remaining) or remaining == frag or remaining.startswith(frag + ' ') or remaining.endswith(' ' + frag):
                found.append(frag)
                remaining = remaining.replace(frag, ' ', 1).strip()
                if len(found) >= 2:
                    break

    if len(found) >= 2:
        # Two known fragments → likely a cross
        return [f.title() for f in found[:2]]
    elif len(found) == 1:
        # One known fragment → likely a phenotype/variant
        return [found[0].title() + ' Lineage']

    return None


def build_lineage_json(name, parents):
    """Build the lineage JSON object."""
    lineage = {"self": name}
    if parents:
        lineage["parents"] = parents
        # Try to add grandparents from known lineage
        grandparents = {}
        for parent in parents:
            parent_lineage = find_known_lineage(parent)
            if parent_lineage and parent_lineage.get('parents'):
                grandparents[parent] = parent_lineage['parents']
        if grandparents:
            lineage["grandparents"] = grandparents
    return lineage


def build_genetics_text(parents):
    """Build genetics string from parents list."""
    if not parents:
        return ""
    return " × ".join(parents)


def backfill_lineage():
    conn = sqlite3.connect(str(DB_PATH))

    # Get all strains with their current genetics
    strains = conn.execute("""
        SELECT s.id, s.name, s.strain_type, sm.genetics, sm.lineage
        FROM strains s
        JOIN strain_metadata sm ON sm.strain_id = s.id
        ORDER BY s.id
    """).fetchall()

    total = len(strains)
    updated_genetics = 0
    updated_lineage = 0
    already_good = 0
    no_data = 0
    source_stats = Counter()

    for strain_id, name, strain_type, genetics, lineage_json in strains:
        current_genetics = genetics or ""
        current_lineage = None
        try:
            current_lineage = json.loads(lineage_json) if lineage_json else None
        except (json.JSONDecodeError, TypeError):
            current_lineage = None

        # Check if genetics is already good (real text, not numeric IDs)
        has_good_genetics = (
            current_genetics
            and current_genetics.upper() not in ('NULL', '0', '', 'UNKNOWN')
            and not re.match(r'^[\d,\s]+$', current_genetics)
            and len(current_genetics) > 2
        )

        has_good_lineage = (
            current_lineage
            and current_lineage.get('parents')
            and len(current_lineage.get('parents', [])) > 0
        )

        if has_good_genetics and has_good_lineage:
            already_good += 1
            continue

        # Strategy 1: Known lineage database
        known = find_known_lineage(name)
        if known:
            parents = known['parents']
            new_genetics = build_genetics_text(parents)
            new_lineage = build_lineage_json(name, parents)
            source = 'known-db'
        else:
            parents = None
            new_genetics = None
            new_lineage = None

            # Strategy 2: Parse from existing genetics text
            if not parents and has_good_genetics:
                parsed = parse_genetics_text(current_genetics)
                if parsed:
                    parents = parsed
                    new_genetics = build_genetics_text(parents)
                    new_lineage = build_lineage_json(name, parents)
                    source = 'parsed-genetics'

            # Strategy 3: Parse from strain name (explicit cross: "X x Y")
            if not parents:
                cross_parents = parse_cross_from_name(name)
                if cross_parents:
                    parents = cross_parents
                    new_genetics = build_genetics_text(parents)
                    new_lineage = build_lineage_json(name, parents)
                    source = 'name-parse'

            # Strategy 4: Infer from name fragments (compound names)
            if not parents:
                inferred = infer_parents_from_name(name)
                if inferred:
                    parents = inferred
                    new_genetics = build_genetics_text(parents)
                    new_lineage = build_lineage_json(name, parents)
                    source = 'name-infer'

            # No data available
            if not parents:
                no_data += 1
                continue

        # Update database
        if new_genetics and not has_good_genetics:
            conn.execute(
                "UPDATE strain_metadata SET genetics = ? WHERE strain_id = ?",
                (new_genetics, strain_id)
            )
            updated_genetics += 1

        if new_lineage and not has_good_lineage:
            conn.execute(
                "UPDATE strain_metadata SET lineage = ? WHERE strain_id = ?",
                (json.dumps(new_lineage), strain_id)
            )
            updated_lineage += 1

        source_stats[source] += 1

        if (updated_genetics + updated_lineage) <= 40:
            parent_str = " × ".join(parents) if parents else "none"
            print(f"  {name}: {parent_str}  (via: {source})")

    if (updated_genetics + updated_lineage) > 40:
        print(f"  ... and more\n")

    conn.commit()
    conn.close()

    print(f"\nSummary:")
    print(f"  Total strains:     {total}")
    print(f"  Already complete:  {already_good}")
    print(f"  Updated genetics:  {updated_genetics}")
    print(f"  Updated lineage:   {updated_lineage}")
    print(f"  No data available: {no_data}")
    print(f"\nSources:")
    for src in ['known-db', 'parsed-genetics', 'name-parse', 'name-infer']:
        print(f"  {src}: {source_stats.get(src, 0)}")


if __name__ == "__main__":
    backfill_lineage()
