"""Pydantic models for strain ratings and learned user preferences."""
from __future__ import annotations

from pydantic import BaseModel, Field


# ── Incoming: user rates a strain ──────────────────────────────────

class StrainRating(BaseModel):
    """A single user rating for a strain they tried."""
    strain_name: str
    strain_type: str = ""                    # indica / sativa / hybrid
    rating: int = Field(..., ge=1, le=5)     # 1-5 star rating
    effects_felt: list[str] = Field(default_factory=list)
    negative_effects: list[str] = Field(default_factory=list)
    method: str = ""                         # flower, vape, edibles...
    would_try_again: bool = True
    notes: str = ""


class RatingSubmission(BaseModel):
    """Payload to submit / update a rating."""
    user_id: str
    rating: StrainRating


class BulkRatingSubmission(BaseModel):
    """Payload to sync many ratings at once (localStorage → server)."""
    user_id: str
    ratings: list[StrainRating]


# ── Stored rating with metadata ────────────────────────────────────

class StoredRating(StrainRating):
    id: str = ""
    user_id: str = ""
    created_at: str = ""
    updated_at: str = ""


# ── Learned Preference Profile ─────────────────────────────────────

class EffectPreference(BaseModel):
    """How much the user likes/dislikes a particular effect."""
    effect: str
    score: float = Field(default=0.0, description="Affinity score (−1 to +1)")
    count: int = 0                           # how many times observed


class TerpenePreference(BaseModel):
    name: str
    avg_rating: float = 0.0                  # average rating of strains with this terpene
    count: int = 0


class CannabinoidPreference(BaseModel):
    name: str
    preferred_range_low: float = 0.0
    preferred_range_high: float = 0.0
    avg_rating: float = 0.0
    count: int = 0


class PreferenceProfile(BaseModel):
    """Learned preference profile derived from a user's ratings."""
    user_id: str
    total_ratings: int = 0
    avg_rating: float = 0.0
    preferred_type: str = ""                 # indica / sativa / hybrid / ""
    type_scores: dict[str, float] = Field(default_factory=dict)   # {type: avg_rating}
    type_counts: dict[str, int] = Field(default_factory=dict)     # {type: count}
    effect_preferences: list[EffectPreference] = Field(default_factory=list)
    negative_effect_sensitivity: list[EffectPreference] = Field(default_factory=list)
    terpene_preferences: list[TerpenePreference] = Field(default_factory=list)
    cannabinoid_preferences: list[CannabinoidPreference] = Field(default_factory=list)
    preferred_method: str = ""
    would_try_again_rate: float = 0.0        # 0-1
    top_strains: list[str] = Field(default_factory=list)          # highest rated
    avoid_strains: list[str] = Field(default_factory=list)        # lowest rated
    confidence: float = 0.0                  # 0-1 based on number of ratings
    insights: list[str] = Field(default_factory=list)             # human-readable insights


# ── API Response wrappers ──────────────────────────────────────────

class RatingsResponse(BaseModel):
    ratings: list[StoredRating]
    profile: PreferenceProfile | None = None


class PreferenceResponse(BaseModel):
    profile: PreferenceProfile
