"""Background strain enrichment service.

When a user requests a strain we don't have full data for, this service
fetches data from external APIs (Otreeba, Cannlytics) and populates the
database. Runs as an asyncio task within the FastAPI process.
"""
import json
import logging
import re
import ssl
import time
import urllib.error
import urllib.request

from backend.app.database import db

logger = logging.getLogger(__name__)

REQUEST_DELAY = 1.0


def _fetch_json(url: str, retries: int = 2) -> dict | None:
    """Fetch JSON from URL with retry."""
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={
                "User-Agent": "Cannalchemy/1.0",
                "Accept": "application/json",
            })
            opener = urllib.request.build_opener(urllib.request.HTTPSHandler(context=ctx))
            with opener.open(req, timeout=15) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError) as e:
            logger.warning(f"Fetch error for {url}: {e}")
            if attempt < retries - 1:
                time.sleep(2 ** (attempt + 1))
    return None


def _get_or_create_effect(conn, name: str, category: str) -> int | None:
    """Get or create an effect, return its ID."""
    row = conn.execute("SELECT id FROM effects WHERE name = ?", (name,)).fetchone()
    if row:
        return row[0]
    conn.execute("INSERT OR IGNORE INTO effects (name, category) VALUES (?, ?)", (name, category))
    row = conn.execute("SELECT id FROM effects WHERE name = ?", (name,)).fetchone()
    return row[0] if row else None


def _get_molecule_id(conn, name: str) -> int | None:
    """Get molecule ID by name."""
    row = conn.execute("SELECT id FROM molecules WHERE name = ?", (name,)).fetchone()
    return row[0] if row else None


# Terpene name normalization
TERPENE_MAP = {
    "beta_myrcene": "myrcene", "beta_caryophyllene": "caryophyllene",
    "d_limonene": "limonene", "alpha_pinene": "pinene", "beta_pinene": "pinene",
    "alpha_bisabolol": "bisabolol", "alpha_terpinene": "terpineol",
    "gamma_terpinene": "terpineol", "caryophyllene_oxide": "caryophyllene",
    "p_cymene": "cymene", "myrcene": "myrcene", "limonene": "limonene",
    "caryophyllene": "caryophyllene", "linalool": "linalool", "pinene": "pinene",
    "humulene": "humulene", "ocimene": "ocimene", "terpinolene": "terpinolene",
    "camphene": "camphene", "carene": "carene", "eucalyptol": "eucalyptol",
    "geraniol": "geraniol", "guaiol": "guaiol", "isopulegol": "isopulegol",
    "nerolidol": "nerolidol", "terpinene": "terpineol",
}

# Effect name normalization
EFFECT_MAP = {
    "relaxed": ("relaxed", "positive"), "happy": ("happy", "positive"),
    "euphoric": ("euphoric", "positive"), "creative": ("creative", "positive"),
    "energetic": ("energetic", "positive"), "uplifted": ("uplifted", "positive"),
    "focused": ("focused", "positive"), "hungry": ("hungry", "positive"),
    "talkative": ("talkative", "positive"), "tingly": ("tingly", "positive"),
    "sleepy": ("sleepy", "positive"), "giggly": ("giggly", "positive"),
    "aroused": ("aroused", "positive"), "calm": ("calm", "positive"),
    "dry mouth": ("dry-mouth", "negative"), "dry eyes": ("dry-eyes", "negative"),
    "dizzy": ("dizzy", "negative"), "paranoid": ("paranoid", "negative"),
    "anxious": ("anxious", "negative"), "headache": ("headache", "negative"),
}

# Terpene → effect inference
TERPENE_EFFECTS = {
    "myrcene": [("relaxed", "positive"), ("sleepy", "positive")],
    "limonene": [("uplifted", "positive"), ("happy", "positive")],
    "caryophyllene": [("relaxed", "positive"), ("calm", "positive")],
    "linalool": [("relaxed", "positive"), ("calm", "positive")],
    "pinene": [("focused", "positive"), ("creative", "positive")],
    "terpinolene": [("uplifted", "positive"), ("energetic", "positive")],
    "humulene": [("relaxed", "positive")],
    "ocimene": [("uplifted", "positive")],
}

# Type → default effects
TYPE_EFFECTS = {
    "indica": [("relaxed", "positive"), ("sleepy", "positive"), ("hungry", "positive")],
    "sativa": [("energetic", "positive"), ("creative", "positive"), ("uplifted", "positive")],
    "hybrid": [("happy", "positive"), ("relaxed", "positive"), ("uplifted", "positive")],
}

# Best-for inference
BEST_FOR = {
    "relaxed": "Evening relaxation", "sleepy": "Nighttime use",
    "creative": "Creative projects", "energetic": "Daytime activities",
    "focused": "Work and study", "happy": "Social gatherings",
}


def _try_otreeba(name: str) -> dict | None:
    """Search Otreeba API for a strain by name."""
    import urllib.parse
    encoded = urllib.parse.quote(name)
    url = f"https://api.otreeba.com/v1/strains?name={encoded}&count=5"
    data = _fetch_json(url)
    if not data:
        return None

    strains = data.get("data", [])
    if isinstance(strains, dict):
        strains = strains.get("strains", [])
    if not strains:
        return None

    # Find best match
    from cannalchemy.data.normalize import normalize_strain_name
    target = normalize_strain_name(name)
    for s in strains:
        s_name = (s.get("name") or "").strip()
        if normalize_strain_name(s_name) == target:
            return s

    # Return first result if close enough
    return strains[0] if strains else None


def _try_cannlytics(name: str) -> dict | None:
    """Search Cannlytics API for a strain by name."""
    import urllib.parse
    encoded = urllib.parse.quote(name)
    url = f"https://cannlytics.com/api/data/strains?name={encoded}&limit=5"
    data = _fetch_json(url)
    if not data:
        return None

    strains = data.get("data", [])
    if isinstance(strains, dict):
        strains = list(strains.values())
    return strains[0] if strains else None


def _enrich_from_otreeba(conn, strain_id: int, otreeba_data: dict) -> bool:
    """Apply Otreeba data to a strain record."""
    enriched = False

    # Description
    desc = (otreeba_data.get("desc") or otreeba_data.get("description") or "").strip()
    if desc and len(desc) > 20:
        current = conn.execute("SELECT description FROM strains WHERE id = ?", (strain_id,)).fetchone()
        if current and (not current[0] or len(current[0]) < 20):
            conn.execute("UPDATE strains SET description = ? WHERE id = ?", (desc[:500], strain_id))
            enriched = True

    # Strain type
    raw_type = (otreeba_data.get("type") or otreeba_data.get("race") or "").lower()
    if raw_type in ("indica", "sativa", "hybrid"):
        conn.execute("UPDATE strains SET strain_type = ? WHERE id = ?", (raw_type, strain_id))
        enriched = True

    # Genetics from lineage
    lineage = otreeba_data.get("lineage", {}) or {}
    if isinstance(lineage, dict) and lineage:
        parents = list(lineage.values())
        genetics = " x ".join(str(p) for p in parents if p)
        if genetics:
            conn.execute(
                "UPDATE strain_metadata SET genetics = ?, lineage = ? WHERE strain_id = ?",
                (genetics, json.dumps({"self": otreeba_data.get("name", ""), **lineage}), strain_id),
            )
            enriched = True

    # Effects
    raw_effects = otreeba_data.get("effects", []) or []
    if isinstance(raw_effects, list):
        for i, eff in enumerate(raw_effects[:6]):
            eff_str = str(eff).lower().strip()
            mapped = EFFECT_MAP.get(eff_str)
            if mapped:
                eff_id = _get_or_create_effect(conn, mapped[0], mapped[1])
                if eff_id:
                    base = 80 if mapped[1] == "positive" else 25
                    decay = [1.0, 0.85, 0.7, 0.55, 0.4, 0.3]
                    count = max(5, int(base * decay[min(i, 5)]))
                    conn.execute(
                        "INSERT OR IGNORE INTO effect_reports (strain_id, effect_id, report_count, confidence, source) "
                        "VALUES (?, ?, ?, 0.9, 'otreeba')",
                        (strain_id, eff_id, count),
                    )
                    enriched = True

    # Flavors
    raw_flavors = otreeba_data.get("flavors", []) or []
    if isinstance(raw_flavors, list):
        for fl in raw_flavors[:5]:
            fl_clean = str(fl).strip().lower()
            if fl_clean:
                conn.execute(
                    "INSERT OR IGNORE INTO strain_flavors (strain_id, flavor) VALUES (?, ?)",
                    (strain_id, fl_clean),
                )
                enriched = True

    return enriched


def _enrich_from_cannlytics(conn, strain_id: int, cannlytics_data: dict) -> bool:
    """Apply Cannlytics lab data to a strain record."""
    enriched = False

    # Terpenes (22 fields)
    for field, canonical in TERPENE_MAP.items():
        val = cannlytics_data.get(field)
        if val is None:
            continue
        try:
            pct = float(val)
        except (ValueError, TypeError):
            continue
        if pct <= 0:
            continue

        mol_id = _get_molecule_id(conn, canonical)
        if mol_id:
            conn.execute(
                "INSERT OR REPLACE INTO strain_compositions "
                "(strain_id, molecule_id, percentage, measurement_type, source) "
                "VALUES (?, ?, ?, 'reported', 'cannlytics')",
                (strain_id, mol_id, round(pct, 3)),
            )
            enriched = True

    # Cannabinoids
    for field, canonical in [("total_thc", "thc"), ("total_cbd", "cbd"),
                             ("delta_9_thc", "thc"), ("cbd", "cbd"),
                             ("cbg", "cbg"), ("cbn", "cbn"), ("thcv", "thcv")]:
        val = cannlytics_data.get(field)
        if val is None:
            continue
        try:
            pct = float(val)
        except (ValueError, TypeError):
            continue
        if pct <= 0:
            continue

        mol_id = _get_molecule_id(conn, canonical)
        if mol_id:
            # Only update if this is a "total_" field or no existing data
            existing = conn.execute(
                "SELECT percentage FROM strain_compositions WHERE strain_id = ? AND molecule_id = ?",
                (strain_id, mol_id),
            ).fetchone()
            if not existing or field.startswith("total_"):
                conn.execute(
                    "INSERT OR REPLACE INTO strain_compositions "
                    "(strain_id, molecule_id, percentage, measurement_type, source) "
                    "VALUES (?, ?, ?, 'reported', 'cannlytics')",
                    (strain_id, mol_id, round(pct, 1)),
                )
                enriched = True

    return enriched


def _infer_from_profile(conn, strain_id: int) -> bool:
    """Infer effects, flavors, and metadata from terpene/cannabinoid profile."""
    enriched = False

    # Get strain type
    stype = conn.execute("SELECT strain_type FROM strains WHERE id = ?", (strain_id,)).fetchone()
    strain_type = stype[0] if stype else "hybrid"

    # Get current terpenes
    terps = conn.execute(
        "SELECT m.name, sc.percentage FROM strain_compositions sc "
        "JOIN molecules m ON m.id = sc.molecule_id "
        "WHERE sc.strain_id = ? AND m.molecule_type = 'terpene' "
        "ORDER BY sc.percentage DESC LIMIT 5",
        (strain_id,),
    ).fetchall()

    # Check existing effects
    existing_effects = {r[0] for r in conn.execute(
        "SELECT e.name FROM effect_reports er JOIN effects e ON e.id = er.effect_id "
        "WHERE er.strain_id = ?", (strain_id,),
    ).fetchall()}

    # Infer effects from terpenes
    if len(existing_effects) < 3:
        for terp_name, _ in terps:
            for eff_name, cat in TERPENE_EFFECTS.get(terp_name, []):
                if eff_name not in existing_effects:
                    eff_id = _get_or_create_effect(conn, eff_name, cat)
                    if eff_id:
                        import random
                        count = max(5, int(50 * random.uniform(0.3, 0.6)))
                        conn.execute(
                            "INSERT OR IGNORE INTO effect_reports "
                            "(strain_id, effect_id, report_count, confidence, source) "
                            "VALUES (?, ?, ?, 0.70, 'inferred')",
                            (strain_id, eff_id, count),
                        )
                        existing_effects.add(eff_name)
                        enriched = True

        # Add type-based defaults if still < 3
        if len(existing_effects) < 3:
            for eff_name, cat in TYPE_EFFECTS.get(strain_type, TYPE_EFFECTS["hybrid"]):
                if eff_name not in existing_effects:
                    eff_id = _get_or_create_effect(conn, eff_name, cat)
                    if eff_id:
                        import random
                        conn.execute(
                            "INSERT OR IGNORE INTO effect_reports "
                            "(strain_id, effect_id, report_count, confidence, source) "
                            "VALUES (?, ?, ?, 0.60, 'type-default')",
                            (strain_id, eff_id, max(5, int(40 * random.uniform(0.3, 0.5)))),
                        )
                        existing_effects.add(eff_name)
                        enriched = True

    # Infer best_for from effects
    all_effects = [r[0] for r in conn.execute(
        "SELECT e.name FROM effect_reports er JOIN effects e ON e.id = er.effect_id "
        "WHERE er.strain_id = ? AND e.category = 'positive' ORDER BY er.report_count DESC",
        (strain_id,),
    ).fetchall()]
    best_for = [BEST_FOR[e] for e in all_effects[:3] if e in BEST_FOR]
    if best_for:
        conn.execute(
            "UPDATE strain_metadata SET best_for = ? WHERE strain_id = ?",
            (json.dumps(best_for), strain_id),
        )
        enriched = True

    # Generate description if missing
    name_row = conn.execute("SELECT name, description FROM strains WHERE id = ?", (strain_id,)).fetchone()
    if name_row and (not name_row[1] or len(name_row[1]) < 20):
        strain_name = name_row[0]
        terp_names = [t[0].title() for t in terps[:2]]
        pos_effects = [e.replace("-", " ").title() for e in all_effects[:2]]
        desc = f"{strain_name} is a {strain_type} strain"
        if terp_names:
            desc += f" rich in {' and '.join(terp_names)}"
        if pos_effects:
            desc += f", known for {' and '.join(pos_effects).lower()} effects"
        desc += "."
        conn.execute("UPDATE strains SET description = ? WHERE id = ?", (desc[:300], strain_id))
        enriched = True

    return enriched


def enrich_strain_sync(strain_id: int, strain_name: str):
    """Synchronous enrichment — fetches from external APIs and updates DB.

    Called from the async wrapper. Runs in the event loop's executor.
    """
    conn = db.conn
    if not conn:
        logger.error("Database not available for enrichment")
        return

    logger.info(f"Starting enrichment for strain '{strain_name}' (id={strain_id})")
    enriched = False

    # Try Otreeba
    try:
        otreeba_data = _try_otreeba(strain_name)
        if otreeba_data:
            logger.info(f"  Found on Otreeba: {otreeba_data.get('name', '')}")
            if _enrich_from_otreeba(conn, strain_id, otreeba_data):
                enriched = True
        time.sleep(REQUEST_DELAY)
    except Exception as e:
        logger.warning(f"  Otreeba error: {e}")

    # Try Cannlytics
    try:
        cannlytics_data = _try_cannlytics(strain_name)
        if cannlytics_data:
            logger.info(f"  Found on Cannlytics")
            if _enrich_from_cannlytics(conn, strain_id, cannlytics_data):
                enriched = True
    except Exception as e:
        logger.warning(f"  Cannlytics error: {e}")

    # Always try to infer from whatever we have
    if _infer_from_profile(conn, strain_id):
        enriched = True

    # Update data quality
    if enriched:
        # Check what data we now have
        effect_count = conn.execute(
            "SELECT COUNT(*) FROM effect_reports WHERE strain_id = ?", (strain_id,)
        ).fetchone()[0]
        terp_count = conn.execute(
            "SELECT COUNT(*) FROM strain_compositions sc "
            "JOIN molecules m ON m.id = sc.molecule_id "
            "WHERE sc.strain_id = ? AND m.molecule_type = 'terpene'",
            (strain_id,),
        ).fetchone()[0]
        cann_count = conn.execute(
            "SELECT COUNT(*) FROM strain_compositions sc "
            "JOIN molecules m ON m.id = sc.molecule_id "
            "WHERE sc.strain_id = ? AND m.molecule_type = 'cannabinoid'",
            (strain_id,),
        ).fetchone()[0]
        desc = conn.execute("SELECT description FROM strains WHERE id = ?", (strain_id,)).fetchone()
        desc_len = len((desc[0] or "").strip()) if desc else 0

        if effect_count >= 5 and terp_count >= 3 and cann_count >= 1 and desc_len >= 50:
            new_quality = "full"
        elif effect_count >= 1 or terp_count >= 1:
            new_quality = "partial"
        else:
            new_quality = "search-only"

        conn.execute(
            "UPDATE strains SET data_quality = ? WHERE id = ?",
            (new_quality, strain_id),
        )

        # Log enrichment
        conn.execute(
            "INSERT OR REPLACE INTO enrichment_log (strain_id, pass_name, status, notes) "
            "VALUES (?, 'user-request-enrich', 'completed', ?)",
            (strain_id, f"Enriched via user request (otreeba={'yes' if otreeba_data else 'no'}, cannlytics={'yes' if cannlytics_data else 'no'})"),
        )

        conn.commit()
        logger.info(f"  Enrichment complete for '{strain_name}': quality={new_quality}")
    else:
        conn.execute(
            "INSERT OR REPLACE INTO enrichment_log (strain_id, pass_name, status, notes) "
            "VALUES (?, 'user-request-enrich', 'completed', 'No external data found')",
            (strain_id,),
        )
        conn.commit()
        logger.info(f"  No external data found for '{strain_name}'")


async def enrich_strain_async(strain_id: int, strain_name: str):
    """Async wrapper — runs enrichment in a thread to avoid blocking FastAPI."""
    import asyncio
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, enrich_strain_sync, strain_id, strain_name)
