"""Otreeba / Open Cannabis API source adapter.

Fetches strain data from the free Otreeba REST API and yields normalized
StrainRecord dicts for the unified ingestion engine.

API: https://api.otreeba.com/v1/strains
Docs: https://otreeba.com/

Rate limit: 1 request/second with retry backoff.
Caches raw JSON responses in data/raw/otreeba/.
"""
import json
import ssl
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
RAW_DIR = ROOT / "data" / "raw" / "otreeba"

API_BASE = "https://api.otreeba.com/v1"
SOURCE_NAME = "otreeba"
REQUEST_DELAY = 1.0  # seconds between requests


def _fetch_json(url: str, retries: int = 3) -> dict | None:
    """Fetch JSON from a URL with retry and rate limiting."""
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={
                "User-Agent": "Cannalchemy/1.0 (strain-data-enrichment)",
                "Accept": "application/json",
            })
            opener = urllib.request.build_opener(urllib.request.HTTPSHandler(context=ctx))
            with opener.open(req, timeout=30) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError) as e:
            wait = 2 ** (attempt + 1)
            print(f"    Fetch error ({e}), retrying in {wait}s...")
            time.sleep(wait)
    return None


def _normalize_type(raw: str) -> str:
    """Normalize strain type string."""
    lower = (raw or "").lower().strip()
    if lower in ("indica", "sativa", "hybrid"):
        return lower
    if "indica" in lower:
        return "indica"
    if "sativa" in lower:
        return "sativa"
    return "hybrid"


def _parse_strain(data: dict) -> dict | None:
    """Parse an Otreeba strain object into a normalized StrainRecord."""
    name = (data.get("name") or "").strip()
    if not name:
        return None

    # Parse lineage/genetics
    lineage = data.get("lineage", {}) or {}
    genetics = ""
    if isinstance(lineage, dict):
        parents = list(lineage.values())
        if parents:
            genetics = " x ".join(str(p) for p in parents if p)

    # Parse terpenes (Otreeba sometimes includes these)
    terpenes = []
    terp_data = data.get("terpenes", {}) or {}
    if isinstance(terp_data, dict):
        from scripts.lib.ingest_helpers import map_terpene_name
        for terp_name, terp_val in terp_data.items():
            canonical = map_terpene_name(terp_name)
            if canonical:
                pct = 0.0
                if isinstance(terp_val, (int, float)):
                    pct = float(terp_val)
                elif isinstance(terp_val, str):
                    try:
                        pct = float(terp_val.replace("%", ""))
                    except ValueError:
                        pass
                if pct > 0:
                    terpenes.append({"name": canonical, "pct": pct})

    # Parse cannabinoids
    cannabinoids = {}
    for field, key in [("thc", "thc"), ("cbd", "cbd"), ("cbn", "cbn"), ("cbg", "cbg")]:
        val = data.get(field)
        if val is not None:
            try:
                fval = float(str(val).replace("%", ""))
                if fval > 0:
                    cannabinoids[key] = fval
            except (ValueError, TypeError):
                pass

    # Parse effects
    effects = []
    raw_effects = data.get("effects", []) or []
    if isinstance(raw_effects, list):
        from scripts.lib.ingest_helpers import map_effect_name
        for eff in raw_effects:
            eff_str = str(eff).strip() if eff else ""
            if eff_str:
                mapped = map_effect_name(eff_str)
                if mapped:
                    effects.append({"name": mapped[0], "category": mapped[1]})

    # Parse flavors
    flavors = []
    raw_flavors = data.get("flavors", []) or []
    if isinstance(raw_flavors, list):
        flavors = [str(f).strip().lower() for f in raw_flavors if f]

    return {
        "name": name,
        "strain_type": _normalize_type(data.get("type", "") or data.get("race", "")),
        "description": (data.get("desc") or data.get("description") or "")[:500],
        "genetics": genetics,
        "effects": effects,
        "flavors": flavors,
        "terpenes": terpenes,
        "cannabinoids": cannabinoids,
        "source": SOURCE_NAME,
        "source_id": str(data.get("ocpc", data.get("id", ""))),
    }


def fetch_strains(limit: int | None = None):
    """Generator that yields normalized StrainRecord dicts from Otreeba API.

    Paginates through the API, caching raw responses locally.
    """
    RAW_DIR.mkdir(parents=True, exist_ok=True)

    page = 0
    per_page = 50
    yielded = 0

    print(f"  Fetching from Otreeba API (limit={limit})...")

    while True:
        if limit is not None and yielded >= limit:
            break

        # Check cache first
        cache_file = RAW_DIR / f"page_{page}.json"
        if cache_file.exists():
            with open(cache_file, "r") as f:
                response = json.load(f)
        else:
            url = f"{API_BASE}/strains?page={page}&count={per_page}"
            print(f"    Fetching page {page}...")
            response = _fetch_json(url)
            time.sleep(REQUEST_DELAY)

            if response is None:
                print(f"    Failed to fetch page {page}, stopping.")
                break

            # Cache response
            with open(cache_file, "w") as f:
                json.dump(response, f)

        # Extract strains from response
        strains_data = response.get("data", response.get("strains", []))
        if isinstance(strains_data, dict):
            # Some API responses nest data differently
            strains_data = strains_data.get("strains", [])

        if not strains_data:
            print(f"    No more strains on page {page}, done.")
            break

        for strain_data in strains_data:
            if limit is not None and yielded >= limit:
                break

            record = _parse_strain(strain_data)
            if record:
                yielded += 1
                yield record

        # Check if there are more pages
        meta = response.get("meta", {})
        total_pages = meta.get("total_pages", meta.get("pagination", {}).get("total_pages", 0))
        if total_pages and page >= total_pages - 1:
            break

        page += 1

    print(f"  Otreeba: yielded {yielded} strain records")
