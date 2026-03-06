#!/usr/bin/env python3
"""Identify popular strains not yet in the database."""
import sqlite3
from pathlib import Path

DB = Path(__file__).resolve().parent.parent / "data" / "processed" / "cannalchemy.db"
db = sqlite3.connect(str(DB))
c = db.cursor()
existing = set(row[0].lower() for row in c.execute("SELECT name FROM strains"))
db.close()

popular = [
    # Trending 2024-2026
    "Gary Payton", "Permanent Marker", "Jealousy", "RS11", "Gush Mints",
    "Grape Gasoline", "Rainbow Belts", "Bacio Gelato", "Apples and Bananas",
    "Blueberry Muffin", "Modified Grapes", "Frozen Grapes", "Ice Cream Mintz",
    "Gushers", "London Pound Cake", "Cereal Milk", "Dirty Sprite",
    "Cap Junky", "Grape Pie", "Georgia Pie", "Pineapple Fanta",
    "Slurricane", "Grease Monkey", "Zoap", "Gastro Pop",
    "Biscotti", "Gumbo", "Cherry Garcia",
    "Donny Burger", "Black Mamba", "White Truffle", "Papaya Cake",
    "Guava", "Papaya", "Jack Frost", "Mango Haze",
    "Black Runtz", "Pink Runtz", "White Runtz", "Obama Runtz",
    "Peach Ringz", "Project 4516", "Grandi Guava",
    "Alien Labs Baklava", "Gassy Taffy",
    "Lemon Grab", "Apple Tartz", "Colombian Haze", "Hawaiian Punch",
    "Tangelo", "Melonade", "Lemon Tree", "Fire OG",
    "Bubba Fett", "Jesus OG", "White Gold",
    "Snow Cap", "Citrus Sap", "Motorbreath", "GMO Cookies",
    "Face Off OG", "Triangle Kush", "Animal Mints", "Biker Kush",
    "Candy Chrome", "Candy Rain", "Crazy Glue",
    "Crystal", "Dragon Breath", "Dream Catcher",
    "Gator Breath", "Hawaiian Cookies",
    "Honey Badger", "Kandyland",
    "LA Pop Rocks", "Laughing Buddha", "Lime Sorbet", "Lucky Charms",
    "Magic Melon", "Mandarin Cookies", "Miracle Whip",
    "Moonshine Haze", "Mothers Milk", "Night Terror OG",
    "Peach Crescendo", "Pink Lemonade", "Platinum Huckleberry Cookies",
    "Purple Lemonade", "Purple Marmalade", "Rosetta Stone",
    "Sage", "Slap N Tickle", "Snow Monkey",
    "Solar Flare", "Sour Bubble", "Star Dawg", "Strawberry Fields",
    "Strawberry Lemonade", "Sugar Black Rose", "Sundae Driver", "Sunset Mac",
    "Super Lemon OG", "Sweet Diesel", "Sweet Tea", "Swiss Cheese",
    "Tangie Ghost Train", "The Truth", "Tres Leches",
    "Truffaloha", "Washington Apple", "Watermelon Z",
    "Willy Wonka", "Zero Gravity",
    "Atomic Apple", "Bahama Mama", "Banana Punch",
    "Blueberry Cookies", "Candy Jack",
    "Cherry Chem", "Cream Pie", "Critical Kush",
    "Dark Star", "Diamond OG",
    "Dutch Treat Haze", "Electric Lemonade", "Flo", "Gas Face",
    "Golden Goat", "Grape Diamonds", "Grapefruit Haze",
    "Green Gelato", "Hawaiian Haze",
    "Island Diesel", "Kush Cake", "LA Cheese", "Lava Cake",
    "Lemon Meringue", "Lemon Pound Cake", "Lotus", "MAC 1",
    "Mandarin Dream", "Mango Tango", "Marathon OG", "Moonbow",
    "Northern Haze", "Peanut Butter Cups", "Pink Champagne", "Pink Cookies",
    "Raspberry Gelato",
    "Red Velvet", "Sour Tangie", "Space Cake", "Strawberry Amnesia", "Strawberry Shortcake",
    "Strawnana", "Sugar Cone", "Sunset Octane",
    "The Soap", "Tropicali", "Valencia",
    "Vanilla Frosting", "Watermelon Mimosa", "Wonka Bars", "Zkittlez Cake",
]

missing = sorted(set(s for s in popular if s.lower() not in existing))
print(f"Missing from DB: {len(missing)} of {len(set(popular))} popular strains")
for s in missing:
    print(f"  {s}")
