"""Cannlytics API source adapter for terpene and cannabinoid enrichment.

Fetches lab-tested strain data from the free Cannlytics API and yields
normalized StrainRecord dicts. This is the highest-quality source for
terpene data (22 terpene fields + 10 cannabinoid fields from real lab tests).

API: https://cannlytics.com/api/data/strains
Docs: https://docs.cannlytics.com/api/data/strains/

Rate limit: 1 request/second with retry backoff.
Caches raw JSON responses in data/raw/cannlytics/.
"""
import json
import ssl
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT))

RAW_DIR = ROOT / "data" / "raw" / "cannlytics"
API_BASE = "https://cannlytics.com/api/data/strains"
SOURCE_NAME = "cannlytics"
REQUEST_DELAY = 1.0

# Cannlytics terpene field names → our canonical names
TERPENE_FIELD_MAP = {
    "alpha_bisabolol": "bisabolol",
    "alpha_pinene": "pinene",
    "alpha_terpinene": "terpineol",
    "beta_caryophyllene": "caryophyllene",
    "beta_myrcene": "myrcene",
    "beta_pinene": "pinene",
    "camphene": "camphene",
    "carene": "carene",
    "caryophyllene_oxide": "caryophyllene",
    "d_limonene": "limonene",
    "eucalyptol": "eucalyptol",
    "gamma_terpinene": "terpineol",
    "geraniol": "geraniol",
    "guaiol": "guaiol",
    "humulene": "humulene",
    "isopulegol": "isopulegol",
    "linalool": "linalool",
    "nerolidol": "nerolidol",
    "ocimene": "ocimene",
    "p_cymene": "cymene",
    "terpinene": "terpineol",
    "terpinolene": "terpinolene",
}

# Cannlytics cannabinoid field names → our canonical names
CANNABINOID_FIELD_MAP = {
    "cbc": "cbc",
    "cbd": "cbd",
    "cbda": "cbd",
    "cbg": "cbg",
    "cbga": "cbg",
    "cbn": "cbn",
    "delta_8_thc": "thc",
    "delta_9_thc": "thc",
    "thca": "thc",
    "thcv": "thcv",
    "total_thc": "thc",
    "total_cbd": "cbd",
    "total_cbg": "cbg",
}


def _fetch_json(url: str, retries: int = 3) -> dict | None:
    """Fetch JSON from URL with retry and SSL handling."""
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


def _parse_terpenes(data: dict) -> list[dict]:
    """Extract terpene profiles from Cannlytics strain data."""
    terpenes = {}  # canonical_name → best_value

    for field, canonical in TERPENE_FIELD_MAP.items():
        val = data.get(field)
        if val is None:
            continue
        try:
            pct = float(val)
        except (ValueError, TypeError):
            continue
        if pct <= 0:
            continue

        # Keep the highest value for duplicate canonical names
        if canonical not in terpenes or pct > terpenes[canonical]:
            terpenes[canonical] = pct

    # Sort by percentage descending
    return [
        {"name": name, "pct": round(pct, 3)}
        for name, pct in sorted(terpenes.items(), key=lambda x: x[1], reverse=True)
    ]


def _parse_cannabinoids(data: dict) -> dict[str, float]:
    """Extract cannabinoid values from Cannlytics strain data."""
    cannabinoids = {}

    # Prefer total_ fields over individual ones
    for field, canonical in CANNABINOID_FIELD_MAP.items():
        val = data.get(field)
        if val is None:
            continue
        try:
            pct = float(val)
        except (ValueError, TypeError):
            continue
        if pct <= 0:
            continue

        # total_ fields take priority
        is_total = field.startswith("total_")
        if canonical not in cannabinoids or is_total:
            cannabinoids[canonical] = round(pct, 1)

    return cannabinoids


def _parse_strain(data: dict) -> dict | None:
    """Parse a Cannlytics strain record into a normalized StrainRecord."""
    name = (data.get("strain_name") or data.get("name") or "").strip()
    if not name:
        return None

    terpenes = _parse_terpenes(data)
    cannabinoids = _parse_cannabinoids(data)

    # Skip records with no useful chemical data
    if not terpenes and not cannabinoids:
        return None

    # Try to determine strain type
    strain_type = "hybrid"
    raw_type = (data.get("strain_type") or data.get("type") or "").lower()
    if raw_type in ("indica", "sativa", "hybrid"):
        strain_type = raw_type

    return {
        "name": name,
        "strain_type": strain_type,
        "description": "",
        "genetics": "",
        "effects": [],
        "flavors": [],
        "terpenes": terpenes,
        "cannabinoids": cannabinoids,
        "source": SOURCE_NAME,
        "source_id": str(data.get("id", "")),
    }


def fetch_strains(limit: int | None = None):
    """Generator that yields normalized StrainRecord dicts from Cannlytics API.

    Paginates through the API, caching raw responses locally.
    """
    RAW_DIR.mkdir(parents=True, exist_ok=True)

    page = 1
    per_page = 50
    yielded = 0

    print(f"  Fetching from Cannlytics API (limit={limit})...")

    while True:
        if limit is not None and yielded >= limit:
            break

        # Check cache first
        cache_file = RAW_DIR / f"page_{page}.json"
        if cache_file.exists():
            with open(cache_file, "r") as f:
                response = json.load(f)
        else:
            url = f"{API_BASE}?page={page}&limit={per_page}"
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
        strains_data = response.get("data", [])
        if isinstance(strains_data, dict):
            strains_data = list(strains_data.values()) if strains_data else []

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

        # Check for more pages
        if len(strains_data) < per_page:
            break

        page += 1

    print(f"  Cannlytics: yielded {yielded} strain records")
