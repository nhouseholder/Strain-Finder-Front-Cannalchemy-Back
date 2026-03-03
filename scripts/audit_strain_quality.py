#!/usr/bin/env python3
"""Audit strain data quality — identify gaps and enrichment opportunities."""

import json
import os
from collections import Counter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STRAINS_PATH = os.path.join(ROOT, "frontend", "src", "data", "strains.json")

with open(STRAINS_PATH) as f:
    strains = json.load(f)

print(f"Total strains: {len(strains)}")
print()

# ── Field completeness ──────────────────────────────────────────────
all_keys = set()
for s in strains:
    all_keys.update(s.keys())

print("═══ Field Completeness ═══")
for key in sorted(all_keys):
    has = 0
    empty = 0
    for s in strains:
        val = s.get(key)
        if val is None:
            empty += 1
        elif isinstance(val, list) and len(val) == 0:
            empty += 1
        elif isinstance(val, str) and val.strip() == "":
            empty += 1
        elif isinstance(val, dict) and len(val) == 0:
            empty += 1
        else:
            has += 1
    pct = (has / len(strains)) * 100
    marker = "✓" if pct == 100 else ("⚠" if pct >= 80 else "✗")
    print(f"  {marker} {key}: {has}/{len(strains)} ({pct:.1f}%)")

# ── Depth analysis ──────────────────────────────────────────────────
print()
print("═══ Data Depth Analysis ═══")

# Effects: how many per strain?
eff_counts = [len(s.get("effects", [])) for s in strains]
print(f"  Effects per strain: min={min(eff_counts)}, max={max(eff_counts)}, avg={sum(eff_counts)/len(eff_counts):.1f}")
few_effects = sum(1 for c in eff_counts if c < 3)
print(f"    Strains with < 3 effects: {few_effects}")

# Terpenes
terp_counts = [len(s.get("terpenes", [])) for s in strains]
print(f"  Terpenes per strain: min={min(terp_counts)}, max={max(terp_counts)}, avg={sum(terp_counts)/len(terp_counts):.1f}")
few_terps = sum(1 for c in terp_counts if c < 3)
print(f"    Strains with < 3 terpenes: {few_terps}")

# Cannabinoids
for cann in ["thc", "cbd", "cbn", "cbg", "thcv", "cbc"]:
    has = sum(1 for s in strains if s.get(cann) is not None)
    print(f"  {cann.upper()}: {has}/{len(strains)} ({has/len(strains)*100:.1f}%)")

# Description quality
desc_lens = []
for s in strains:
    d = s.get("description", "")
    desc_lens.append(len(d) if d else 0)
short_desc = sum(1 for l in desc_lens if l < 100)
no_desc = sum(1 for l in desc_lens if l == 0)
print(f"  Descriptions: avg_len={sum(desc_lens)/len(desc_lens):.0f} chars")
print(f"    No description: {no_desc}")
print(f"    Short (< 100 chars): {short_desc}")

# Genetics / Lineage
has_genetics = sum(1 for s in strains if s.get("genetics"))
has_lineage = sum(1 for s in strains if s.get("lineage") and s["lineage"].get("parents"))
print(f"  Genetics string: {has_genetics}/{len(strains)} ({has_genetics/len(strains)*100:.1f}%)")
print(f"  Lineage parents: {has_lineage}/{len(strains)} ({has_lineage/len(strains)*100:.1f}%)")

# Sentiment / Review
has_sentiment = sum(1 for s in strains if s.get("sentimentScore") is not None)
has_reviews = sum(1 for s in strains if s.get("reviewCount") is not None and s["reviewCount"] > 0)
print(f"  sentimentScore: {has_sentiment}/{len(strains)} ({has_sentiment/len(strains)*100:.1f}%)")
print(f"  reviewCount > 0: {has_reviews}/{len(strains)} ({has_reviews/len(strains)*100:.1f}%)")

# Forum analysis
has_forum = sum(1 for s in strains if s.get("forumAnalysis"))
print(f"  forumAnalysis: {has_forum}/{len(strains)} ({has_forum/len(strains)*100:.1f}%)")

# Sommelier / consumption
has_somm = sum(1 for s in strains if s.get("sommelierScores"))
has_cons = sum(1 for s in strains if s.get("consumptionSuitability"))
print(f"  sommelierScores: {has_somm}/{len(strains)} ({has_somm/len(strains)*100:.1f}%)")
print(f"  consumptionSuitability: {has_cons}/{len(strains)} ({has_cons/len(strains)*100:.1f}%)")

# Best for / not ideal for
has_best = sum(1 for s in strains if s.get("bestFor") and len(s["bestFor"]) > 0)
has_not = sum(1 for s in strains if s.get("notIdealFor") and len(s["notIdealFor"]) > 0)
print(f"  bestFor: {has_best}/{len(strains)} ({has_best/len(strains)*100:.1f}%)")
print(f"  notIdealFor: {has_not}/{len(strains)} ({has_not/len(strains)*100:.1f}%)")

# Flavors
has_flavors = sum(1 for s in strains if s.get("flavors") and len(s["flavors"]) > 0)
flav_counts = [len(s.get("flavors", [])) for s in strains]
print(f"  Flavors: {has_flavors}/{len(strains)} ({has_flavors/len(strains)*100:.1f}%), avg={sum(flav_counts)/len(flav_counts):.1f} per strain")

# ── Source analysis ──────────────────────────────────────────────────
print()
print("═══ Source / Evidence Analysis ═══")
sources = Counter()
for s in strains:
    src = s.get("source", "unknown")
    sources[src] += 1
for src, cnt in sources.most_common():
    print(f"  {src}: {cnt}")

# Lab-tested vs estimated
lab_tested = sum(1 for s in strains if s.get("labTested"))
print(f"\n  Lab-tested (labTested=true): {lab_tested}/{len(strains)} ({lab_tested/len(strains)*100:.1f}%)")

# ── Quality score ────────────────────────────────────────────────────
print()
print("═══ Per-Strain Quality Score ═══")

def quality_score(s):
    score = 0
    # Has real lab data
    if s.get("labTested"):
        score += 15
    # Cannabinoids: thc, cbd required; bonus for minors
    if s.get("thc") is not None:
        score += 5
    if s.get("cbd") is not None:
        score += 5
    minor_canns = sum(1 for c in ["cbn", "cbg", "thcv", "cbc"] if s.get(c) is not None)
    score += minor_canns * 2
    # Terpenes
    terps = len(s.get("terpenes", []))
    score += min(terps, 5) * 3  # up to 15
    # Effects
    effs = len(s.get("effects", []))
    score += min(effs, 5) * 2  # up to 10
    # Description
    desc = s.get("description", "")
    if desc and len(desc) >= 200:
        score += 10
    elif desc and len(desc) >= 100:
        score += 5
    # Genetics
    if s.get("genetics"):
        score += 5
    if s.get("lineage", {}).get("parents"):
        score += 5
    # Community data
    if s.get("sentimentScore") is not None:
        score += 5
    if s.get("reviewCount", 0) > 0:
        score += 5
    if s.get("forumAnalysis"):
        score += 5
    # Flavors
    if len(s.get("flavors", [])) >= 3:
        score += 5
    # Best for / not ideal for
    if s.get("bestFor") and len(s["bestFor"]) > 0:
        score += 3
    if s.get("notIdealFor") and len(s["notIdealFor"]) > 0:
        score += 2
    return score

scores = [(quality_score(s), s["name"], s.get("source", "?")) for s in strains]
scores.sort()

# Distribution
max_possible = 100
buckets = {"0-25": 0, "26-50": 0, "51-75": 0, "76-100": 0}
for sc, _, _ in scores:
    if sc <= 25:
        buckets["0-25"] += 1
    elif sc <= 50:
        buckets["26-50"] += 1
    elif sc <= 75:
        buckets["51-75"] += 1
    else:
        buckets["76-100"] += 1

avg_score = sum(sc for sc, _, _ in scores) / len(scores)
print(f"  Average quality score: {avg_score:.1f}/100")
print(f"  Distribution:")
for bucket, cnt in buckets.items():
    print(f"    {bucket}: {cnt} strains ({cnt/len(strains)*100:.1f}%)")

print()
print("  Bottom 20 (worst quality):")
for sc, name, src in scores[:20]:
    print(f"    {sc:3d}  {name} ({src})")

print()
print("  Top 10 (best quality):")
for sc, name, src in scores[-10:]:
    print(f"    {sc:3d}  {name} ({src})")

# ── Specific gaps to fill ────────────────────────────────────────────
print()
print("═══ Enrichment Priorities ═══")
no_genetics = [s["name"] for s in strains if not s.get("genetics")]
no_lineage = [s["name"] for s in strains if not s.get("lineage", {}).get("parents")]
no_forum = [s["name"] for s in strains if not s.get("forumAnalysis")]
low_terps = [s["name"] for s in strains if len(s.get("terpenes", [])) < 3]
low_effects = [s["name"] for s in strains if len(s.get("effects", [])) < 3]
short_descs = [s["name"] for s in strains if len(s.get("description", "")) < 100]
no_flavors = [s["name"] for s in strains if not s.get("flavors") or len(s["flavors"]) == 0]
not_lab = [s["name"] for s in strains if not s.get("labTested")]

print(f"  Missing genetics: {len(no_genetics)}")
print(f"  Missing lineage parents: {len(no_lineage)}")
print(f"  Missing forumAnalysis: {len(no_forum)}")
print(f"  < 3 terpenes: {len(low_terps)}")
print(f"  < 3 effects: {len(low_effects)}")
print(f"  Short/no description: {len(short_descs)}")
print(f"  No flavors: {len(no_flavors)}")
print(f"  Not lab-tested: {len(not_lab)}")
