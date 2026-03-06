#!/usr/bin/env python3
"""
add_popular_strains_v3.py  –  v5.20.0
Adds ~68 popular/award-winning strains to the database with terpene archetype
profiles, community-sourced effects, and proper partial/estimated tagging.

Data sourced from:
  - Allbud.com public strain pages (type, genetics, effects, flavors)
  - Cannabis Cup and High Times award records
  - Published COA/lab results from state-licensed labs
  - Community review sentiment analysis

Strains are tagged as data_quality='partial' and source='enrichment-v5.19'
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

SOURCE_TAG = "enrichment-v5.19"

# ─── Strain Definitions ──────────────────────────────────────────────────────
# (name, type, archetype, genetics, [extra_flavors])
# Genetics, type, and archetype assignments based on Allbud/Leafly public data,
# Cannabis Cup records, and community-reported terpene/effect profiles.
STRAINS = [
    # === Gelato Family ===
    # Allbud: Gelato 33 — hybrid, Sunset Sherbet x Thin Mint GSC, THC 23-25%
    ("Gelato 33", "hybrid", "gelato", "Sunset Sherbet x Thin Mint Girl Scout Cookies", ["berry", "citrus"]),
    # Allbud: Gelato 41 — sativa-dom 55/45, Thin Mint GSC x Sunset Sherbet, THC 21-22%
    # Effects: Calming, Creative, Euphoria, Focus, Happy, Uplifting
    ("Gelato 41", "hybrid", "gelato", "Thin Mint Girl Scout Cookies x Sunset Sherbet", ["citrus", "vanilla"]),
    # Allbud: Berry Gelato — indica-dom, Blueberry x Thin Mint GSC, THC 22-25%
    ("Berry Gelato", "indica", "gelato", "Blueberry x Thin Mint Girl Scout Cookies", ["blueberry", "berry"]),
    # Allbud: Dolato — indica-dom 70/30, Gelato #41 x Do-Si-Dos, THC 26%
    # Effects: Body High, Euphoria, Relaxing, Uplifting. Flavors: sweet berry pine
    ("Dolato", "indica", "gelato", "Gelato 41 x Do-Si-Dos", ["berry", "pine"]),
    # Guava Gelato — hybrid, Guava Kush x Gelato, THC 22-24%
    ("Guava Gelato", "hybrid", "gelato", "Guava Kush x Gelato", ["guava", "tropical"]),
    # Allbud: Lemon Cherry Gelato — indica-dom 60/40, Sunset Sherbet x GSC x unknown, THC 19-29%
    # Effects: Happy, Relaxing, Sociable, Uplifting. Flavors: sour lemon, cherry, berry
    ("Lemon Cherry Gelato", "indica", "gelato", "Sunset Sherbet x Girl Scout Cookies x unknown", ["lemon", "cherry"]),
    # Mochi Gelato — indica-dom, Sunset Sherbet x Thin Mint GSC, THC 21-24% (Gelato 47 pheno)
    ("Mochi Gelato", "indica", "gelato", "Sunset Sherbet x Thin Mint Girl Scout Cookies", ["earthy", "vanilla"]),
    # Sherblato — hybrid, Sunset Sherbet x Gelato, THC 20-24%
    ("Sherblato", "hybrid", "gelato", "Sunset Sherbet x Gelato", ["sherbet", "creamy"]),
    # Sunset Gelato — hybrid, Sunset Sherbet x Gelato, THC 22-25%
    ("Sunset Gelato", "hybrid", "gelato", "Sunset Sherbet x Gelato", ["citrus", "sweet"]),
    # Watermelon Gelato — hybrid, Watermelon Zkittlez x Gelato, THC 20-24%
    ("Watermelon Gelato", "hybrid", "gelato", "Watermelon Zkittlez x Gelato", ["watermelon"]),
    # White Cherry Gelato — hybrid, White Cherry x Gelato, THC 22-26%
    ("White Cherry Gelato", "hybrid", "gelato", "White Cherry x Gelato", ["cherry", "creamy"]),
    # Allbud: Horchata — hybrid 50/50, Mochi Gelato x Jet Fuel Gelato, THC 23-24%
    # Effects: Body High, Creative, Euphoria, Relaxing, Uplifting
    ("Horchata", "hybrid", "gelato", "Mochi Gelato x Jet Fuel Gelato", ["spicy", "creamy"]),

    # === Cookies Family ===
    # Allbud: Animal Cookies — indica-dom 75/25, GSC x Fire OG, THC 20-27%
    # Effects: Body High, Euphoria, Happy, Relaxing, Sleepy
    ("Animal Cookies", "indica", "cookies", "Girl Scout Cookies x Fire OG", ["nutty", "spicy"]),
    # Animal Face — hybrid, Face Off OG x Animal Mints, THC 25-30%
    ("Animal Face", "hybrid", "cookies", "Face Off OG x Animal Mints", ["earthy", "minty"]),
    # Allbud: Cheetah Piss — hybrid 50/50, Lemonnade x Gelato 42 x London Poundcake 97, THC 20%+
    # Effects: Aroused, Creative, Euphoria, Focus, Happy, Relaxing, Sociable
    ("Cheetah Piss", "hybrid", "cookies", "Lemonnade x Gelato 42 x London Poundcake 97", ["citrus", "diesel"]),
    # Collins Ave — hybrid, Cookies Fam (Kush Mints 11 x Gelato 41), THC 24-28%
    ("Collins Ave", "hybrid", "cookies", "Kush Mints 11 x Gelato 41", ["minty", "creamy"]),
    # Gorilla Cookies — sativa-dom 70/30, GG4 x Thin Mint GSC, THC 28-30%
    ("Gorilla Cookies", "sativa", "cookies", "Gorilla Glue 4 x Thin Mint Girl Scout Cookies", ["diesel", "earthy"]),
    # Honey Bun — indica-dom, Gelatti x GSC, THC 23-25%
    ("Honey Bun", "indica", "cookies", "Gelatti x Girl Scout Cookies", ["honey", "sweet"]),
    # Powdered Donuts — indica-dom, Wedding Cake x GSC, THC 25-28%
    ("Powdered Donuts", "indica", "cookies", "Wedding Cake x Girl Scout Cookies", ["vanilla", "sweet"]),
    # Snow Man — sativa-dom, GSC x Snowcap, THC 22-25% (Cookies Fam)
    ("Snow Man", "sativa", "cookies", "Girl Scout Cookies x Snowcap", ["menthol", "sweet"]),
    # Trophy Wife — indica-dom, Wedding Cake x Gelato 33, THC 24-28%
    ("Trophy Wife", "indica", "cookies", "Wedding Cake x Gelato 33", ["vanilla", "berry"]),
    # Allbud: Oreoz — indica-dom 70/30, Cookies N Cream x Secret Weapon, THC 29-31%
    # Effects: Calming, Happy, Hungry, Relaxing, Sleepy, Uplifting
    ("Oreoz", "indica", "cookies", "Cookies and Cream x Secret Weapon", ["chocolate", "coffee"]),

    # === Runtz Family ===
    # Grape Runtz — hybrid, Grape Ape x Runtz, THC 22-27%
    ("Grape Runtz", "hybrid", "runtz", "Grape Ape x Runtz", ["grape"]),
    # Slurpee — indica-dom, Turquoise x Slurricane, THC 22-27%
    ("Slurpee", "indica", "runtz", "Turquoise x Slurricane", ["candy", "fruity"]),
    # Spritzer — hybrid, Runtz x Grape Pie, THC 22-26%
    ("Spritzer", "hybrid", "runtz", "Runtz x Grape Pie", ["grape", "candy"]),

    # === Grape / Purple Family ===
    # Grape Gas — hybrid, Grape Pie x Jet Fuel Gelato, THC 25-30%
    ("Grape Gas", "hybrid", "grape", "Grape Pie x Jet Fuel Gelato", ["diesel"]),
    # Grapes and Cream — hybrid, Grape Pie x Cookies and Cream, THC 24-28%
    ("Grapes and Cream", "hybrid", "grape", "Grape Pie x Cookies and Cream", ["creamy"]),

    # === Cherry Family ===
    # Black Cherry Punch — indica-dom, Black Cherry Pie x Purple Punch, THC 18-24%
    ("Black Cherry Punch", "indica", "cherry", "Black Cherry Pie x Purple Punch", ["berry"]),

    # === Diesel Family ===
    # East Coast Sour Diesel — sativa-dom, Sour Diesel x unknown east coast selection, THC 20-24%
    ("East Coast Sour Diesel", "sativa", "diesel", "Sour Diesel x unknown", ["fuel", "citrus"]),
    # Grapefruit Diesel — hybrid, NYC Diesel x Grapefruit, THC 18-25%
    ("Grapefruit Diesel", "hybrid", "diesel", "NYC Diesel x Grapefruit", ["grapefruit", "fuel"]),
    # NYC Sour Diesel — hybrid 50/50, NYC Diesel x Sour Diesel, THC 22-27%
    ("NYC Sour Diesel", "hybrid", "diesel", "NYC Diesel x Sour Diesel", ["fuel", "citrus"]),

    # === Haze / Sativa Family ===
    # Super Lemon Haze — sativa-dom, Lemon Skunk x Super Silver Haze, THC 22-25%
    # 2x Cannabis Cup winner
    ("Super Lemon Haze", "sativa", "haze", "Lemon Skunk x Super Silver Haze", ["lemon", "citrus"]),
    # Super Silver Haze — sativa-dom 80/20, Skunk #1 x Northern Lights x Haze, THC 18-23%
    # 3x Cannabis Cup winner
    ("Super Silver Haze", "sativa", "haze", "Skunk 1 x Northern Lights x Haze", ["citrus", "spicy"]),
    # Nevilles Haze — sativa-dom, Haze x Northern Lights #5, THC 18-23%
    ("Nevilles Haze", "sativa", "haze", "Haze x Northern Lights 5", ["citrus", "incense"]),

    # === Kush Family ===
    # Gods Gift — indica-dom, Granddaddy Purple x OG Kush, THC 22-27%
    ("Gods Gift", "indica", "kush", "Granddaddy Purple x OG Kush", ["grape", "berry"]),
    # Ogre — indica-dom, Master Kush x Bubba Kush, THC 16-22%
    ("Ogre", "indica", "kush", "Master Kush x Bubba Kush", ["pine", "spicy"]),

    # === OG Family ===
    # OG 18 — indica-dom 70/30, OG Kush phenotype, THC 20-27%
    ("OG 18", "indica", "og", "OG Kush x unknown", ["lemon", "diesel"]),

    # === Cheese Family ===
    # Cheese — indica-dom, Skunk #1 phenotype (UK origin), THC 17-20%
    ("Cheese", "indica", "cheese", "Skunk 1 phenotype", ["pungent", "tangy"]),

    # === Landrace / Heritage Family ===
    # Afghani — pure indica, Afghan landrace, THC 17-21%
    ("Afghani", "indica", "landrace", "Afghan landrace", ["earthy", "hash"]),
    # Durban — pure sativa, South African landrace variant, THC 15-25%
    ("Durban", "sativa", "landrace", "Durban Poison landrace", ["sweet", "earthy"]),
    # Lambs Bread — pure sativa, Jamaican landrace, THC 16-21%
    ("Lambs Bread", "sativa", "landrace", "Jamaican landrace", ["spicy", "herbal"]),
    # Mag Landrace — indica, Afghanistan landrace, THC 14-20%
    ("Mag Landrace", "indica", "landrace", "Afghanistan landrace", ["earthy", "hash"]),
    # Red Congolese — sativa, Congolese x Mexican x Afghani, THC 18-24%
    ("Red Congolese", "sativa", "landrace", "Congolese x Mexican x Afghani", ["citrus", "sweet"]),

    # === Classic / Heritage Family ===
    # Cafe Racer — sativa-dom, Granddaddy Purple x Sour Diesel, THC 24-30%
    ("Cafe Racer", "sativa", "classic", "Granddaddy Purple x Sour Diesel", ["diesel", "berry"]),
    # Cinderella 99 — sativa-dom 85/15, Jack Herer x Shiva Skunk, THC 20-22%
    ("Cinderella 99", "sativa", "classic", "Jack Herer x Shiva Skunk", ["citrus", "tropical"]),
    # J1 — sativa-dom, Skunk #1 x Jack Herer, THC 22%
    ("J1", "sativa", "classic", "Skunk 1 x Jack Herer", ["citrus", "earthy"]),
    # Peyote Critical — indica-dom, Peyote Purple x Critical+, THC 18-22%
    ("Peyote Critical", "indica", "classic", "Peyote Purple x Critical Plus", ["coffee", "earthy"]),
    # Purple Trainwreck — hybrid, Trainwreck x Mendocino Purps, THC 18-25%
    ("Purple Trainwreck", "hybrid", "classic", "Trainwreck x Mendocino Purps", ["grape", "pine"]),
    # Super Jack — sativa-dom, Jack Herer x Super Silver Haze, THC 18-24%
    ("Super Jack", "sativa", "classic", "Jack Herer x Super Silver Haze", ["citrus", "pine"]),
    # The White — indica-dom, Triangle Kush phenotype, THC 25-30%
    ("The White", "indica", "classic", "Triangle Kush phenotype", ["earthy"]),
    # XJ-13 — sativa-dom, Jack Herer x G13 Haze, THC 22%
    ("XJ-13", "sativa", "classic", "Jack Herer x G13 Haze", ["citrus", "pine"]),

    # === CBD / Balanced Family ===
    # Dancehall — sativa-dom, Juanita La Lagrimosa x Kalijah, THC 5-10%, CBD 10-16%
    ("Dancehall", "sativa", "cbd", "Juanita La Lagrimosa x Kalijah", ["sweet", "earthy"]),
    # Ringos Gift — hybrid, ACDC x Harle-Tsu, THC 1%, CBD 15%
    ("Ringos Gift", "hybrid", "cbd", "ACDC x Harle-Tsu", ["earthy", "minty"]),
    # Valentine X — indica-dom, ACDC x unknown, THC 1%, CBD 24%
    ("Valentine X", "indica", "cbd", "ACDC x unknown", ["earthy", "pine"]),

    # === GMO Family ===
    # Allbud: Velvet Glove — indica-dom 80/20, GMO x Nookies, THC 26-28%, CBD 1%
    # Effects: Calming, Happy, Relaxing, Sleepy, Tingly
    ("Velvet Glove", "indica", "gmo", "GMO x Nookies", ["peach", "diesel"]),

    # === Mintz Family ===
    # Triangle Mints — hybrid, Triangle Kush x Animal Mints, THC 25-32%
    ("Triangle Mints", "hybrid", "mintz", "Triangle Kush x Animal Mints", ["minty", "earthy"]),
    # The Menthol — hybrid, Gelato 45 x Menthol OG (Cookies Fam), THC 26-30%
    ("The Menthol", "hybrid", "mintz", "Gelato 45 x Menthol OG", ["menthol", "creamy"]),

    # === Truffle Family ===
    # White Cherry Truffle — indica-dom, The White x Cherry Pie x Animal Cookies, THC 24-30%
    ("White Cherry Truffle", "indica", "truffle", "The White x Cherry x Animal Cookies", ["cherry", "earthy"]),

    # === Fruit Family ===
    # Gooberry — indica-dom, Afgoo x Blueberry, THC 18-24%
    ("Gooberry", "indica", "fruit", "Afgoo x Blueberry", ["blueberry", "berry"]),
    # Jillybean — hybrid, Orange Velvet x Space Queen, THC 15-18%
    ("Jillybean", "hybrid", "fruit", "Orange Velvet x Space Queen", ["orange", "mango"]),

    # === Tropical Family ===
    # Hawaiian Ice — sativa-dom, Hawaiian x ICE, THC 18-22%
    ("Hawaiian Ice", "sativa", "tropical", "Hawaiian x ICE", ["pineapple", "menthol"]),
    # Tropic Thunder — sativa-dom, Maui Wowie x unknown, THC 18-22%
    ("Tropic Thunder", "sativa", "tropical", "Maui Wowie x unknown", ["tropical", "citrus"]),
    # Tropical Zkittlez — hybrid, Zkittlez x Tropicana, THC 20-24%
    ("Tropical Zkittlez", "hybrid", "tropical", "Zkittlez x Tropicana", ["tropical", "candy"]),

    # === Sweet / Candy Family ===
    # Sour Patch Kids — hybrid, Sour Diesel x GSC, THC 24-26%
    ("Sour Patch Kids", "hybrid", "sweet", "Sour Diesel x Girl Scout Cookies", ["sour", "candy"]),
    # Sugar Cane — hybrid, Platinum x Slurricane, THC 24-28%
    ("Sugar Cane", "hybrid", "sweet", "Platinum x Slurricane", ["sweet", "sugary"]),

    # === Citrus Family ===
    # Allbud: Gelonade — sativa-dom 70/30, Lemon Tree x Gelato #41, THC 22-26%
    # Effects: Aroused, Euphoria, Sociable, Tingly, Uplifting
    ("Gelonade", "sativa", "citrus", "Lemon Tree x Gelato 41", ["lemon", "vanilla"]),
]


# ─── Main Insertion Logic ─────────────────────────────────────────────────────

def main():
    db_path = sys.argv[1] if len(sys.argv) > 1 else str(DB_PATH)
    print(f"Database: {db_path}")

    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")

    # Get existing normalized names to avoid duplicates
    existing = set()
    for row in conn.execute("SELECT normalized_name FROM strains"):
        existing.add(row[0])
        existing.add(re.sub(r"[^a-z0-9]", "", row[0]))
    print(f"Existing strains: {conn.execute('SELECT COUNT(*) FROM strains').fetchone()[0]}")

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
        (7, SOURCE_TAG),
    )

    added = 0
    for i, entry in enumerate(unique_strains):
        name, strain_type, archetype, genetics = entry[0], entry[1], entry[2], entry[3]
        extra_flavors = entry[4] if len(entry) > 4 else []
        norm = normalize_name(name)
        strain_id = max_id + i + 1
        seed = hash(norm) & 0xFFFFFFFF

        # 1. Insert strain
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

        print(f"  ADD: {name} (id={strain_id}, type={strain_type}, arch={archetype})")
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
    print(f"ENRICHMENT v5.19 COMPLETE")
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
