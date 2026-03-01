"""Preference Learning Engine — analyzes user ratings to build a preference profile.

The engine works entirely in-memory from the stored ratings list. It computes:
  • Type affinity  (indica/sativa/hybrid weighted avg ratings)
  • Effect affinity (which effects correlate with high/low ratings)
  • Terpene affinity (avg rating per terpene across rated strains)
  • Cannabinoid sweet-spot (THC/CBD ranges the user rates highest)
  • Preferred consumption method
  • Human-readable insights
"""
from __future__ import annotations

import logging
import math
from collections import defaultdict

from backend.app.models.ratings import (
    CannabinoidPreference,
    EffectPreference,
    PreferenceProfile,
    StoredRating,
    TerpenePreference,
)
from backend.app.database import db

logger = logging.getLogger(__name__)


def _confidence(n: int) -> float:
    """Bayesian-ish confidence from number of ratings.  0  → 0,  5 → 0.5,  20 → 0.9"""
    return 1 - math.exp(-0.08 * n)


def build_preference_profile(user_id: str, ratings: list[StoredRating]) -> PreferenceProfile:
    """Compute a complete preference profile from a list of ratings."""

    if not ratings:
        return PreferenceProfile(user_id=user_id)

    # ── Basic aggregates ──
    total = len(ratings)
    avg_rating = sum(r.rating for r in ratings) / total

    # ── Type scores ──
    type_sums: dict[str, float] = defaultdict(float)
    type_counts: dict[str, int] = defaultdict(int)
    for r in ratings:
        t = (r.strain_type or "").lower().strip()
        if t:
            type_sums[t] += r.rating
            type_counts[t] += 1
    type_scores = {t: type_sums[t] / type_counts[t] for t in type_counts}
    preferred_type = max(type_scores, key=type_scores.get) if type_scores else ""

    # ── Effect preferences ──
    # For each effect, compute a weighted score:
    #   +1 if the user gave 5 stars, +0.5 for 4, 0 for 3, −0.5 for 2, −1 for 1
    effect_weighted: dict[str, float] = defaultdict(float)
    effect_counts: dict[str, int] = defaultdict(int)
    for r in ratings:
        weight = (r.rating - 3) / 2.0  # maps 1-5 → −1..+1
        for eff in r.effects_felt:
            effect_weighted[eff] += weight
            effect_counts[eff] += 1

    effect_prefs = sorted(
        [
            EffectPreference(
                effect=eff,
                score=round(effect_weighted[eff] / effect_counts[eff], 3),
                count=effect_counts[eff],
            )
            for eff in effect_counts
        ],
        key=lambda p: p.score,
        reverse=True,
    )

    # ── Negative effect sensitivity ──
    neg_weighted: dict[str, float] = defaultdict(float)
    neg_counts: dict[str, int] = defaultdict(int)
    for r in ratings:
        # Negative effects in low-rated strains → high sensitivity
        weight = (3 - r.rating) / 2.0  # maps 1-5 → +1..−1  (positive = bad correlation)
        for eff in r.negative_effects:
            neg_weighted[eff] += weight
            neg_counts[eff] += 1

    neg_prefs = sorted(
        [
            EffectPreference(
                effect=eff,
                score=round(neg_weighted[eff] / neg_counts[eff], 3),
                count=neg_counts[eff],
            )
            for eff in neg_counts
        ],
        key=lambda p: p.score,
        reverse=True,
    )

    # ── Terpene preferences (from DB strain data) ──
    terp_prefs = _compute_terpene_preferences(ratings)

    # ── Cannabinoid preferences ──
    canna_prefs = _compute_cannabinoid_preferences(ratings)

    # ── Preferred method ──
    method_sums: dict[str, float] = defaultdict(float)
    method_counts: dict[str, int] = defaultdict(int)
    for r in ratings:
        if r.method:
            method_sums[r.method] += r.rating
            method_counts[r.method] += 1
    preferred_method = ""
    if method_counts:
        preferred_method = max(method_counts, key=lambda m: method_sums[m] / method_counts[m])

    # ── Would-try-again rate ──
    would_count = sum(1 for r in ratings if r.would_try_again)
    wta_rate = would_count / total

    # ── Top / bottom strains ──
    by_rating = sorted(ratings, key=lambda r: r.rating, reverse=True)
    top_strains = list(dict.fromkeys(r.strain_name for r in by_rating if r.rating >= 4))[:5]
    avoid_strains = list(dict.fromkeys(r.strain_name for r in reversed(by_rating) if r.rating <= 2))[:5]

    # ── Generate insights ──
    insights = _generate_insights(
        total, avg_rating, preferred_type, type_scores,
        effect_prefs, neg_prefs, terp_prefs, wta_rate, top_strains
    )

    return PreferenceProfile(
        user_id=user_id,
        total_ratings=total,
        avg_rating=round(avg_rating, 2),
        preferred_type=preferred_type,
        type_scores={t: round(s, 2) for t, s in type_scores.items()},
        type_counts=dict(type_counts),
        effect_preferences=effect_prefs,
        negative_effect_sensitivity=neg_prefs,
        terpene_preferences=terp_prefs,
        cannabinoid_preferences=canna_prefs,
        preferred_method=preferred_method,
        would_try_again_rate=round(wta_rate, 2),
        top_strains=top_strains,
        avoid_strains=avoid_strains,
        confidence=round(_confidence(total), 2),
        insights=insights,
    )


# ── Terpene analysis (cross-reference with DB) ─────────────────────

def _compute_terpene_preferences(ratings: list[StoredRating]) -> list[TerpenePreference]:
    """Cross-reference rated strains with the DB to find terpene patterns."""
    if not db.conn:
        return []

    terp_ratings: dict[str, list[float]] = defaultdict(list)

    for r in ratings:
        try:
            rows = db.conn.execute(
                """
                SELECT m.name, sc.percentage
                FROM strain_compositions sc
                JOIN molecules m ON m.id = sc.molecule_id
                JOIN strains s ON s.id = sc.strain_id
                WHERE LOWER(s.name) = LOWER(?)
                  AND m.category = 'terpene'
                  AND sc.percentage > 0
                """,
                (r.strain_name,),
            ).fetchall()
            for row in rows:
                terp_ratings[row["name"]].append(r.rating)
        except Exception as e:
            logger.debug(f"Terpene lookup failed for {r.strain_name}: {e}")

    return sorted(
        [
            TerpenePreference(
                name=name,
                avg_rating=round(sum(vals) / len(vals), 2),
                count=len(vals),
            )
            for name, vals in terp_ratings.items()
            if len(vals) >= 1
        ],
        key=lambda t: t.avg_rating,
        reverse=True,
    )


def _compute_cannabinoid_preferences(ratings: list[StoredRating]) -> list[CannabinoidPreference]:
    """Find THC/CBD sweet spots from rated strains."""
    if not db.conn:
        return []

    canna_data: dict[str, list[tuple[float, float]]] = defaultdict(list)  # name → [(value, rating)]

    for r in ratings:
        try:
            rows = db.conn.execute(
                """
                SELECT m.name, sc.percentage
                FROM strain_compositions sc
                JOIN molecules m ON m.id = sc.molecule_id
                JOIN strains s ON s.id = sc.strain_id
                WHERE LOWER(s.name) = LOWER(?)
                  AND m.category = 'cannabinoid'
                  AND sc.percentage > 0
                """,
                (r.strain_name,),
            ).fetchall()
            for row in rows:
                canna_data[row["name"]].append((row["percentage"], r.rating))
        except Exception as e:
            logger.debug(f"Cannabinoid lookup failed for {r.strain_name}: {e}")

    result = []
    for name, pairs in canna_data.items():
        if not pairs:
            continue
        avg_rating = sum(rat for _, rat in pairs) / len(pairs)
        values = [v for v, _ in pairs]
        # Preferred range = values from top-rated entries (4+ stars)
        high_rated = [v for v, rat in pairs if rat >= 4]
        if high_rated:
            low = min(high_rated)
            high = max(high_rated)
        else:
            low = min(values)
            high = max(values)
        result.append(
            CannabinoidPreference(
                name=name,
                preferred_range_low=round(low, 2),
                preferred_range_high=round(high, 2),
                avg_rating=round(avg_rating, 2),
                count=len(pairs),
            )
        )

    return sorted(result, key=lambda c: c.avg_rating, reverse=True)


# ── Human-readable insights ────────────────────────────────────────

def _generate_insights(
    total, avg_rating, preferred_type, type_scores,
    effect_prefs, neg_prefs, terp_prefs, wta_rate, top_strains
) -> list[str]:
    insights = []

    if total < 3:
        insights.append(
            f"You've rated {total} strain{'s' if total != 1 else ''}. "
            "Rate more to unlock detailed preference analysis!"
        )
        return insights

    # Type insight
    if preferred_type and len(type_scores) >= 2:
        scores_sorted = sorted(type_scores.items(), key=lambda x: x[1], reverse=True)
        best, best_score = scores_sorted[0]
        worst, worst_score = scores_sorted[-1]
        if best_score - worst_score >= 0.5:
            insights.append(
                f"You rate {best.title()} strains {best_score:.1f}/5 on average — "
                f"that's {best_score - worst_score:.1f} stars higher than {worst.title()}."
            )

    # Effect insight
    loved = [p for p in effect_prefs if p.score >= 0.3 and p.count >= 2]
    if loved:
        names = ", ".join(p.effect for p in loved[:3])
        insights.append(f"You tend to love strains that produce: {names}.")

    disliked = [p for p in effect_prefs if p.score <= -0.3 and p.count >= 2]
    if disliked:
        names = ", ".join(p.effect for p in disliked[:3])
        insights.append(f"You rate strains lower when they make you feel: {names}.")

    # Negative effect sensitivity
    sensitive = [p for p in neg_prefs if p.score >= 0.3 and p.count >= 2]
    if sensitive:
        names = ", ".join(p.effect for p in sensitive[:3])
        insights.append(f"You're particularly sensitive to: {names}.")

    # Terpene insight
    if len(terp_prefs) >= 2:
        top_terp = terp_prefs[0]
        if top_terp.count >= 2:
            insights.append(
                f"Your highest-rated strains tend to be rich in {top_terp.name} "
                f"(avg {top_terp.avg_rating:.1f}/5 across {top_terp.count} strains)."
            )

    # Top strains
    if top_strains:
        insights.append(f"Your favorites so far: {', '.join(top_strains[:3])}.")

    # Would try again
    if total >= 5:
        pct = int(wta_rate * 100)
        insights.append(f"You'd try again {pct}% of strains you've rated.")

    return insights
