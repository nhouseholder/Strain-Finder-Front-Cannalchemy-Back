#!/usr/bin/env python3
"""Identify popular strains not yet in the database — expanded search."""
import sqlite3
from pathlib import Path

DB = Path(__file__).resolve().parent.parent / "data" / "processed" / "cannalchemy.db"
db = sqlite3.connect(str(DB))
c = db.cursor()
existing = set(row[0].lower() for row in c.execute("SELECT name FROM strains"))
# Also check normalized_name for matching
existing_norm = set(row[0].lower() for row in c.execute("SELECT normalized_name FROM strains") if row[0])
db.close()

candidates = [
    # Cannabis Cup winners / notable award winners
    "Motorbreath", "Kush Mints", "Grandi Guava", "Grape Cream Cake",
    "Dolato", "Dosidos", "Do-Si-Dos", "Oreoz", "Alien OG",
    "Animal Cookies", "Trophy Wife", "Ice Cream Cake", "Banana Cream",
    "Pineapple Express", "Strawberry Cough", "OG Kush",

    # 2024-2026 trending on menus
    "Gelonade", "Zerbert", "Zaza", "Zlushiez", "Bacio",
    "Cheetah Piss", "Jokerz", "Italian Ice", "Lemon Cherry Gelato",
    "Grapefruit Diesel", "White Cherry Gelato", "Sherblato",
    "Pancakes", "French Toast", "Waffles",
    "Horchata", "Khalifa Kush", "Tigers Blood", "Tropicana Cookies",
    "Velvet Glove", "Mochi", "Mochi Gelato", "Berry Gelato",
    "Grape Ape", "Purple Punch", "Zkittlez", "Gelato 33", "Gelato 41",

    # Classic / heritage strains still popular
    "AK-47", "Afghani", "Afghan Kush", "Acapulco Gold",
    "Bruce Banner", "Blue Cheese", "Bubba Kush", "Cheese",
    "Chemdawg", "Durban Poison", "G13", "Girl Scout Cookies",
    "Gods Gift", "Granddaddy Purple",
    "Green Crack", "Headband", "Hindu Kush", "Jack Herer",
    "LA Confidential", "Maui Wowie",  "Northern Lights",
    "Purple Haze", "Skywalker OG", "Sour Diesel", "Super Lemon Haze",
    "Super Silver Haze", "Tangerine Dream", "Trainwreck", "White Widow",

    # Cookies Fam / connected
    "Collins Ave", "Cheetah Piss", "Gary Payton",
    "Grenadine", "Honey Bun", "Lemonnade", "Cafe Racer",
    "Powdered Donuts", "Snow Man", "The Menthol",

    # Seed Junky / Compound / notable breeders
    "Wedding Cake", "Sunset Sherbet", "Thin Mint Cookies", "Cherry Pie",
    "Animal Face", "Kush Cake", "Layer Cake", "Triangle Mints",
    "Grapes and Cream", "Grape Gas", "Jealousy",
    "Permanent Marker",

    # Popular indica-dominants
    "9 Pound Hammer", "Blackberry Kush", "Death Star", "Fat Banana",
    "Forbidden Fruit", "GG4", "Gorilla Glue 4", "Gorilla Glue",
    "Godfather OG", "Grand Hindu", "Grateful Breath",
    "In The Pines", "King Louis XIII", "King Louis",
    "Kosher Kush", "MK Ultra", "Master Kush", "Mendo Breath",
    "Ogre", "Peyote Critical", "Presidential OG", "Purple Kush",
    "SFV OG", "Sensi Star", "Sherbet", "Sunset Gelato",

    # Popular sativa-dominants
    "Agent Orange", "Amnesia Haze", "Chocolope", "Clementine",
    "Cinderella 99", "Congo", "Dancehall",
    "Durban", "East Coast Sour Diesel", "Golden Ticket",
    "Harlequin", "Island Sweet Skunk", "J1", "Jillybean",
    "Lambs Bread", "Lemon Skunk", "Malawi",
    "Moby Dick", "Nevilles Haze", "NYC Diesel",
    "Panama Red", "Power Plant", "Red Congolese",
    "Sage N Sour", "Sour Jack", "Sour Tangie",
    "Super Jack", "Tangilope", "Voodoo",
    "Willie Nelson", "XJ-13",

    # Popular hybrids
    "Banana Kush", "Birthday Cake", "Blue Dream",
    "Blueberry Diesel", "Cherry AK-47", "Cherry Diesel",
    "Cookies and Cream", "Critical Mass", "Frostbite",
    "Gorilla Cookies", "Grape Stomper", "Gummy Bears",
    "Headbanger", "Key Lime Pie", "Lemon Diesel",
    "Lifter", "Mag Landrace", "Mimosa",
    "NYC Sour Diesel", "OG 18", "Pineapple Kush",
    "Purple Trainwreck", "Royal Gorilla", "Runtz",
    "Sherbert", "Skittlez", "Slurpee",
    "Sour Patch Kids", "Strawberry Banana", "Tangie",
    "The White", "Tropical Zkittlez", "Truffle Butter",
    "Wedding Crasher", "White Fire OG", "WiFi OG",

    # CBD/balanced/medical
    "ACDC", "Cannatonic", "Charlottes Web",
    "Harle-Tsu", "Pennywise", "Ringos Gift",
    "Sweet and Sour Widow", "Valentine X",

    # Additional trending 2025-2026
    "Apple Fritter", "Backpack Boyz", "Black Cherry Punch",
    "Cherry Punch", "Gak Smoovie", "Gello Gelato",
    "Gooberry", "Grape Runtz", "Guava Gelato",
    "Hawaiian Ice", "Ice Cream Bean", "Jealousy 1",
    "Jelly Rancher", "Kool Whip", "Lemon Haze",
    "London Jelly", "Marshmallow OG", "Miracle Alien Cookies",
    "Peach Oz", "Pink Certz", "Pixy Stix",
    "Pluto", "Pop Rocks", "Purple Ice Water",
    "Rainbow Chip", "Scotty 2 Hotty", "Soulja",
    "Spritzer", "Stardawg", "Sugar Cane",
    "Super Boof", "Tartpop", "The Soap",
    "Tropic Thunder", "Watermelon Gelato",
    "White Cherry Truffle", "Y Life", "Zushi",
]

# Normalize and deduplicate candidates
seen = set()
unique = []
for s in candidates:
    key = s.lower().strip()
    if key not in seen:
        seen.add(key)
        unique.append(s)

import re
def normalize(name):
    return re.sub(r'[^a-z0-9]', ' ', name.lower()).strip()

missing = []
for s in unique:
    low = s.lower()
    norm = normalize(s)
    if low not in existing and norm not in existing_norm:
        missing.append(s)

missing.sort()
print(f"Missing from DB: {len(missing)} of {len(unique)} candidate strains")
for s in missing:
    print(f"  {s}")
