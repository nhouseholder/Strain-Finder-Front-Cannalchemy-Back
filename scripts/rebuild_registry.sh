#!/usr/bin/env bash
# rebuild_registry.sh — One-command strain registry rebuild
#
# Runs the full pipeline: bootstrap DB → migrate originals →
# import Kushy → import Cannabis Intelligence → quality filter → export.
#
# Usage:
#   bash scripts/rebuild_registry.sh
#
# Run monthly to refresh the registry with any new strains.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
DB_PATH="$ROOT_DIR/data/processed/cannalchemy.db"

echo "╔══════════════════════════════════════════════════════════╗"
echo "║           STRAIN REGISTRY REBUILD                       ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "Project root: $ROOT_DIR"
echo "Database:     $DB_PATH"
echo ""

# Step 0: Back up existing database
if [ -f "$DB_PATH" ]; then
    BACKUP="$DB_PATH.backup.$(date +%Y%m%d_%H%M%S)"
    cp "$DB_PATH" "$BACKUP"
    echo "✓ Backed up database to $(basename "$BACKUP")"
fi

# Step 1: Bootstrap (creates schema, seeds molecules/receptors/effects)
echo ""
echo "━━━ Step 1/6: Bootstrap Database ━━━"
# Remove old DB to start fresh
rm -f "$DB_PATH" "$DB_PATH-shm" "$DB_PATH-wal"
python3 "$SCRIPT_DIR/bootstrap_db.py" "$DB_PATH"

# Step 2: Migrate original Strain Finder strains (77 high-quality)
echo ""
echo "━━━ Step 2/6: Migrate Original Strains ━━━"
python3 "$SCRIPT_DIR/migrate_sf_strains.py" "$DB_PATH"

# Step 3: Import Kushy dataset (~4,000 strains)
echo ""
echo "━━━ Step 3/6: Import Kushy Dataset ━━━"
python3 "$SCRIPT_DIR/import_kushy.py" "$DB_PATH"

# Step 4: Import Cannabis Intelligence (gap-fill)
echo ""
echo "━━━ Step 4/6: Import Cannabis Intelligence ━━━"
python3 "$SCRIPT_DIR/import_cannabis_intel.py" "$DB_PATH"

# Step 5: Quality filter (dedup, cap outliers, fill gaps)
echo ""
echo "━━━ Step 5/6: Quality Filter ━━━"
python3 "$SCRIPT_DIR/quality_filter.py" "$DB_PATH"

# Step 6: Export to strain-data.js + strains.json
echo ""
echo "━━━ Step 6/6: Export ━━━"
python3 "$SCRIPT_DIR/export_strain_data.py" "$DB_PATH"

# Summary
echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║           REBUILD COMPLETE                              ║"
echo "╚══════════════════════════════════════════════════════════╝"

STRAIN_COUNT=$(python3 -c "import sqlite3; c=sqlite3.connect('$DB_PATH'); print(c.execute('SELECT COUNT(*) FROM strains').fetchone()[0])")
JS_SIZE=$(wc -c < "$ROOT_DIR/frontend/netlify/functions/strain-data.js" | tr -d ' ')

echo ""
echo "  Strains in DB:     $STRAIN_COUNT"
echo "  strain-data.js:    $JS_SIZE bytes ($(echo "scale=2; $JS_SIZE / 1000000" | bc) MB)"
echo "  Database:          $(wc -c < "$DB_PATH" | tr -d ' ') bytes"
echo ""
echo "  Next: cd frontend && npm run build && npx netlify deploy --prod"
echo ""
