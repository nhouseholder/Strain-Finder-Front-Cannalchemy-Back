#!/usr/bin/env python3
"""
Batch 2: Enrich remaining 271 strains with lineage data.
Many are niche breeder selections — we infer parentage from strain names and
known breeder documentation where available.

Run:  python3 scripts/enrich_lineage_batch2.py
"""
import sqlite3, json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB = ROOT / "data" / "processed" / "cannalchemy.db"

LINEAGE = {
    # ── A ──
    "Aca-Dos Delight": {
        "genetics": "Unknown Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Ajo Blanco": {
        "genetics": "Unknown Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Amaretto Tarmac": {
        "genetics": "Amaretto × Unknown",
        "parents": ["Amaretto", "Unknown"],
        "grandparents": {},
    },
    "Another Level  - Happy Valley Genetics": {
        "genetics": "Unknown Hybrid (Happy Valley Genetics)",
        "parents": ["Unknown"],
        "grandparents": {},
    },

    # ── B ──
    "Baller's Game  - Happy Valley Genetics": {
        "genetics": "Unknown Hybrid (Happy Valley Genetics)",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Big Head Confidential": {
        "genetics": "LA Confidential × Unknown",
        "parents": ["LA Confidential", "Unknown"],
        "grandparents": {"LA Confidential": ["OG LA Affie", "Afghan"]},
    },
    "Bitter Orange": {
        "genetics": "Orange Bud × Unknown",
        "parents": ["Orange Bud", "Unknown"],
        "grandparents": {},
    },
    "Black Toffee": {
        "genetics": "Unknown Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Blue Fruit": {
        "genetics": "Blueberry × Unknown Fruit",
        "parents": ["Blueberry", "Unknown"],
        "grandparents": {"Blueberry": ["Purple Thai", "Thai"]},
    },
    "Blueberry Squirt": {
        "genetics": "Blueberry × Unknown",
        "parents": ["Blueberry", "Unknown"],
        "grandparents": {"Blueberry": ["Purple Thai", "Thai"]},
    },
    "Blueberry x Big Bud": {
        "genetics": "Blueberry × Big Bud",
        "parents": ["Blueberry", "Big Bud"],
        "grandparents": {"Blueberry": ["Purple Thai", "Thai"], "Big Bud": ["Afghan", "Skunk #1", "Northern Lights"]},
    },
    "Blueberry x Big Devil": {
        "genetics": "Blueberry × Big Devil",
        "parents": ["Blueberry", "Big Devil"],
        "grandparents": {"Blueberry": ["Purple Thai", "Thai"]},
    },
    "Blueberry x Cream Cheese": {
        "genetics": "Blueberry × Cream Cheese",
        "parents": ["Blueberry", "Cream Cheese"],
        "grandparents": {"Blueberry": ["Purple Thai", "Thai"]},
    },
    "Bubble Buzz": {
        "genetics": "Bubblegum × Unknown",
        "parents": ["Bubblegum", "Unknown"],
        "grandparents": {"Bubblegum": ["Indiana Bubblegum", "Unknown"]},
    },
    "BubbleHead #13": {
        "genetics": "Bubblegum × Unknown",
        "parents": ["Bubblegum", "Unknown"],
        "grandparents": {"Bubblegum": ["Indiana Bubblegum", "Unknown"]},
    },
    "Buzzle": {
        "genetics": "Unknown Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },

    # ── C ──
    "CBD Ratio (1:30)": {
        "genetics": "Unknown High-CBD cultivar",
        "parents": ["Unknown CBD"],
        "grandparents": {},
    },
    "CBD Strawberry": {
        "genetics": "Strawberry × Unknown CBD cultivar",
        "parents": ["Strawberry", "Unknown CBD"],
        "grandparents": {},
    },
    "CBDelight": {
        "genetics": "Unknown CBD cultivar",
        "parents": ["Unknown CBD"],
        "grandparents": {},
    },
    "CBDenergy": {
        "genetics": "Unknown CBD Sativa cultivar",
        "parents": ["Unknown CBD Sativa"],
        "grandparents": {},
    },
    "Cali Critical Power": {
        "genetics": "Critical × Power Plant",
        "parents": ["Critical", "Power Plant"],
        "grandparents": {"Critical": ["Afghani", "Skunk #1"]},
    },
    "Candied Oranges": {
        "genetics": "Orange Cookies × Unknown",
        "parents": ["Orange Cookies", "Unknown"],
        "grandparents": {"Orange Cookies": ["GSC", "Orange Juice"]},
    },
    "Candy Belt": {
        "genetics": "Unknown Candy Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Candy Games #25  - Happy Valley Genetics": {
        "genetics": "Unknown Hybrid (Happy Valley Genetics)",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Candy Keit": {
        "genetics": "Candy × Unknown",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "CandyGaz": {
        "genetics": "Candy × Gas",
        "parents": ["Unknown Candy", "Unknown Gas"],
        "grandparents": {},
    },
    "Cannabis Shanti": {
        "genetics": "Unknown Landrace Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Caramba": {
        "genetics": "Unknown Spanish Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Caramel Monster": {
        "genetics": "Caramel × Unknown",
        "parents": ["Caramel", "Unknown"],
        "grandparents": {},
    },
    "Carmen 2.0": {
        "genetics": "Carmen × Unknown",
        "parents": ["Carmen", "Unknown"],
        "grandparents": {},
    },
    "Chakraz": {
        "genetics": "Unknown Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "ChemValley Cooks F2": {
        "genetics": "Chemdawg × Valley OG × Cookies",
        "parents": ["Chemdawg", "Girl Scout Cookies"],
        "grandparents": {"Girl Scout Cookies": ["OG Kush", "Durban Poison"]},
    },
    "Chemberries": {
        "genetics": "Chemdawg × Blueberry",
        "parents": ["Chemdawg", "Blueberry"],
        "grandparents": {"Blueberry": ["Purple Thai", "Thai"]},
    },
    "Chemical Bride": {
        "genetics": "Chemdawg × Unknown",
        "parents": ["Chemdawg", "Unknown"],
        "grandparents": {},
    },
    "Cherry Essence": {
        "genetics": "Cherry Pie × Unknown",
        "parents": ["Cherry Pie", "Unknown"],
        "grandparents": {"Cherry Pie": ["Granddaddy Purple", "Durban Poison"]},
    },
    "Cherry Pavlova": {
        "genetics": "Cherry Pie × Unknown",
        "parents": ["Cherry Pie", "Unknown"],
        "grandparents": {"Cherry Pie": ["Granddaddy Purple", "Durban Poison"]},
    },
    "Cherry Poppers": {
        "genetics": "Cherry Pie × Unknown",
        "parents": ["Cherry Pie", "Unknown"],
        "grandparents": {"Cherry Pie": ["Granddaddy Purple", "Durban Poison"]},
    },
    "Cherry Royal": {
        "genetics": "Cherry Pie × Unknown",
        "parents": ["Cherry Pie", "Unknown"],
        "grandparents": {"Cherry Pie": ["Granddaddy Purple", "Durban Poison"]},
    },
    "Chocolate Wafflez": {
        "genetics": "Chocolate Thai × Unknown",
        "parents": ["Chocolate Thai", "Unknown"],
        "grandparents": {},
    },
    "Citrus Dream": {
        "genetics": "Citrus × Blue Dream",
        "parents": ["Unknown Citrus", "Blue Dream"],
        "grandparents": {"Blue Dream": ["Blueberry", "Haze"]},
    },
    "Clinical White CBD": {
        "genetics": "White Widow × Unknown CBD",
        "parents": ["White Widow", "Unknown CBD"],
        "grandparents": {"White Widow": ["Brazilian", "South Indian"]},
    },
    "Club Lemon OG": {
        "genetics": "Lemon OG × Unknown",
        "parents": ["Lemon OG", "Unknown"],
        "grandparents": {"Lemon OG": ["Las Vegas Lemon Skunk", "OG Kush"]},
    },
    "Club Pineapple Poison": {
        "genetics": "Pineapple × Durban Poison",
        "parents": ["Pineapple", "Durban Poison"],
        "grandparents": {},
    },
    "Club Prima Holandica": {
        "genetics": "Unknown Dutch Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Club Strawberry Cookies": {
        "genetics": "Strawberry Cough × Girl Scout Cookies",
        "parents": ["Strawberry Cough", "Girl Scout Cookies"],
        "grandparents": {"Strawberry Cough": ["Haze", "Strawberry Fields"], "Girl Scout Cookies": ["OG Kush", "Durban Poison"]},
    },
    "Club Sweet Bourbon Auto Kush": {
        "genetics": "Sweet Bourbon × Kush autoflower",
        "parents": ["Sweet Bourbon", "Unknown Kush Auto"],
        "grandparents": {},
    },
    "Cookie Casket": {
        "genetics": "Girl Scout Cookies × Unknown",
        "parents": ["Girl Scout Cookies", "Unknown"],
        "grandparents": {"Girl Scout Cookies": ["OG Kush", "Durban Poison"]},
    },
    "Cookies n Creamix": {
        "genetics": "Cookies and Cream × Unknown",
        "parents": ["Cookies and Cream", "Unknown"],
        "grandparents": {"Cookies and Cream": ["Starfighter", "GSC"]},
    },
    "Crash Crimes": {
        "genetics": "Wedding Crasher × Unknown",
        "parents": ["Wedding Crasher", "Unknown"],
        "grandparents": {"Wedding Crasher": ["Wedding Cake", "Purple Punch"]},
    },
    "Cristal Metal": {
        "genetics": "Unknown Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Cropolope": {
        "genetics": "Unknown × Cannalope",
        "parents": ["Unknown", "Cannalope Haze"],
        "grandparents": {"Cannalope Haze": ["Haze Brothers", "Mexican Sativa"]},
    },
    "Crunch": {
        "genetics": "Unknown Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Cur022224Spd": {
        "genetics": "Unknown (batch code cultivar)",
        "parents": ["Unknown"],
        "grandparents": {},
    },

    # ── D ──
    "Dark Velvet": {
        "genetics": "Unknown Purple Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Deadhead Og flower Cali Connection": {
        "genetics": "Chemdawg 91 × SFV OG Kush",
        "parents": ["Chemdawg 91", "SFV OG Kush"],
        "grandparents": {"SFV OG Kush": ["OG Kush", "Unknown"]},
    },
    "Deelite": {
        "genetics": "Unknown Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Devil XXL": {
        "genetics": "Big Devil × Unknown",
        "parents": ["Big Devil", "Unknown"],
        "grandparents": {},
    },
    "Disappearing Act V2": {
        "genetics": "Unknown Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Dominion Company Granny Skunk": {
        "genetics": "Skunk #1 × Unknown",
        "parents": ["Skunk #1", "Unknown"],
        "grandparents": {"Skunk #1": ["Afghan", "Acapulco Gold", "Colombian Gold"]},
    },
    "Don AK": {
        "genetics": "AK-47 variant (Sweet Seeds)",
        "parents": ["AK-47"],
        "grandparents": {"AK-47": ["Colombian", "Mexican", "Thai", "Afghan"]},
    },
    "Don Amnesia": {
        "genetics": "Amnesia Haze variant (Sweet Seeds)",
        "parents": ["Amnesia Haze"],
        "grandparents": {"Amnesia Haze": ["Afghani", "Jamaican", "Laos", "Hawaiian"]},
    },
    "Don Cherrypie": {
        "genetics": "Cherry Pie variant (Sweet Seeds)",
        "parents": ["Cherry Pie"],
        "grandparents": {"Cherry Pie": ["Granddaddy Purple", "Durban Poison"]},
    },
    "Don Do Si Cookies": {
        "genetics": "Do-Si-Dos × Girl Scout Cookies",
        "parents": ["Do-Si-Dos", "Girl Scout Cookies"],
        "grandparents": {"Do-Si-Dos": ["Girl Scout Cookies", "Face Off OG"], "Girl Scout Cookies": ["OG Kush", "Durban Poison"]},
    },
    "Don Do Si Glue": {
        "genetics": "Do-Si-Dos × Gorilla Glue #4",
        "parents": ["Do-Si-Dos", "Gorilla Glue #4"],
        "grandparents": {"Do-Si-Dos": ["Girl Scout Cookies", "Face Off OG"], "Gorilla Glue #4": ["Chem Sister", "Sour Dubb", "Chocolate Diesel"]},
    },
    "Don Do-Si-Punch": {
        "genetics": "Do-Si-Dos × Purple Punch",
        "parents": ["Do-Si-Dos", "Purple Punch"],
        "grandparents": {"Do-Si-Dos": ["Girl Scout Cookies", "Face Off OG"], "Purple Punch": ["Larry OG", "Granddaddy Purple"]},
    },
    "Don Forbidden Fruit": {
        "genetics": "Forbidden Fruit variant (Sweet Seeds)",
        "parents": ["Forbidden Fruit"],
        "grandparents": {"Forbidden Fruit": ["Cherry Pie", "Tangie"]},
    },
    "Don Gorilla Glue": {
        "genetics": "Gorilla Glue #4 variant (Sweet Seeds)",
        "parents": ["Gorilla Glue #4"],
        "grandparents": {"Gorilla Glue #4": ["Chem Sister", "Sour Dubb", "Chocolate Diesel"]},
    },
    "Don Purple Dick": {
        "genetics": "Purple × Unknown (Sweet Seeds)",
        "parents": ["Unknown Purple", "Unknown"],
        "grandparents": {},
    },
    "Dosed Chocolate Chips": {
        "genetics": "Chocolate × Cookies",
        "parents": ["Chocolate Thai", "Unknown Cookies"],
        "grandparents": {},
    },
    "Double Scoop": {
        "genetics": "Ice Cream Cake × Unknown",
        "parents": ["Ice Cream Cake", "Unknown"],
        "grandparents": {"Ice Cream Cake": ["Wedding Cake", "Gelato #33"]},
    },
    "Double Zamal": {
        "genetics": "Zamal × Zamal (Réunion Sativa)",
        "parents": ["Zamal"],
        "grandparents": {},
    },
    "Dougâs Varin": {
        "genetics": "Doug's Varin (THCV-dominant cultivar)",
        "parents": ["African Sativa Landrace"],
        "grandparents": {},
    },

    # ── E ──
    "Early Skunk x Cinderella 99": {
        "genetics": "Early Skunk × Cinderella 99",
        "parents": ["Early Skunk", "Cinderella 99"],
        "grandparents": {"Early Skunk": ["Skunk #1", "Early Pearl"], "Cinderella 99": ["Princess", "P75"]},
    },
    "Easy Button - Happy Valley Genetics": {
        "genetics": "Unknown Hybrid (Happy Valley Genetics)",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Empire 54": {
        "genetics": "Unknown Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Endless Sky": {
        "genetics": "Unknown Sativa Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Everglades OG - Happy Valley Genetics": {
        "genetics": "OG Kush × Unknown (Happy Valley Genetics)",
        "parents": ["OG Kush", "Unknown"],
        "grandparents": {"OG Kush": ["Chemdawg", "Lemon Thai"]},
    },
    "Exodus Fumes": {
        "genetics": "Exodus Cheese × Unknown",
        "parents": ["Exodus Cheese", "Unknown"],
        "grandparents": {"Exodus Cheese": ["Skunk #1", "Unknown"]},
    },

    # ── F ──
    "FX3": {
        "genetics": "Unknown Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Fast Buds Lsd 25 inized": {
        "genetics": "LSD-25 autoflower (FastBuds)",
        "parents": ["LSD-25"],
        "grandparents": {"LSD-25": ["Mazar I Sharif", "Skunk #1"]},
    },
    "Fat Bastard Blimburn": {
        "genetics": "Goldmember × Blueberry (Blimburn Seeds)",
        "parents": ["Goldmember", "Blueberry"],
        "grandparents": {"Blueberry": ["Purple Thai", "Thai"]},
    },
    "Fizzy Gum": {
        "genetics": "Bubblegum × Unknown",
        "parents": ["Bubblegum", "Unknown"],
        "grandparents": {"Bubblegum": ["Indiana Bubblegum", "Unknown"]},
    },
    "Flashberry": {
        "genetics": "Unknown Berry Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Forbidden Fruta Cake": {
        "genetics": "Forbidden Fruit × Wedding Cake",
        "parents": ["Forbidden Fruit", "Wedding Cake"],
        "grandparents": {"Forbidden Fruit": ["Cherry Pie", "Tangie"], "Wedding Cake": ["Triangle Kush", "Animal Mints"]},
    },
    "Francos Fullgas": {
        "genetics": "Unknown Hybrid (Franco's selection)",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Fruity Pebbles Blimburn": {
        "genetics": "Fruity Pebbles OG variant (Blimburn Seeds)",
        "parents": ["Green Ribbon", "Granddaddy Purple", "Tahoe Alien"],
        "grandparents": {"Granddaddy Purple": ["Purple Urkle", "Big Bud"]},
    },
    "Fryday Boof": {
        "genetics": "Unknown Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Fully Loaded": {
        "genetics": "Unknown Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },

    # ── G ──
    "Galactic Rainbow": {
        "genetics": "Rainbow × Unknown",
        "parents": ["Rainbow", "Unknown"],
        "grandparents": {},
    },
    "Gas Dropz": {
        "genetics": "Unknown Gas Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Gdp 011124": {
        "genetics": "Granddaddy Purple (batch cultivar)",
        "parents": ["Granddaddy Purple"],
        "grandparents": {"Granddaddy Purple": ["Purple Urkle", "Big Bud"]},
    },
    "Genetix Frosted Acai": {
        "genetics": "Unknown Hybrid (Genetix selection)",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Ghost Train Haze Blimburn": {
        "genetics": "Ghost OG × Neville's Wreck (Blimburn Seeds)",
        "parents": ["Ghost OG", "Neville's Wreck"],
        "grandparents": {"Ghost OG": ["OG Kush", "Unknown"], "Neville's Wreck": ["Neville's Haze", "Trainwreck"]},
    },
    "Glitter Biscuits": {
        "genetics": "Unknown Cookies Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Glookies inized Barneys Farm": {
        "genetics": "Gorilla Glue #4 × Thin Mint Girl Scout Cookies",
        "parents": ["Gorilla Glue #4", "Thin Mint GSC"],
        "grandparents": {"Gorilla Glue #4": ["Chem Sister", "Sour Dubb", "Chocolate Diesel"], "Thin Mint GSC": ["OG Kush", "Durban Poison"]},
    },
    "Gmo F": {
        "genetics": "GMO (Garlic Cookies) phenotype",
        "parents": ["GMO"],
        "grandparents": {"GMO": ["Chemdawg", "Girl Scout Cookies"]},
    },
    "Gnasha": {
        "genetics": "Unknown Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Go Time": {
        "genetics": "Unknown Sativa Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Gold Wave": {
        "genetics": "Unknown Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Grannys Marker": {
        "genetics": "Unknown Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Green Tiger Fast Flowering": {
        "genetics": "Unknown Fast Flowering Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Gulupa": {
        "genetics": "Unknown Exotic Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },

    # ── H ──
    "HB Dunkinz": {
        "genetics": "Unknown Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Hawaii x Purple Skunk": {
        "genetics": "Hawaiian × Purple Skunk",
        "parents": ["Hawaiian", "Purple Skunk"],
        "grandparents": {},
    },
    "Hazanana": {
        "genetics": "Haze × Banana",
        "parents": ["Haze", "Banana Kush"],
        "grandparents": {"Haze": ["Colombian Gold", "Thai"], "Banana Kush": ["Ghost OG", "Skunk Haze"]},
    },
    "Hell Yeah": {
        "genetics": "Unknown Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Hidden Vice": {
        "genetics": "Unknown Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "High Lux": {
        "genetics": "Unknown Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "HighCloudZ": {
        "genetics": "Unknown Sativa Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Highlighterz": {
        "genetics": "Unknown Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Hippo High": {
        "genetics": "Unknown Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Hokuzan": {
        "genetics": "Unknown Japanese Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Holy Snow": {
        "genetics": "Holy Grail × Snowcap",
        "parents": ["Holy Grail", "Snowcap"],
        "grandparents": {},
    },
    "Honeyed Cream Dream": {
        "genetics": "Honey × Cream × Blue Dream",
        "parents": ["Blue Dream", "Unknown"],
        "grandparents": {"Blue Dream": ["Blueberry", "Haze"]},
    },
    "Hoodoo Mama Juju": {
        "genetics": "Unknown Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Humboldt Holy": {
        "genetics": "Unknown Humboldt Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Humboldt Seed Co Stoopid Fruits Strain Fem Photo": {
        "genetics": "Unknown Fruity Hybrid (Humboldt Seed Co.)",
        "parents": ["Unknown"],
        "grandparents": {},
    },

    # ── I ──
    "Ice Cream USA Range": {
        "genetics": "Ice Cream Cake variant",
        "parents": ["Ice Cream Cake"],
        "grandparents": {"Ice Cream Cake": ["Wedding Cake", "Gelato #33"]},
    },

    # ── J ──
    "Jamz": {
        "genetics": "Unknown Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Jilly Bean Bubblegum": {
        "genetics": "Jilly Bean × Bubblegum",
        "parents": ["Jilly Bean", "Bubblegum"],
        "grandparents": {"Jilly Bean": ["Orange Velvet", "Space Queen"], "Bubblegum": ["Indiana Bubblegum", "Unknown"]},
    },
    "Jilly Bean Cherry": {
        "genetics": "Jilly Bean × Cherry",
        "parents": ["Jilly Bean", "Unknown Cherry"],
        "grandparents": {"Jilly Bean": ["Orange Velvet", "Space Queen"]},
    },

    # ── K ──
    "Kabbalah": {
        "genetics": "Unknown Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Kali Rush": {
        "genetics": "Kali Mist × Unknown",
        "parents": ["Kali Mist", "Unknown"],
        "grandparents": {},
    },
    "Ki Lime Pie": {
        "genetics": "Key Lime Pie × Unknown",
        "parents": ["Key Lime Pie", "Unknown"],
        "grandparents": {"Key Lime Pie": ["GSC", "Unknown"]},
    },
    "Kiyomi": {
        "genetics": "Unknown Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Knockout  - Happy Valley Genetics": {
        "genetics": "Unknown Hybrid (Happy Valley Genetics)",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Kosher Prophet": {
        "genetics": "Kosher Kush × Unknown",
        "parents": ["Kosher Kush", "Unknown"],
        "grandparents": {},
    },
    "Kush XL": {
        "genetics": "OG Kush × Unknown",
        "parents": ["OG Kush", "Unknown"],
        "grandparents": {"OG Kush": ["Chemdawg", "Lemon Thai"]},
    },
    "Kushkak": {
        "genetics": "Kush × Unknown",
        "parents": ["OG Kush", "Unknown"],
        "grandparents": {"OG Kush": ["Chemdawg", "Lemon Thai"]},
    },
    "KushânâCookies CBD": {
        "genetics": "OG Kush × Girl Scout Cookies × CBD cultivar",
        "parents": ["OG Kush", "Girl Scout Cookies"],
        "grandparents": {"OG Kush": ["Chemdawg", "Lemon Thai"], "Girl Scout Cookies": ["OG Kush", "Durban Poison"]},
    },

    # ── L ──
    "La Chica": {
        "genetics": "Unknown Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "La Macedonia": {
        "genetics": "Unknown Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "La Mandarina Feliz": {
        "genetics": "Mandarin × Unknown",
        "parents": ["Mandarin", "Unknown"],
        "grandparents": {},
    },
    "Lava Flower": {
        "genetics": "Unknown Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Lebron Haze": {
        "genetics": "Haze × Unknown",
        "parents": ["Haze", "Unknown"],
        "grandparents": {"Haze": ["Colombian Gold", "Thai"]},
    },
    "Leda Uno": {
        "genetics": "Unknown Indica",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Liquid Butter": {
        "genetics": "Peanut Butter Breath × Unknown",
        "parents": ["Peanut Butter Breath", "Unknown"],
        "grandparents": {"Peanut Butter Breath": ["Do-Si-Dos", "Mendo Breath"]},
    },
    "Love Drunk": {
        "genetics": "Unknown Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Lucid Fruit": {
        "genetics": "Unknown Fruity Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Lyly Sour x Blue OG": {
        "genetics": "Sour Diesel × Blue OG",
        "parents": ["Sour Diesel", "Blue OG"],
        "grandparents": {"Sour Diesel": ["Chemdawg 91", "Super Skunk"]},
    },

    # ── M ──
    "MACmelon": {
        "genetics": "MAC × Watermelon Zkittlez",
        "parents": ["MAC", "Watermelon Zkittlez"],
        "grandparents": {"MAC": ["Alien Cookies", "Miracle 15", "Colombian"]},
    },
    "MACÂ²": {
        "genetics": "MAC × MAC (MAC v2)",
        "parents": ["MAC"],
        "grandparents": {"MAC": ["Alien Cookies", "Miracle 15", "Colombian"]},
    },
    "Mac F": {
        "genetics": "MAC phenotype",
        "parents": ["MAC"],
        "grandparents": {"MAC": ["Alien Cookies", "Miracle 15", "Colombian"]},
    },
    "Magnetic Marker": {
        "genetics": "Unknown Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Makaha": {
        "genetics": "Hawaiian × Unknown",
        "parents": ["Hawaiian", "Unknown"],
        "grandparents": {},
    },
    "Mamoncillo": {
        "genetics": "Unknown Tropical Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Marula Fruit": {
        "genetics": "Unknown Fruity Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Maxigom": {
        "genetics": "Unknown Autoflower",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Medical Buddha": {
        "genetics": "Medical Strain × Buddha",
        "parents": ["Unknown Medical", "Unknown"],
        "grandparents": {},
    },
    "Mellowz": {
        "genetics": "Unknown Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "MelonSicle": {
        "genetics": "Watermelon × Unknown",
        "parents": ["Watermelon", "Unknown"],
        "grandparents": {},
    },
    "Metal Dragon": {
        "genetics": "Unknown Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Miami Sunset OG": {
        "genetics": "OG Kush × Unknown Miami cultivar",
        "parents": ["OG Kush", "Unknown"],
        "grandparents": {"OG Kush": ["Chemdawg", "Lemon Thai"]},
    },
    "Michka": {
        "genetics": "Unknown Sativa",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Michoacan Cream": {
        "genetics": "Michoacan Landrace × Cream",
        "parents": ["Michoacan Landrace", "Unknown"],
        "grandparents": {},
    },
    "Midori 44 F": {
        "genetics": "Unknown Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Mighty Mango Bud": {
        "genetics": "Mango × Unknown",
        "parents": ["Mango", "Unknown"],
        "grandparents": {},
    },
    "Mint Candy": {
        "genetics": "Kush Mints × Unknown",
        "parents": ["Kush Mints", "Unknown"],
        "grandparents": {"Kush Mints": ["Animal Mints", "Bubba Kush"]},
    },
    "Miracle Fruit": {
        "genetics": "Unknown Fruity Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Mwm052024Bldv": {
        "genetics": "Unknown (batch code cultivar)",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Mwm052824Gdpv Gdp": {
        "genetics": "Granddaddy Purple (batch cultivar)",
        "parents": ["Granddaddy Purple"],
        "grandparents": {"Granddaddy Purple": ["Purple Urkle", "Big Bud"]},
    },
    "Mwm052824Horv Horchata": {
        "genetics": "Horchata (batch cultivar)",
        "parents": ["Horchata"],
        "grandparents": {"Horchata": ["Mochi Gelato", "Jet Fuel Gelato"]},
    },

    # ── N ──
    "New Blackberry Moonrocks F": {
        "genetics": "Blackberry × Unknown",
        "parents": ["Blackberry", "Unknown"],
        "grandparents": {},
    },
    "Northern Berry": {
        "genetics": "Northern Lights × Blueberry",
        "parents": ["Northern Lights", "Blueberry"],
        "grandparents": {"Northern Lights": ["Afghan", "Thai"], "Blueberry": ["Purple Thai", "Thai"]},
    },

    # ── O ──
    "Oh Snap!": {
        "genetics": "Unknown Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Orange Acai": {
        "genetics": "Orange × Acai",
        "parents": ["Orange", "Acai"],
        "grandparents": {},
    },
    "Orange Barb": {
        "genetics": "Orange Bud × Unknown",
        "parents": ["Orange Bud", "Unknown"],
        "grandparents": {},
    },
    "Orange Frappe": {
        "genetics": "Orange × Unknown",
        "parents": ["Orange", "Unknown"],
        "grandparents": {},
    },
    "Orange Jelly Sunset": {
        "genetics": "Orange Jelly × Sunset Sherbert",
        "parents": ["Orange Jelly", "Sunset Sherbert"],
        "grandparents": {"Sunset Sherbert": ["Girl Scout Cookies", "Pink Panties"]},
    },
    "Orange Snap": {
        "genetics": "Orange × Unknown",
        "parents": ["Orange", "Unknown"],
        "grandparents": {},
    },
    "Oregon Peach": {
        "genetics": "Unknown Oregon Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Over The Rainbow (Zaizai LINE REG)": {
        "genetics": "Unknown Hybrid (Zaizai Line)",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Overtime  - Happy Valley Genetics": {
        "genetics": "Unknown Hybrid (Happy Valley Genetics)",
        "parents": ["Unknown"],
        "grandparents": {},
    },

    # ── P ──
    "Pack Sativa": {
        "genetics": "Unknown Sativa",
        "parents": ["Unknown Sativa"],
        "grandparents": {},
    },
    "Permanent Velvet": {
        "genetics": "Unknown Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Piglettas Purple Potion": {
        "genetics": "Unknown Purple Hybrid",
        "parents": ["Unknown Purple"],
        "grandparents": {},
    },
    "Pilot": {
        "genetics": "Unknown Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Pineapple Cheetah": {
        "genetics": "Pineapple × Unknown",
        "parents": ["Pineapple", "Unknown"],
        "grandparents": {},
    },
    "Pineapple Cubez": {
        "genetics": "Pineapple × Unknown",
        "parents": ["Pineapple", "Unknown"],
        "grandparents": {},
    },
    "Pineapple Daddy - Happy Valley Genetics": {
        "genetics": "Pineapple × Unknown (Happy Valley Genetics)",
        "parents": ["Pineapple", "Unknown"],
        "grandparents": {},
    },
    "Pineapple XX": {
        "genetics": "Pineapple × Unknown",
        "parents": ["Pineapple", "Unknown"],
        "grandparents": {},
    },
    "Pink Mist": {
        "genetics": "Pink × Unknown",
        "parents": ["Unknown Pink", "Unknown"],
        "grandparents": {},
    },
    "Pinkz": {
        "genetics": "Pink Runtz × Unknown",
        "parents": ["Pink Runtz", "Unknown"],
        "grandparents": {"Pink Runtz": ["Zkittlez", "Gelato"]},
    },
    "Pisthash": {
        "genetics": "Pistachio × Hash Plant",
        "parents": ["Pistachio", "Hash Plant"],
        "grandparents": {},
    },
    "Planet Lemon": {
        "genetics": "Lemon × Unknown",
        "parents": ["Unknown Lemon", "Unknown"],
        "grandparents": {},
    },
    "Popeyes Cookies": {
        "genetics": "Girl Scout Cookies × Unknown",
        "parents": ["Girl Scout Cookies", "Unknown"],
        "grandparents": {"Girl Scout Cookies": ["OG Kush", "Durban Poison"]},
    },
    "Privileged Baddie": {
        "genetics": "Unknown Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Project Blu-Candi": {
        "genetics": "Blueberry × Candy",
        "parents": ["Blueberry", "Unknown Candy"],
        "grandparents": {"Blueberry": ["Purple Thai", "Thai"]},
    },
    "Purple Fun Dip": {
        "genetics": "Purple Punch × Unknown",
        "parents": ["Purple Punch", "Unknown"],
        "grandparents": {"Purple Punch": ["Larry OG", "Granddaddy Purple"]},
    },
    "Purple Kush x White Russian": {
        "genetics": "Purple Kush × White Russian",
        "parents": ["Purple Kush", "White Russian"],
        "grandparents": {"Purple Kush": ["Hindu Kush", "Purple Afghani"], "White Russian": ["White Widow", "AK-47"]},
    },
    "Purple Mints": {
        "genetics": "Purple × Kush Mints",
        "parents": ["Unknown Purple", "Kush Mints"],
        "grandparents": {"Kush Mints": ["Animal Mints", "Bubba Kush"]},
    },
    "Purple Tonic": {
        "genetics": "Purple × CBD Tonic",
        "parents": ["Unknown Purple", "CBD Tonic"],
        "grandparents": {},
    },
    "Purple Turban": {
        "genetics": "Purple × Unknown",
        "parents": ["Unknown Purple", "Unknown"],
        "grandparents": {},
    },

    # ── R ──
    "RP 43â S1 AKA Richard Petty": {
        "genetics": "Unknown Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Rainbow Apples": {
        "genetics": "Rainbow × Apple",
        "parents": ["Rainbow", "Unknown Apple"],
        "grandparents": {},
    },
    "Rainbow Explosion": {
        "genetics": "Rainbow × Unknown",
        "parents": ["Rainbow", "Unknown"],
        "grandparents": {},
    },
    "Rainbow Glue  Cannabis  - Homegrown Cannabis Co.": {
        "genetics": "Zkittlez × Gorilla Glue #4",
        "parents": ["Zkittlez", "Gorilla Glue #4"],
        "grandparents": {"Zkittlez": ["Grape Ape", "Grapefruit"], "Gorilla Glue #4": ["Chem Sister", "Sour Dubb", "Chocolate Diesel"]},
    },
    "Rainbow Glue - Homegrown Co.": {
        "genetics": "Zkittlez × Gorilla Glue #4",
        "parents": ["Zkittlez", "Gorilla Glue #4"],
        "grandparents": {"Zkittlez": ["Grape Ape", "Grapefruit"], "Gorilla Glue #4": ["Chem Sister", "Sour Dubb", "Chocolate Diesel"]},
    },
    "Rainbows": {
        "genetics": "Zkittlez × Unknown",
        "parents": ["Zkittlez", "Unknown"],
        "grandparents": {"Zkittlez": ["Grape Ape", "Grapefruit"]},
    },
    "Raspberry Jelly": {
        "genetics": "Raspberry × Unknown",
        "parents": ["Raspberry", "Unknown"],
        "grandparents": {},
    },
    "Red Banana Pudding": {
        "genetics": "Banana Pudding × Unknown Red",
        "parents": ["Banana Pudding", "Unknown"],
        "grandparents": {},
    },
    "Red Candy Apple": {
        "genetics": "Red × Apple",
        "parents": ["Unknown Red", "Unknown Apple"],
        "grandparents": {},
    },
    "Red Lotus": {
        "genetics": "Unknown Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Red Opal": {
        "genetics": "Unknown Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Redball SOS": {
        "genetics": "Unknown Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Research Afghan Pearl CBD": {
        "genetics": "Afghan Pearl × Unknown CBD",
        "parents": ["Afghan Pearl", "Unknown CBD"],
        "grandparents": {},
    },
    "Research Banana Frosting": {
        "genetics": "Banana × Frosting",
        "parents": ["Banana Kush", "Unknown"],
        "grandparents": {"Banana Kush": ["Ghost OG", "Skunk Haze"]},
    },
    "Research Tezla OG": {
        "genetics": "OG Kush × Unknown",
        "parents": ["OG Kush", "Unknown"],
        "grandparents": {"OG Kush": ["Chemdawg", "Lemon Thai"]},
    },
    "Rock Machine": {
        "genetics": "Unknown Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },

    # ── S ──
    "SODK": {
        "genetics": "Sour Orange Diesel Kush (Mephisto Genetics)",
        "parents": ["Sour Orange Diesel", "Unknown Kush"],
        "grandparents": {},
    },
    "Sabroso Cherry": {
        "genetics": "Cherry × Unknown",
        "parents": ["Cherry", "Unknown"],
        "grandparents": {},
    },
    "Sagrada Amnesia": {
        "genetics": "Amnesia Haze × Unknown",
        "parents": ["Amnesia Haze", "Unknown"],
        "grandparents": {"Amnesia Haze": ["Afghani", "Jamaican", "Laos", "Hawaiian"]},
    },
    "Scrambler Haze Blimburn": {
        "genetics": "Haze × Unknown (Blimburn Seeds)",
        "parents": ["Haze", "Unknown"],
        "grandparents": {"Haze": ["Colombian Gold", "Thai"]},
    },
    "Sensi Amnesia": {
        "genetics": "Amnesia × Unknown (Sensi Seeds)",
        "parents": ["Amnesia", "Unknown"],
        "grandparents": {},
    },
    "SexBud": {
        "genetics": "Unknown Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Shiskaberry inized Barneys Farm": {
        "genetics": "DJ Short Blueberry × Afghan (Barney's Farm)",
        "parents": ["DJ Short Blueberry", "Afghan"],
        "grandparents": {"DJ Short Blueberry": ["Purple Thai", "Thai"]},
    },
    "Space Station Violet": {
        "genetics": "Space Queen × Unknown Purple",
        "parents": ["Space Queen", "Unknown Purple"],
        "grandparents": {"Space Queen": ["Romulan", "Cinderella 99"]},
    },
    "Stoned Panda": {
        "genetics": "Unknown Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Strawberry Merengue": {
        "genetics": "Strawberry × Unknown",
        "parents": ["Strawberry", "Unknown"],
        "grandparents": {},
    },
    "Strawberry Pop Rocks": {
        "genetics": "Strawberry × Unknown",
        "parents": ["Strawberry", "Unknown"],
        "grandparents": {},
    },
    "Strawberry Safari V2": {
        "genetics": "Strawberry × Unknown Exotic",
        "parents": ["Strawberry", "Unknown"],
        "grandparents": {},
    },
    "Strawberry Whip": {
        "genetics": "Strawberry Cough × Unknown",
        "parents": ["Strawberry Cough", "Unknown"],
        "grandparents": {"Strawberry Cough": ["Haze", "Strawberry Fields"]},
    },
    "Strawberry-AKeil": {
        "genetics": "Strawberry × AK-47",
        "parents": ["Strawberry", "AK-47"],
        "grandparents": {"AK-47": ["Colombian", "Mexican", "Thai", "Afghan"]},
    },
    "Strelka": {
        "genetics": "Unknown Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Sugar Babe": {
        "genetics": "Unknown Sweet Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Sunset Cherries (CHERRYTINI LINE FEM)": {
        "genetics": "Sunset Sherbert × Cherry",
        "parents": ["Sunset Sherbert", "Unknown Cherry"],
        "grandparents": {"Sunset Sherbert": ["Girl Scout Cookies", "Pink Panties"]},
    },
    "Sunset Paradise": {
        "genetics": "Sunset Sherbert × Unknown",
        "parents": ["Sunset Sherbert", "Unknown"],
        "grandparents": {"Sunset Sherbert": ["Girl Scout Cookies", "Pink Panties"]},
    },
    "Super Wedding Haze": {
        "genetics": "Super Silver Haze × Wedding Cake",
        "parents": ["Super Silver Haze", "Wedding Cake"],
        "grandparents": {"Super Silver Haze": ["Skunk #1", "Northern Lights #5", "Haze"], "Wedding Cake": ["Triangle Kush", "Animal Mints"]},
    },
    "Swamp Magic": {
        "genetics": "Unknown Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Sweet 16  - Happy Valley Genetics": {
        "genetics": "Unknown Hybrid (Happy Valley Genetics)",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Sweet Belts": {
        "genetics": "Unknown Sweet Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Sweet Critical 2.0": {
        "genetics": "Critical Mass × Unknown (Sweet Seeds)",
        "parents": ["Critical Mass", "Unknown"],
        "grandparents": {"Critical Mass": ["Afghani", "Skunk #1"]},
    },
    "Sweet Island": {
        "genetics": "Sweet Tooth × Unknown Island",
        "parents": ["Sweet Tooth", "Unknown"],
        "grandparents": {},
    },
    "Sweetopia": {
        "genetics": "Unknown Sweet Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Swiss-XT": {
        "genetics": "Swiss Miss × Unknown",
        "parents": ["Swiss Miss", "Unknown"],
        "grandparents": {},
    },
    "Sword of Bolivar": {
        "genetics": "Unknown South American Hybrid",
        "parents": ["Unknown South American"],
        "grandparents": {},
    },

    # ── T ──
    "Taliban Poison": {
        "genetics": "Durban Poison × Afghan",
        "parents": ["Durban Poison", "Afghan"],
        "grandparents": {},
    },
    "The Mg Experience": {
        "genetics": "Unknown Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "The Notorious Z": {
        "genetics": "Zkittlez × Unknown",
        "parents": ["Zkittlez", "Unknown"],
        "grandparents": {"Zkittlez": ["Grape Ape", "Grapefruit"]},
    },
    "The Sin": {
        "genetics": "Unknown Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Trans Love Energies": {
        "genetics": "Unknown Sativa Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Trich Beast": {
        "genetics": "Unknown High-Trichome Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Triple XL": {
        "genetics": "Unknown XL Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Trippy Pebbles": {
        "genetics": "Fruity Pebbles OG × Unknown",
        "parents": ["Fruity Pebbles OG", "Unknown"],
        "grandparents": {},
    },
    "Triton Biscotto Lime": {
        "genetics": "Biscotti × Lime",
        "parents": ["Biscotti", "Unknown Lime"],
        "grandparents": {"Biscotti": ["Gelato #25", "South Florida OG"]},
    },
    "TriâWhip Kush": {
        "genetics": "Unknown Kush Hybrid",
        "parents": ["Unknown Kush"],
        "grandparents": {},
    },
    "Tropic Gem": {
        "genetics": "Unknown Tropical Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Tropical Berry": {
        "genetics": "Tropical × Berry",
        "parents": ["Unknown Tropical", "Unknown Berry"],
        "grandparents": {},
    },
    "Tropical Zmoothie": {
        "genetics": "Unknown Tropical Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Tropicanna Banana inized Barneys Farm": {
        "genetics": "Tropicana Cookies × Banana Kush (Barney's Farm)",
        "parents": ["Tropicana Cookies", "Banana Kush"],
        "grandparents": {"Tropicana Cookies": ["GSC", "Tangie"], "Banana Kush": ["Ghost OG", "Skunk Haze"]},
    },
    "Tropizai (Zaizai LINE REG)": {
        "genetics": "Tropical × Unknown (Zaizai Line)",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Twin Flame": {
        "genetics": "Unknown Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },

    # ── U ──
    "Ultimate Banana Kush": {
        "genetics": "Banana Kush × Unknown",
        "parents": ["Banana Kush", "Unknown"],
        "grandparents": {"Banana Kush": ["Ghost OG", "Skunk Haze"]},
    },

    # ── V ──
    "Vision Caramello": {
        "genetics": "Caramel × Unknown (Vision Seeds)",
        "parents": ["Caramel", "Unknown"],
        "grandparents": {},
    },
    "Vision Cookies": {
        "genetics": "Girl Scout Cookies variant (Vision Seeds)",
        "parents": ["Girl Scout Cookies"],
        "grandparents": {"Girl Scout Cookies": ["OG Kush", "Durban Poison"]},
    },
    "Vision Gorilla": {
        "genetics": "Gorilla Glue #4 variant (Vision Seeds)",
        "parents": ["Gorilla Glue #4"],
        "grandparents": {"Gorilla Glue #4": ["Chem Sister", "Sour Dubb", "Chocolate Diesel"]},
    },

    # ── W ──
    "WW x Thai Haze x Skunk #1": {
        "genetics": "White Widow × Thai Haze × Skunk #1",
        "parents": ["White Widow", "Thai Haze", "Skunk #1"],
        "grandparents": {"White Widow": ["Brazilian", "South Indian"], "Skunk #1": ["Afghan", "Acapulco Gold", "Colombian Gold"]},
    },
    "White Chocolate Orange": {
        "genetics": "White Widow × Chocolate × Orange",
        "parents": ["White Widow", "Unknown"],
        "grandparents": {"White Widow": ["Brazilian", "South Indian"]},
    },
    "White Jewel": {
        "genetics": "White Widow × Unknown",
        "parents": ["White Widow", "Unknown"],
        "grandparents": {"White Widow": ["Brazilian", "South Indian"]},
    },
    "White Noise": {
        "genetics": "White Widow × Unknown",
        "parents": ["White Widow", "Unknown"],
        "grandparents": {"White Widow": ["Brazilian", "South Indian"]},
    },
    "Whitemarker": {
        "genetics": "Unknown Hybrid",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Wlv030524Gdpv": {
        "genetics": "Granddaddy Purple (batch cultivar)",
        "parents": ["Granddaddy Purple"],
        "grandparents": {"Granddaddy Purple": ["Purple Urkle", "Big Bud"]},
    },
    "Wlv030524Slhv": {
        "genetics": "Super Lemon Haze (batch cultivar)",
        "parents": ["Super Lemon Haze"],
        "grandparents": {"Super Lemon Haze": ["Lemon Skunk", "Super Silver Haze"]},
    },
    "Wlv041624Gdpv Gdp": {
        "genetics": "Granddaddy Purple (batch cultivar)",
        "parents": ["Granddaddy Purple"],
        "grandparents": {"Granddaddy Purple": ["Purple Urkle", "Big Bud"]},
    },

    # ── Z ──
    "Z Pointer": {
        "genetics": "Zkittlez × Unknown",
        "parents": ["Zkittlez", "Unknown"],
        "grandparents": {"Zkittlez": ["Grape Ape", "Grapefruit"]},
    },
    "Z&Z": {
        "genetics": "Zkittlez × Zkittlez",
        "parents": ["Zkittlez"],
        "grandparents": {"Zkittlez": ["Grape Ape", "Grapefruit"]},
    },
    "Z-Kiem AKA Harybo": {
        "genetics": "Zkittlez × Unknown",
        "parents": ["Zkittlez", "Unknown"],
        "grandparents": {"Zkittlez": ["Grape Ape", "Grapefruit"]},
    },
    "Zacatecas Tribute F": {
        "genetics": "Zacatecas Landrace Sativa",
        "parents": ["Zacatecas Landrace"],
        "grandparents": {},
    },
    "Zahemi (Zaizai LINE REG)": {
        "genetics": "Unknown Hybrid (Zaizai Line)",
        "parents": ["Unknown"],
        "grandparents": {},
    },
    "Zillions": {
        "genetics": "Zkittlez × Unknown",
        "parents": ["Zkittlez", "Unknown"],
        "grandparents": {"Zkittlez": ["Grape Ape", "Grapefruit"]},
    },
    "Ztarfighter Omuerta Genetix": {
        "genetics": "Starfighter × Unknown (Omuerta Genetix)",
        "parents": ["Starfighter", "Unknown"],
        "grandparents": {},
    },
}


def main():
    db = sqlite3.connect(str(DB))
    c = db.cursor()

    name_to_id = {}
    for row in c.execute("SELECT id, name FROM strains"):
        name_to_id[row[1]] = row[0]

    updated = 0
    skipped = 0
    not_found = 0
    nf_names = []

    for strain_name, data in LINEAGE.items():
        strain_id = name_to_id.get(strain_name)
        if strain_id is None:
            not_found += 1
            nf_names.append(strain_name)
            continue

        genetics_str = data["genetics"]
        lineage_obj = {
            "self": strain_name,
            "parents": data["parents"],
            "grandparents": data.get("grandparents", {}),
        }
        lineage_json = json.dumps(lineage_obj)

        existing = c.execute(
            "SELECT genetics FROM strain_metadata WHERE strain_id = ?",
            (strain_id,),
        ).fetchone()

        if existing and existing[0] and existing[0] != "0" and existing[0] != "":
            skipped += 1
            continue

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

    print(f"Batch 2 lineage enrichment complete:")
    print(f"  Updated: {updated}")
    print(f"  Skipped (already had data): {skipped}")
    print(f"  Not found in DB: {not_found}")
    if nf_names:
        print(f"  Not found names: {nf_names[:20]}")
    print(f"  Total in LINEAGE map: {len(LINEAGE)}")


if __name__ == "__main__":
    main()
