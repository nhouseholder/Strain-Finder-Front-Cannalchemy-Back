#!/usr/bin/env python3
"""Get the definitive list of real strains needing lineage data."""
import sqlite3, json, re

DB = 'data/processed/cannalchemy.db'
db = sqlite3.connect(DB)
c = db.cursor()

# Get all strains missing genetics (excluding archetype/enrichment)
rows = c.execute("""
    SELECT s.id, s.name, s.strain_type, sm.genetics, sm.lineage
    FROM strains s
    JOIN strain_metadata sm ON s.id = sm.strain_id
    WHERE (sm.genetics IS NULL OR sm.genetics = '' OR sm.genetics = '0')
    AND s.source != 'enrichment-v5.17'
    ORDER BY s.name
""").fetchall()

# Filter out products, seeds, autos
prod_pat = re.compile(r'\b(0?3?3G|05G|1G|Cartridge|Vape|Pax|Cart|Resin)\b', re.I)
seed_pat = re.compile(r'\b(Mix|Bundle|Set|Box|Pk|Seeds|Regular|Feminized|F1|Bx\d|10Pk|Reg\s+\d|Fem\s+\d|Fem$|Reg$)\b', re.I)
auto_pat = re.compile(r'^AUTO\s|^Auto\s', re.I)
prod_brand_pat = re.compile(r'\b(Weedlove|Abx|Cbx|Fso|Mwm|Wlv|Cur|Gdp\s\d|Spd)\b', re.I)
code_pat = re.compile(r'\b[A-Z]{3}\d{6}[A-Z]+\b')  # product codes like Mwm052024Bldv

real_strains = []
for r in rows:
    sid, name, stype, genetics, lineage = r
    if prod_pat.search(name): continue
    if seed_pat.search(name): continue
    if auto_pat.search(name): continue
    if prod_brand_pat.search(name): continue
    if code_pat.search(name): continue
    if ' | ' in name: continue  # product format
    real_strains.append((sid, name, stype, genetics))

print(f'Real strains needing lineage: {len(real_strains)}')
print()
for sid, name, stype, gen in real_strains:
    marker = ' [has "0"]' if gen == '0' else ''
    print(f'  {name} ({stype or "?"}){marker}')

# Also output as JSON for the enrichment script
output = []
for sid, name, stype, gen in real_strains:
    output.append({"id": sid, "name": name, "type": stype or "hybrid"})

with open('/tmp/strains_needing_lineage.json', 'w') as f:
    json.dump(output, f, indent=2)
print(f'\nWrote {len(output)} strains to /tmp/strains_needing_lineage.json')

db.close()
