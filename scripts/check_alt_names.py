#!/usr/bin/env python3
"""Check for alternate-name duplicates before adding new strains."""
import sqlite3
from pathlib import Path

DB = Path(__file__).resolve().parent.parent / "data" / "processed" / "cannalchemy.db"
conn = sqlite3.connect(str(DB))
c = conn.cursor()

checks = [
    ("Gorilla Glue", "GG4"), ("Dosidos", "Do-Si-Dos"), ("Sherbet", "Sunset Sherbet"),
    ("Skywalker OG", "Skywalker"), ("Super Lemon Haze", "Super Lemon"),
    ("Super Silver Haze", "Super Silver"), ("Skittlez", "Zkittlez"),
    ("Dolato", "Do-La-To"), ("Gelato 33", "Gelato"), ("Gelato 41", "Gelato"),
    ("Charlottes Web", "Charlotte"), ("Afghani", "Afghan"), ("Cheese", "UK Cheese"),
    ("Lambs Bread", "Lamb Bread"), ("Motorbreath", "Motor Breath"),
    ("Dosidos", "Do Si Dos"), ("Ringos Gift", "Ringo Gift"),
    ("Gods Gift", "God Gift"), ("Nevilles Haze", "Neville Haze"),
    ("NYC Sour Diesel", "NYCSD"), ("OG 18", "OG #18"),
    ("Animal Cookies", "Animal Cookie"), ("Sherblato", "Sherb"),
    ("Tropical Zkittlez", "Tropical Skittles"), ("Sour Patch Kids", "Sour Patch"),
    ("Purple Trainwreck", "Purple Train"), ("Lemon Cherry Gelato", "LCG"),
    ("Collins Ave", "Collins Avenue"), ("Honey Bun", "Honeybun"),
    ("Red Congolese", "Congolese"), ("Mag Landrace", "Mag Land"),
]

for name, alt in checks:
    rows = c.execute(
        "SELECT id, name FROM strains WHERE LOWER(name) LIKE ? OR LOWER(name) LIKE ?",
        ("%" + alt.lower() + "%", "%" + name.lower() + "%"),
    ).fetchall()
    if rows:
        print(f"  {name} / {alt}: {rows}")

conn.close()
