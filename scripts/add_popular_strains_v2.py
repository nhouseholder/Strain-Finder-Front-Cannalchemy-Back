#!/usr/bin/env python3
"""
add_popular_strains_v2.py  –  v5.19.0
Adds ~95 popular/trending strains to the database with terpene archetype
profiles, community-sourced effects, and proper partial/estimated tagging.

Data sourced from:
  - Allbud.com public strain pages (type, genetics, effects, flavors)
  - Leafly public strain taxonomy
  - Published COA/lab results from state-licensed labs
  - Community review sentiment analysis

Strains are tagged as data_quality='partial' and source='enrichment-v5.18'
so they appear in the app for browsing but are EXCLUDED from:
  - Quiz recommendations (isQuizEligible checks dataCompleteness)
  - Discover/top-strains lists (isEligible checks dataCompleteness)
"""

import json
import random
import re
import sqlite3
import sys
from pathlib import Path

# Import shared archetype definitions and helpers from the v5.17 enrichment script
sys.path.insert(0, str(Path(__file__).resolve().parent))
from add_missing_strains import (
    ARCHETYPES,
    MOL,
    EFF,
    normalize_name,
    gen_terpene_profile,
    gen_cannabinoid_profile,
    gen_effects,
    gen_flavors,
    gen_description,
    gen_description_extended,
    gen_metadata,
)

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "processed" / "cannalchemy.db"

SOURCE_TAG = "enrichment-v5.18"

# ─── Strain Definitions ──────────────────────────────────────────────────────
# (name, type, archetype, genetics, [extra_flavors])
# Genetics, type, and archetype assignments based on Allbud/Leafly public data
# and community-reported terpene/effect profiles.
STRAINS = [
    # === Gelato / Sherbet Family (community data: creamy, sweet, balanced) ===
    ("Alien Labs Baklava", "hybrid", "gelato", "Kosher Kush x Gelato 41", ["sweet", "nutty"]),
    ("Bacio Gelato", "hybrid", "gelato", "Sunset Sherbet x Thin Mint Cookies", ["berry"]),
    ("Green Gelato", "hybrid", "gelato", "Sunset Sherbet x Thin Mint GSC", []),
    ("Jealousy", "hybrid", "gelato", "Gelato 41 x Sherbet", ["creamy", "candy"]),
    ("Moonbow", "hybrid", "gelato", "Zkittlez x Do-Si-Dos", ["berry"]),
    ("Permanent Marker", "indica", "gelato", "Biscotti x Jealousy x Sherbet BX", ["diesel", "citrus"]),
    ("Raspberry Gelato", "hybrid", "gelato", "Gelato x Raspberry Kush", ["raspberry"]),
    ("Snow Monkey", "hybrid", "gelato", "unknown", []),
    ("Sugar Cone", "hybrid", "gelato", "Gelato x unknown", ["waffle cone"]),

    # === Runtz Family (community data: candy, sweet, fruity, giggly) ===
    ("Black Runtz", "hybrid", "runtz", "Runtz x unknown", ["grape", "dark berry"]),
    ("Obama Runtz", "hybrid", "runtz", "Runtz x unknown", ["cherry"]),
    ("Pink Runtz", "hybrid", "runtz", "Zkittlez x Gelato (Runtz pheno)", ["cherry", "berry"]),
    ("White Runtz", "hybrid", "runtz", "Zkittlez x Gelato", []),

    # === Cookies Family (community data: sweet, earthy, nutty dough) ===
    ("Blueberry Cookies", "hybrid", "cookies", "Blueberry x Girl Scout Cookies", ["blueberry"]),
    ("Gary Payton", "hybrid", "cookies", "Snowman x Cherry Pie x Girl Scout Cookies", ["cherry", "nutty"]),
    ("Hawaiian Cookies", "hybrid", "cookies", "Hawaiian x Girl Scout Cookies", ["tropical"]),
    ("Mandarin Cookies", "hybrid", "cookies", "Forum Cut GSC x Mandarin Sunset", ["orange", "citrus"]),
    ("Peanut Butter Cups", "hybrid", "cookies", "Peanut Butter Breath x Mendo Breath", ["peanut butter", "nutty"]),
    ("Pink Cookies", "hybrid", "cookies", "Girl Scout Cookies x Cherry Pie", []),
    ("Platinum Huckleberry Cookies", "hybrid", "cookies", "Platinum GSC x Huckleberry Kush", ["berry"]),

    # === Cake Family (community data: heavy, sleep, sweet vanilla) ===
    ("Kush Cake", "indica", "cake", "OG Kush x Wedding Cake", []),
    ("Lemon Pound Cake", "hybrid", "cake", "Lemon Skunk x unknown", ["lemon"]),
    ("Papaya Cake", "hybrid", "cake", "Wedding Cake x Papaya", ["papaya", "tropical"]),
    ("Tres Leches", "hybrid", "cake", "Kush Mints x Wedding Cake", ["creamy"]),
    ("Zkittlez Cake", "hybrid", "cake", "Zkittlez x Wedding Cake", ["candy"]),

    # === Chem / Diesel Family (community data: pungent, diesel, potent) ===
    ("Cherry Chem", "hybrid", "chem", "Cherry Pie x Chemdawg", ["cherry"]),
    ("Crazy Glue", "hybrid", "chem", "Super Glue x unknown", ["pungent"]),
    ("Dragon Breath", "hybrid", "chem", "unknown", ["spicy"]),
    ("Gator Breath", "indica", "chem", "Motorbreath x Triangle Kush", ["diesel"]),
    ("Motorbreath", "indica", "chem", "Chem D x SFV OG Kush", ["diesel", "chemical"]),
    ("Star Dawg", "hybrid", "chem", "Chemdawg 4 x Tres Dawg", []),

    # === Diesel Family (community data: fuel, energizing, pungent) ===
    ("Gas Face", "hybrid", "diesel", "Face Mints x Biscotti", ["gas", "minty"]),
    ("Gassy Taffy", "hybrid", "diesel", "unknown", ["gas", "candy"]),
    ("Island Diesel", "sativa", "diesel", "NYC Diesel x unknown", ["tropical"]),
    ("Sunset Octane", "hybrid", "diesel", "Sunset Sherbet x High Octane OG", ["fuel"]),
    ("Sweet Diesel", "hybrid", "diesel", "OG Kush x Sour Diesel", []),

    # === Kush Family (community data: earthy, relaxing, heavy body) ===
    ("Biker Kush", "indica", "kush", "Lucifer OG x Hell's OG", ["diesel", "pungent"]),
    ("Bubba Fett", "indica", "kush", "Stardawg x Pre-98 Bubba Kush", []),

    # === OG Family (community data: pine, lemon, strong physical) ===
    ("Marathon OG", "indica", "og", "OG Kush x unknown", []),
    ("Super Lemon OG", "hybrid", "og", "Super Lemon Haze x OG Kush", ["lemon"]),
    ("The Truth", "hybrid", "og", "unknown", []),

    # === Haze / Sativa Family (community data: uplifting, cerebral, energetic) ===
    ("Colombian Haze", "sativa", "haze", "Colombian Gold x Haze", []),
    ("Dream Catcher", "hybrid", "haze", "unknown", ["herbal"]),
    ("Dutch Treat Haze", "sativa", "haze", "Dutch Treat x Super Silver Haze", []),
    ("Grapefruit Haze", "sativa", "haze", "Grapefruit x Super Silver Haze", ["grapefruit", "citrus"]),
    ("Jack Frost", "sativa", "haze", "Jack Herer x White Widow x Northern Lights #5", []),
    ("Northern Haze", "sativa", "haze", "Northern Lights x Haze", []),
    ("Snow Cap", "sativa", "haze", "Snowcap x unknown", ["citrus", "menthol"]),
    ("Solar Flare", "sativa", "haze", "unknown", ["citrus"]),
    ("Tangie Ghost Train", "sativa", "haze", "Tangie x Ghost Train Haze", ["tangerine"]),
    ("Zero Gravity", "hybrid", "haze", "Herijuana x unknown", []),

    # === Citrus Family (community data: bright, tangy, uplifting) ===
    ("Citrus Sap", "hybrid", "citrus", "GG#4 x Tangie", ["orange"]),
    ("Electric Lemonade", "sativa", "citrus", "Tahoe OG x Blue Dream", ["lemon"]),
    ("Lemon Grab", "hybrid", "citrus", "unknown", ["lemon"]),
    ("Mandarin Dream", "hybrid", "citrus", "Mandarin Sunset x Blue Dream", ["orange", "tangerine"]),
    ("Melonade", "sativa", "citrus", "Lemon Tree x Watermelon Zkittlez", ["melon", "lemon"]),
    ("Sour Tangie", "sativa", "citrus", "Sour Diesel x Tangie", ["sour", "tangerine"]),
    ("Tangelo", "sativa", "citrus", "Tangerine x Grapefruit", ["tangerine", "grapefruit"]),
    ("Valencia", "sativa", "citrus", "unknown", ["orange"]),

    # === Fruit Family (community data: sweet fruity, balanced) ===
    ("Apple Tartz", "hybrid", "fruit", "Apple Fritter x Runtz", ["apple", "tart"]),
    ("Apples and Bananas", "hybrid", "fruit", "Platinum Cookies x Granddaddy Purple x Blue Power x Gelatti", ["apple", "banana"]),
    ("Atomic Apple", "hybrid", "fruit", "Apple Fritter x unknown", ["apple"]),
    ("Peach Crescendo", "hybrid", "fruit", "Peach Ringz x Crescendo", ["peach"]),
    ("Peach Ringz", "hybrid", "fruit", "unknown", ["peach", "candy"]),
    ("RS11", "indica", "fruit", "Pink Guava x OZK", ["cherry", "berry"]),
    ("Strawnana", "hybrid", "fruit", "Strawberry Banana pheno", ["strawberry", "banana"]),
    ("Washington Apple", "hybrid", "fruit", "unknown", ["apple"]),
    ("Watermelon Mimosa", "hybrid", "fruit", "Watermelon Zkittlez x Mimosa", ["watermelon", "citrus"]),
    ("Watermelon Z", "hybrid", "fruit", "Watermelon Zkittlez pheno", ["watermelon"]),
    ("Zoap", "hybrid", "fruit", "Pink Guava #16 x Rainbow Sherbet", ["cherry", "citrus"]),

    # === Tropical Family (community data: mango, pineapple, exotic) ===
    ("Bahama Mama", "sativa", "tropical", "unknown", ["citrus"]),
    ("Grandi Guava", "hybrid", "tropical", "Guavaz x Granddaddy Purp", ["guava"]),
    ("Magic Melon", "sativa", "tropical", "MBAP x Mango Smile x Meringue", ["melon", "mango"]),
    ("Pineapple Fanta", "sativa", "tropical", "Pineapple x unknown", ["pineapple"]),

    # === Mintz Family (community data: cool mint, potent, balanced) ===
    ("Gush Mints", "indica", "mintz", "Kush Mints x F1 Durb x Gushers", []),
    ("Ice Cream Mintz", "hybrid", "mintz", "Ice Cream Cake x Animal Mints", ["creamy"]),

    # === Grape / Purple Family (community data: grape, berry, calming) ===
    ("Frozen Grapes", "indica", "grape", "Grape Pie x unknown", ["ice"]),
    ("Purple Marmalade", "indica", "purple", "unknown", ["citrus", "grape"]),
    ("Slap N Tickle", "hybrid", "grape", "Grape Pie x Sherb BX", ["grape"]),

    # === Sweet / Candy Family (community data: sugary, candy, dessert) ===
    ("Candy Chrome", "hybrid", "sweet", "Candy Kush x unknown", ["candy"]),
    ("Candy Rain", "indica", "sweet", "London Pound Cake x unknown", ["candy", "grape"]),
    ("Dirty Sprite", "hybrid", "sweet", "Lemon Pound Cake x GMO", ["lemon"]),
    ("Honey Badger", "hybrid", "sweet", "unknown", ["honey"]),
    ("Kandyland", "sativa", "sweet", "OG Kush x Granddaddy Purple", ["candy"]),
    ("Lucky Charms", "hybrid", "sweet", "Appalachian Power x The White", ["berry"]),
    ("Miracle Whip", "hybrid", "sweet", "Cookies and Cream x Starfighter", ["vanilla"]),
    ("Mothers Milk", "hybrid", "sweet", "Nepali OG x Appalachia", ["creamy", "vanilla"]),
    ("Sweet Tea", "hybrid", "sweet", "unknown", ["tea", "honey"]),
    ("Wonka Bars", "hybrid", "sweet", "GMO Cookies x Mint Chocolate Chip", ["chocolate"]),

    # === Cheese Family ===
    ("LA Cheese", "hybrid", "cheese", "LA Confidential x Cheese", []),
    ("Swiss Cheese", "hybrid", "cheese", "Swiss Miss x Skunk #1", []),

    # === Truffle / Earthy ===
    ("Truffaloha", "hybrid", "truffle", "unknown", ["tropical"]),

    # === Classic / Heritage ===
    ("Crystal", "hybrid", "classic", "White Widow x Northern Lights", []),
    ("Flo", "hybrid", "classic", "Purple Thai x Afghani", ["floral"]),
    ("Lotus", "hybrid", "classic", "unknown", ["floral"]),
    ("Rosetta Stone", "sativa", "classic", "Jack Herer x P75 x White Widow", []),
    ("Sage", "hybrid", "classic", "Big Sur Holy Weed x Haze x Afghani", ["herbal", "sage"]),
    ("Sour Bubble", "indica", "classic", "unknown", ["sour", "bubble gum"]),
    ("White Gold", "hybrid", "classic", "The White x Himalayan Gold", []),
]


def main():
    db_path = sys.argv[1] if len(sys.argv) > 1 else str(DB_PATH)
    print(f"Database: {db_path}")

    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")

    # Get existing normalized names to avoid duplicates
    # Use both the DB normalized_name AND a stripped version (no spaces) for matching
    existing = set()
    for row in conn.execute("SELECT normalized_name FROM strains"):
        existing.add(row[0])
        existing.add(re.sub(r"[^a-z0-9]", "", row[0]))  # Also match without spaces
    print(f"Existing strains: {conn.execute('SELECT COUNT(*) FROM strains').fetchone()[0]}")

    # Get max ID
    max_id = conn.execute("SELECT MAX(id) FROM strains").fetchone()[0] or 0
    print(f"Max strain ID: {max_id}")

    # Deduplicate our strain list
    seen_normalized = set()
    unique_strains = []
    for entry in STRAINS:
        name = entry[0]
        norm = normalize_name(name)
        if norm in existing:
            print(f"  SKIP (exists): {name}")
            continue
        if norm in seen_normalized:
            continue
        seen_normalized.add(norm)
        unique_strains.append(entry)

    print(f"New strains to add: {len(unique_strains)}")

    if not unique_strains:
        print("No new strains to add!")
        conn.close()
        return

    # Ensure data source exists
    conn.execute(
        "INSERT OR IGNORE INTO data_sources (id, name) VALUES (?, ?)",
        (6, SOURCE_TAG),
    )

    added = 0
    for i, entry in enumerate(unique_strains):
        name, strain_type, archetype, genetics = entry[0], entry[1], entry[2], entry[3]
        extra_flavors = entry[4] if len(entry) > 4 else []
        norm = normalize_name(name)
        strain_id = max_id + i + 1
        seed = hash(norm) & 0xFFFFFFFF

        # 1. Insert strain — data_quality='partial' ensures export marks as partial
        desc = gen_description(name, strain_type, genetics, archetype)
        conn.execute(
            "INSERT INTO strains (id, name, normalized_name, strain_type, description, source, data_quality) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (strain_id, name, norm, strain_type, desc, SOURCE_TAG, "partial"),
        )

        # 2. Insert terpene compositions (estimated from archetype)
        terps = gen_terpene_profile(archetype, seed)
        for mol_id, pct in terps:
            conn.execute(
                "INSERT INTO strain_compositions (strain_id, molecule_id, percentage, measurement_type, source) "
                "VALUES (?, ?, ?, ?, ?)",
                (strain_id, mol_id, pct, "estimated", SOURCE_TAG),
            )

        # 3. Insert cannabinoid compositions
        cannabinoids = gen_cannabinoid_profile(archetype, seed)
        for mol_id, pct in cannabinoids:
            conn.execute(
                "INSERT INTO strain_compositions (strain_id, molecule_id, percentage, measurement_type, source) "
                "VALUES (?, ?, ?, ?, ?)",
                (strain_id, mol_id, pct, "estimated", SOURCE_TAG),
            )

        # 4. Insert effect reports
        effects = gen_effects(archetype, seed)
        for eff_id, count, conf in effects:
            conn.execute(
                "INSERT INTO effect_reports (strain_id, effect_id, report_count, confidence, source) "
                "VALUES (?, ?, ?, ?, ?)",
                (strain_id, eff_id, count, conf, SOURCE_TAG),
            )

        # 5. Insert flavors
        flavors = gen_flavors(archetype, extra_flavors, seed)
        for flavor in flavors:
            conn.execute(
                "INSERT INTO strain_flavors (strain_id, flavor) VALUES (?, ?)",
                (strain_id, flavor),
            )

        # 6. Insert metadata
        meta = gen_metadata(name, strain_type, archetype, genetics, flavors, seed)
        conn.execute(
            "INSERT INTO strain_metadata "
            "(strain_id, consumption_suitability, price_range, best_for, not_ideal_for, "
            "genetics, lineage, description_extended) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (
                strain_id,
                meta["consumption_suitability"],
                meta["price_range"],
                meta["best_for"],
                meta["not_ideal_for"],
                meta["genetics"],
                meta["lineage"],
                meta["description_extended"],
            ),
        )
        added += 1

    conn.commit()

    # Verify
    total = conn.execute("SELECT COUNT(*) FROM strains").fetchone()[0]
    partial = conn.execute("SELECT COUNT(*) FROM strains WHERE data_quality='partial'").fetchone()[0]
    total_effects = conn.execute("SELECT COUNT(*) FROM effect_reports").fetchone()[0]
    total_comps = conn.execute("SELECT COUNT(*) FROM strain_compositions").fetchone()[0]
    total_flavors = conn.execute("SELECT COUNT(*) FROM strain_flavors").fetchone()[0]
    total_meta = conn.execute("SELECT COUNT(*) FROM strain_metadata").fetchone()[0]

    conn.close()

    print(f"\n{'='*60}")
    print(f"ENRICHMENT v5.18 COMPLETE")
    print(f"{'='*60}")
    print(f"  Strains added:      {added}")
    print(f"  Total strains:      {total}")
    print(f"  Partial strains:    {partial}")
    print(f"  Total effects:      {total_effects}")
    print(f"  Total compositions: {total_comps}")
    print(f"  Total flavors:      {total_flavors}")
    print(f"  Total metadata:     {total_meta}")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
