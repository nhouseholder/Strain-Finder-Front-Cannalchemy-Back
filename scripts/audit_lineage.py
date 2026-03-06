#!/usr/bin/env python3
"""Audit lineage/genetics data coverage across all strains."""
import json, re

with open('frontend/src/data/strains.json') as f:
    strains = json.load(f)

total = len(strains)
has_genetics = sum(1 for s in strains if s.get('genetics'))
no_genetics = sum(1 for s in strains if not s.get('genetics'))
archetype_count = sum(1 for s in strains if s.get('source') == 'archetype')

print(f'=== Exported JSON ===')
print(f'Total: {total}')
print(f'Has genetics: {has_genetics}')
print(f'Missing genetics: {no_genetics}')
print(f'  Archetype: {archetype_count}')

# Sample genetics format
with_gen = [s for s in strains if s.get('genetics')]
if with_gen:
    for s in with_gen[:3]:
        print(f'\nSample: {s["name"]}: genetics={repr(s["genetics"])[:200]}')

# Categorize missing
missing = [s for s in strains if not s.get('genetics') and s.get('source') != 'archetype']

prod_pat = re.compile(r'\b(0?3?3G|05G|1G|Cartridge|Vape|Pax|Cart)\b', re.I)
seed_pat = re.compile(r'\b(Mix|Bundle|Set|Box|Pk|Seeds|Regular|Feminized|F1|Bx\d|10Pk|Reg\s+\d|Fem\s+\d)\b', re.I)
auto_pat = re.compile(r'^AUTO\s', re.I)
cross_pat = re.compile(r'\s+x\s+', re.I)
breeder_pat = re.compile(r'\s+-\s+\w', re.I)

products = [s for s in missing if prod_pat.search(s['name'])]
remaining = [s for s in missing if not prod_pat.search(s['name'])]
seeds = [s for s in remaining if seed_pat.search(s['name'])]
remaining2 = [s for s in remaining if not seed_pat.search(s['name'])]
autos = [s for s in remaining2 if auto_pat.search(s['name'])]
remaining3 = [s for s in remaining2 if not auto_pat.search(s['name'])]

print(f'\n=== Missing Genetics Breakdown (non-archetype: {len(missing)}) ===')
print(f'Product entries (1G/vape/cart): {len(products)}')
print(f'Seed packs/breeders: {len(seeds)}')
print(f'Auto strains: {len(autos)}')
print(f'Real strains to fix: {len(remaining3)}')

print(f'\n=== Real Strains Missing Genetics ({len(remaining3)}) ===')
for s in sorted(remaining3, key=lambda x: x['name']):
    print(f'  {s["name"]} ({s.get("type","?")})')
