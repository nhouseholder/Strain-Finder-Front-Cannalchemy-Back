#!/usr/bin/env python3
"""Check strain_metadata table for genetics/lineage coverage."""
import sqlite3, json

DB = 'data/processed/cannalchemy.db'
db = sqlite3.connect(DB)
c = db.cursor()

# Schema
c.execute('PRAGMA table_info(strain_metadata)')
print('=== strain_metadata columns ===')
for col in c.fetchall():
    print(f'  {col[1]} ({col[2]})')

# Coverage
c.execute('SELECT COUNT(*) FROM strains')
total_strains = c.fetchone()[0]
c.execute('SELECT COUNT(*) FROM strain_metadata')
total_meta = c.fetchone()[0]
c.execute("SELECT COUNT(*) FROM strain_metadata WHERE genetics IS NOT NULL AND genetics != '' AND genetics != '0'")
has_genetics = c.fetchone()[0]
c.execute("SELECT COUNT(*) FROM strain_metadata WHERE lineage IS NOT NULL AND lineage != '' AND lineage != '{}'")
has_lineage = c.fetchone()[0]

print(f'\nTotal strains: {total_strains}')
print(f'Strains with metadata: {total_meta}')
print(f'With real genetics (not 0/empty): {has_genetics}')
print(f'With real lineage (not empty): {has_lineage}')

# Sample genetics values
print('\n=== Sample genetics values ===')
for r in c.execute("SELECT s.name, sm.genetics FROM strain_metadata sm JOIN strains s ON s.id = sm.strain_id WHERE sm.genetics IS NOT NULL AND sm.genetics != '' LIMIT 10"):
    print(f'  {r[0]}: {repr(r[1])[:100]}')

# Sample lineage values
print('\n=== Sample lineage values ===')
for r in c.execute("SELECT s.name, sm.lineage FROM strain_metadata sm JOIN strains s ON s.id = sm.strain_id WHERE sm.lineage IS NOT NULL AND sm.lineage != '' LIMIT 10"):
    print(f'  {r[0]}: {repr(r[1])[:150]}')

# Missing both
c.execute("""
    SELECT COUNT(*) FROM strains s
    LEFT JOIN strain_metadata sm ON s.id = sm.strain_id
    WHERE (sm.genetics IS NULL OR sm.genetics = '' OR sm.genetics = '0')
    AND s.source != 'enrichment-v5.17'
""")
missing_both = c.fetchone()[0]
print(f'\nFull strains missing real genetics: {missing_both}')

# Show some well-known ones missing lineage
print('\n=== Strains missing genetics (first 40) ===')
for r in c.execute("""
    SELECT s.name, sm.genetics, sm.lineage FROM strains s
    LEFT JOIN strain_metadata sm ON s.id = sm.strain_id
    WHERE (sm.genetics IS NULL OR sm.genetics = '' OR sm.genetics = '0')
    AND s.source != 'enrichment-v5.17'
    ORDER BY s.name
    LIMIT 40
"""):
    print(f'  {r[0]}: genetics={repr(r[1])}, lineage={repr(r[2])[:80]}')

db.close()
