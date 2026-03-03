#!/usr/bin/env python3
"""Fill genetics for remaining strains using Workers AI (Llama 3.3 70B)."""
import json
import os
import re
import sqlite3
import ssl
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from cannalchemy.data.normalize import normalize_strain_name

DB_PATH = str(ROOT / "data" / "processed" / "cannalchemy.db")
ACCOUNT_ID = "e246c909cd0c462975902369c8aa7512"
MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast"
API_URL = f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/ai/run/{MODEL}"


def get_cf_token():
    import tomllib
    config_path = Path.home() / ".wrangler" / "config" / "default.toml"
    if not config_path.exists():
        return None
    with open(config_path, "rb") as f:
        cfg = tomllib.load(f)
    return cfg.get("oauth_token")


def call_workers_ai(prompt, token, max_tokens=2000):
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    body = json.dumps({
        "messages": [
            {"role": "system", "content": "You are a cannabis genetics expert. Return ONLY valid JSON. No markdown fences, no explanation text."},
            {"role": "user", "content": prompt},
        ],
        "max_tokens": max_tokens,
    }).encode()

    req = urllib.request.Request(API_URL, data=body, headers={
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    })

    try:
        opener = urllib.request.build_opener(urllib.request.HTTPSHandler(context=ctx))
        with opener.open(req, timeout=45) as resp:
            data = json.loads(resp.read())
        if data.get("success"):
            result = data.get("result", {})
            response = result.get("response", "")
            if isinstance(response, dict):
                return json.dumps(response)
            if isinstance(response, str):
                return response.strip()
    except Exception as e:
        print(f"  API error: {e}")
    return ""


def parse_ai_response(raw):
    """Try to extract JSON from AI response."""
    if not raw:
        return {}
    # Strip markdown code fences
    clean = re.sub(r"^```(?:json)?\s*\n?", "", raw)
    clean = re.sub(r"\n?```\s*$", "", clean)
    clean = clean.strip()
    try:
        parsed = json.loads(clean)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        # Try to find JSON object in the response
        match = re.search(r"\{[\s\S]+\}", clean)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                pass
    return {}


def main():
    token = get_cf_token()
    if not token:
        print("ERROR: No Cloudflare token found")
        sys.exit(1)

    # Quick test
    print("Testing Workers AI connection...")
    test = call_workers_ai("Return exactly: {\"test\": true}", token, max_tokens=20)
    if not test:
        print("ERROR: Workers AI not reachable")
        sys.exit(1)
    print(f"  OK: {test[:50]}")

    conn = sqlite3.connect(DB_PATH)

    # Get strains missing genetics
    missing = conn.execute("""
        SELECT s.id, s.name, s.normalized_name, s.strain_type
        FROM strains s
        JOIN strain_metadata sm ON sm.strain_id = s.id
        WHERE sm.genetics IS NULL OR sm.genetics = ''
        ORDER BY s.name
    """).fetchall()

    print(f"\nStrains missing genetics: {len(missing)}")

    # Process in batches of 20
    BATCH_SIZE = 20
    total_updated = 0
    total_lineage = 0

    for i in range(0, len(missing), BATCH_SIZE):
        batch = missing[i:i+BATCH_SIZE]
        names = [row[1] for row in batch]
        names_str = "\n".join(f"- {n}" for n in names)

        prompt = (
            f"For each cannabis strain below, provide its genetic cross/lineage.\n"
            f"Return a JSON object where each key is the exact strain name and each value is an object with:\n"
            f'- "genetics": string describing the cross (e.g. "OG Kush × Durban Poison")\n'
            f'- "parents": array of parent strain names\n'
            f'- "type": "indica", "sativa", or "hybrid"\n\n'
            f"If you genuinely don't know a strain's genetics, set genetics to \"\" and parents to [].\n"
            f"Do NOT guess or make up genetics.\n\n"
            f"Strains:\n{names_str}"
        )

        raw = call_workers_ai(prompt, token, max_tokens=2500)
        parsed = parse_ai_response(raw)

        batch_updated = 0
        for sid, name, norm, stype in batch:
            data = parsed.get(name) or parsed.get(name.title()) or parsed.get(name.lower())
            if not data or not isinstance(data, dict):
                continue

            genetics = data.get("genetics", "")
            parents = data.get("parents", [])
            ai_type = data.get("type", "")

            if not genetics or len(genetics) < 3:
                continue

            # Sanity check — skip if looks made up (too generic)
            if genetics.lower() in ("unknown", "n/a", "not available", "unknown genetics"):
                continue

            # Update genetics
            conn.execute("UPDATE strain_metadata SET genetics = ? WHERE strain_id = ?",
                         (genetics, sid))
            batch_updated += 1
            total_updated += 1

            # Update lineage
            if parents and isinstance(parents, list) and len(parents) > 0:
                existing_lin = conn.execute("SELECT lineage FROM strain_metadata WHERE strain_id = ?",
                                            (sid,)).fetchone()
                try:
                    lin = json.loads(existing_lin[0]) if existing_lin and existing_lin[0] else {}
                except:
                    lin = {}
                if not lin.get("parents"):
                    lin["self"] = name
                    lin["parents"] = parents
                    conn.execute("UPDATE strain_metadata SET lineage = ? WHERE strain_id = ?",
                                 (json.dumps(lin), sid))
                    total_lineage += 1

            # Update type if unknown
            if stype == "unknown" and ai_type in ("indica", "sativa", "hybrid"):
                conn.execute("UPDATE strains SET strain_type = ? WHERE id = ?", (ai_type, sid))

        conn.commit()
        pct = min(100, round((i + BATCH_SIZE) / len(missing) * 100))
        print(f"  Batch {i//BATCH_SIZE + 1}/{(len(missing) + BATCH_SIZE - 1)//BATCH_SIZE}: "
              f"+{batch_updated} genetics  ({pct}% done, {total_updated} total)")

        time.sleep(0.3)

    conn.close()

    print(f"\n{'='*60}")
    print(f"  Workers AI Genetics Complete")
    print(f"  Genetics added: {total_updated}")
    print(f"  Lineage updated: {total_lineage}")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
