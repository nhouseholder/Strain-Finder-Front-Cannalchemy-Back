"""Fix strain descriptions in the database.

Replaces scraped seed-bank marketing copy, "Bud Basics" junk, NULL values,
and stale auto-generated descriptions with clean, useful summaries built
from each strain's actual data (type, effects, terpenes, genetics, cannabinoids).

Usage:
    python3 scripts/fix_strain_descriptions.py
"""
import json
import sqlite3
import random
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "data" / "processed" / "cannalchemy.db"

# Terpene flavor/aroma associations
TERPENE_NOTES = {
    "myrcene": "earthy, musky",
    "limonene": "citrus, lemon",
    "caryophyllene": "peppery, spicy",
    "linalool": "floral, lavender",
    "pinene": "pine, fresh",
    "terpinolene": "fruity, herbal",
    "humulene": "hoppy, woody",
    "ocimene": "sweet, herbal",
    "bisabolol": "floral, gentle",
    "valencene": "citrus, orange",
    "camphene": "herbal, woody",
    "geraniol": "rose, floral",
    "nerolidol": "woody, floral",
    "borneol": "minty, herbal",
    "fenchol": "basil, herbal",
    "farnesene": "green apple",
    "terpineol": "lilac, piney",
    "guaiol": "woody, piney",
}

# Effect display names
EFFECT_DISPLAY = {
    "relaxed": "relaxation", "happy": "happiness", "euphoric": "euphoria",
    "uplifted": "uplift", "creative": "creativity", "energetic": "energy",
    "focused": "focus", "sleepy": "sleep", "hungry": "appetite",
    "talkative": "sociability", "giggly": "giggles", "tingly": "body tingles",
    "aroused": "arousal", "calm": "calm", "body-high": "body effects",
    "head-high": "cerebral effects", "motivated": "motivation",
    "pain": "pain relief", "stress": "stress relief", "anxiety": "anxiety relief",
    "insomnia": "sleep aid", "inflammation": "inflammation relief",
}

# Type display
TYPE_DISPLAY = {"indica": "indica", "sativa": "sativa", "hybrid": "hybrid"}


def build_description(name, strain_type, effects, terpenes, genetics, cannabinoids):
    """Build a clean, useful 1-2 sentence description."""
    raw_type = TYPE_DISPLAY.get(strain_type, "hybrid")
    # Correct article: "an indica", "a sativa", "a hybrid"
    article = "an" if raw_type == "indica" else "a"
    stype = raw_type
    stype_with_article = f"{article} {raw_type}"

    # Get top 3 unique positive effects
    pos_effects = [e for e in effects if e.get("category", "positive") == "positive"]
    effect_names = []
    seen_display = set()
    for e in pos_effects:
        ename = e.get("name", "")
        display = EFFECT_DISPLAY.get(ename, ename.replace("-", " "))
        if display and display not in seen_display:
            effect_names.append(display)
            seen_display.add(display)
        if len(effect_names) >= 3:
            break

    # Get dominant terpene
    top_terp = terpenes[0] if terpenes else None
    terp_note = ""
    if top_terp:
        tname = top_terp.get("name", "")
        terp_note = TERPENE_NOTES.get(tname, "")

    # Get THC
    thc_val = None
    for c in cannabinoids:
        if c.get("name") == "thc":
            thc_val = c.get("value")
            break

    # Build the description
    parts = []

    # Sentence 1: Type + dominant experience
    if effect_names:
        effects_str = ", ".join(effect_names[:2])
        if len(effect_names) > 2:
            effects_str += f", and {effect_names[2]}"
        parts.append(f"{name} is {stype_with_article} known for {effects_str}.")
    else:
        parts.append(f"{name} is {stype_with_article} strain.")

    # Sentence 2: Terpene profile + aroma hint + THC if notable
    details = []
    if top_terp and terp_note:
        tname = top_terp.get("name", "").capitalize()
        details.append(f"{tname}-dominant with {terp_note} notes")
    if genetics and genetics.lower() not in ("null", "unknown", name.lower()):
        # Skip genetics that are just numeric IDs (e.g., "9,39")
        import re
        if not re.match(r'^[\d,\s]+$', genetics):
            gen = genetics if len(genetics) < 60 else genetics[:57] + "..."
            details.append(gen)
    if thc_val and thc_val > 5:
        details.append(f"~{round(thc_val)}% THC")

    if details:
        parts.append(" · ".join(details) + ".")

    desc = " ".join(parts)
    # Cap at 160 chars for the short description field
    if len(desc) > 160:
        desc = desc[:157] + "..."
    return desc


def needs_fix(desc, force_all=False):
    """Check if a description needs replacement."""
    if not desc or desc.strip() == "" or desc.strip().upper() == "NULL":
        return True
    if "Bud Basics" in desc:
        return True
    if "Feminized" in desc or "feminized" in desc:
        return True
    if "Limited Release" in desc:
        return True
    if "Seeds" in desc and ("Cannabis Seeds" in desc or "seeds" in desc.lower()):
        return True
    # Auto-generated descriptions with potentially stale THC values
    # Pattern: "X is a Y strain with Z% THC"
    if " is a " in desc and "strain with" in desc and "% THC" in desc:
        return True
    # Descriptions from first run with "a a" / "a an" grammar bug
    if force_all and (" is a a " in desc or " is a an " in desc):
        return True
    return False


def fix_descriptions():
    conn = sqlite3.connect(str(DB_PATH))

    # Get molecule IDs
    mol_ids = {}
    for row in conn.execute("SELECT id, name FROM molecules"):
        mol_ids[row[1]] = row[0]

    # Process all strains
    strain_rows = conn.execute("""
        SELECT s.id, s.name, s.strain_type, s.description
        FROM strains s
        ORDER BY s.id
    """).fetchall()

    fixed = 0
    skipped = 0
    total_checked = 0

    for strain_id, name, strain_type, old_desc in strain_rows:
        old_desc = old_desc or ""

        if not needs_fix(old_desc, force_all=True):  # force_all catches first-run bad descriptions
            skipped += 1
            continue

        total_checked += 1

        # Get effects
        effects = []
        for row in conn.execute(
            "SELECT e.name, e.category, er.report_count, er.confidence "
            "FROM effect_reports er JOIN effects e ON e.id = er.effect_id "
            "WHERE er.strain_id = ? ORDER BY er.report_count DESC",
            (strain_id,)
        ):
            effects.append({"name": row[0], "category": row[1] or "positive",
                            "reports": row[2], "confidence": row[3]})

        # Get terpenes
        terpenes = []
        for row in conn.execute(
            "SELECT m.name, sc.percentage FROM strain_compositions sc "
            "JOIN molecules m ON m.id = sc.molecule_id "
            "WHERE sc.strain_id = ? AND m.molecule_type = 'terpene' "
            "ORDER BY sc.percentage DESC",
            (strain_id,)
        ):
            terpenes.append({"name": row[0], "pct": row[1]})

        # Get cannabinoids
        cannabinoids = []
        for row in conn.execute(
            "SELECT m.name, sc.percentage FROM strain_compositions sc "
            "JOIN molecules m ON m.id = sc.molecule_id "
            "WHERE sc.strain_id = ? AND m.molecule_type = 'cannabinoid' "
            "ORDER BY sc.percentage DESC",
            (strain_id,)
        ):
            cannabinoids.append({"name": row[0], "value": round(row[1], 1)})

        # Get genetics from metadata
        meta = conn.execute(
            "SELECT genetics FROM strain_metadata WHERE strain_id = ?",
            (strain_id,)
        ).fetchone()
        genetics = meta[0] if meta else ""

        new_desc = build_description(name, strain_type or "hybrid", effects,
                                     terpenes, genetics, cannabinoids)

        # Update both description and description_extended in the DB
        conn.execute("UPDATE strains SET description = ? WHERE id = ?",
                     (new_desc, strain_id))
        # Update metadata description_extended too
        conn.execute(
            "UPDATE strain_metadata SET description_extended = ? WHERE strain_id = ?",
            (new_desc, strain_id)
        )

        fixed += 1
        if fixed <= 20:
            print(f"  FIX: {name}")
            print(f"    OLD: {old_desc[:100]}")
            print(f"    NEW: {new_desc[:140]}")
            print()

    if fixed > 20:
        print(f"  ... and {fixed - 20} more\n")

    conn.commit()
    conn.close()

    print(f"Summary:")
    print(f"  Fixed: {fixed} strains")
    print(f"  Already OK: {skipped} strains")
    print(f"  Total: {len(strain_rows)} strains")


if __name__ == "__main__":
    fix_descriptions()
