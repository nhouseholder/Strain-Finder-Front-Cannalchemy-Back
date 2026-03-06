#!/usr/bin/env python3
"""Fix 4 strains with encoding issues in names."""
import sqlite3, json
from pathlib import Path

DB = Path(__file__).resolve().parent.parent / "data" / "processed" / "cannalchemy.db"
db = sqlite3.connect(str(DB))
c = db.cursor()

# Find actual names
rows = c.execute(
    "SELECT id, name FROM strains WHERE name LIKE '%Varin%' OR name LIKE '%Cookies CBD%' OR name LIKE '%Petty%' OR name LIKE '%Whip Kush%'"
).fetchall()

data_map = {
    "Varin": ("Doug's Varin (THCV-dominant cultivar)", ["African Sativa Landrace"], {}),
    "Cookies CBD": ("OG Kush x Girl Scout Cookies x CBD cultivar", ["OG Kush", "Girl Scout Cookies"], {"OG Kush": ["Chemdawg", "Lemon Thai"], "Girl Scout Cookies": ["OG Kush", "Durban Poison"]}),
    "Petty": ("Unknown Hybrid", ["Unknown"], {}),
    "Whip Kush": ("Unknown Kush Hybrid", ["Unknown Kush"], {}),
}

for strain_id, name in rows:
    for key, (gen, parents, gp) in data_map.items():
        if key in name:
            lineage = json.dumps({"self": name, "parents": parents, "grandparents": gp})
            c.execute("UPDATE strain_metadata SET genetics = ?, lineage = ? WHERE strain_id = ?", (gen, lineage, strain_id))
            print(f"Updated: {name}")
            break

db.commit()
db.close()
