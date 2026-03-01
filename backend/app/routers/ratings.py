"""Ratings router — CRUD for strain ratings + learned preference profiles.

All data is stored in the SQLite DB alongside the science data.
User IDs come from Firebase Auth (passed by the frontend).
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

from backend.app.database import db
from backend.app.models.ratings import (
    BulkRatingSubmission,
    PreferenceProfile,
    PreferenceResponse,
    RatingSubmission,
    RatingsResponse,
    StoredRating,
    StrainRating,
)
from backend.app.services.preference_engine import build_preference_profile

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ratings", tags=["ratings"])


# ── Table bootstrap (runs once on first request) ───────────────────

_tables_ready = False


def _ensure_tables():
    global _tables_ready
    if _tables_ready or not db.conn:
        return
    db.conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS user_ratings (
            id            TEXT PRIMARY KEY,
            user_id       TEXT NOT NULL,
            strain_name   TEXT NOT NULL,
            strain_type   TEXT DEFAULT '',
            rating        INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
            effects_felt  TEXT DEFAULT '[]',
            negative_effects TEXT DEFAULT '[]',
            method        TEXT DEFAULT '',
            would_try_again INTEGER DEFAULT 1,
            notes         TEXT DEFAULT '',
            created_at    TEXT NOT NULL,
            updated_at    TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_user_ratings_user
            ON user_ratings(user_id);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_user_ratings_user_strain
            ON user_ratings(user_id, strain_name);
        """
    )
    _tables_ready = True
    logger.info("user_ratings table ready")


# ── Helpers ────────────────────────────────────────────────────────

def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _row_to_stored(row) -> StoredRating:
    import json

    return StoredRating(
        id=row["id"],
        user_id=row["user_id"],
        strain_name=row["strain_name"],
        strain_type=row["strain_type"] or "",
        rating=row["rating"],
        effects_felt=json.loads(row["effects_felt"]) if row["effects_felt"] else [],
        negative_effects=json.loads(row["negative_effects"]) if row["negative_effects"] else [],
        method=row["method"] or "",
        would_try_again=bool(row["would_try_again"]),
        notes=row["notes"] or "",
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def _get_user_ratings(user_id: str) -> list[StoredRating]:
    rows = db.conn.execute(
        "SELECT * FROM user_ratings WHERE user_id = ? ORDER BY updated_at DESC",
        (user_id,),
    ).fetchall()
    return [_row_to_stored(r) for r in rows]


# ── Endpoints ──────────────────────────────────────────────────────

@router.post("/submit", response_model=StoredRating)
async def submit_rating(payload: RatingSubmission):
    """Submit or update a rating for a strain."""
    _ensure_tables()
    if not db.conn:
        raise HTTPException(503, "Database not ready")

    import json

    r = payload.rating
    now = _now()

    # Upsert — one rating per user per strain
    existing = db.conn.execute(
        "SELECT id FROM user_ratings WHERE user_id = ? AND LOWER(strain_name) = LOWER(?)",
        (payload.user_id, r.strain_name),
    ).fetchone()

    if existing:
        rating_id = existing["id"]
        db.conn.execute(
            """
            UPDATE user_ratings SET
                strain_type = ?, rating = ?, effects_felt = ?,
                negative_effects = ?, method = ?, would_try_again = ?,
                notes = ?, updated_at = ?
            WHERE id = ?
            """,
            (
                r.strain_type, r.rating, json.dumps(r.effects_felt),
                json.dumps(r.negative_effects), r.method,
                int(r.would_try_again), r.notes, now, rating_id,
            ),
        )
    else:
        rating_id = str(uuid.uuid4())
        db.conn.execute(
            """
            INSERT INTO user_ratings
                (id, user_id, strain_name, strain_type, rating, effects_felt,
                 negative_effects, method, would_try_again, notes, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                rating_id, payload.user_id, r.strain_name, r.strain_type,
                r.rating, json.dumps(r.effects_felt), json.dumps(r.negative_effects),
                r.method, int(r.would_try_again), r.notes, now, now,
            ),
        )

    db.conn.commit()

    row = db.conn.execute("SELECT * FROM user_ratings WHERE id = ?", (rating_id,)).fetchone()
    return _row_to_stored(row)


@router.post("/sync", response_model=RatingsResponse)
async def sync_ratings(payload: BulkRatingSubmission):
    """Bulk sync ratings from localStorage to server. Returns all ratings + profile."""
    _ensure_tables()
    if not db.conn:
        raise HTTPException(503, "Database not ready")

    import json

    now = _now()
    for r in payload.ratings:
        existing = db.conn.execute(
            "SELECT id FROM user_ratings WHERE user_id = ? AND LOWER(strain_name) = LOWER(?)",
            (payload.user_id, r.strain_name),
        ).fetchone()

        if existing:
            db.conn.execute(
                """
                UPDATE user_ratings SET
                    strain_type = ?, rating = ?, effects_felt = ?,
                    negative_effects = ?, method = ?, would_try_again = ?,
                    notes = ?, updated_at = ?
                WHERE id = ?
                """,
                (
                    r.strain_type, r.rating, json.dumps(r.effects_felt),
                    json.dumps(r.negative_effects), r.method,
                    int(r.would_try_again), r.notes, now, existing["id"],
                ),
            )
        else:
            db.conn.execute(
                """
                INSERT INTO user_ratings
                    (id, user_id, strain_name, strain_type, rating, effects_felt,
                     negative_effects, method, would_try_again, notes, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    str(uuid.uuid4()), payload.user_id, r.strain_name, r.strain_type,
                    r.rating, json.dumps(r.effects_felt), json.dumps(r.negative_effects),
                    r.method, int(r.would_try_again), r.notes, now, now,
                ),
            )

    db.conn.commit()

    all_ratings = _get_user_ratings(payload.user_id)
    profile = build_preference_profile(payload.user_id, all_ratings)
    return RatingsResponse(ratings=all_ratings, profile=profile)


@router.get("/{user_id}", response_model=RatingsResponse)
async def get_ratings(user_id: str):
    """Retrieve all ratings for a user, plus their computed preference profile."""
    _ensure_tables()
    if not db.conn:
        raise HTTPException(503, "Database not ready")

    all_ratings = _get_user_ratings(user_id)
    profile = build_preference_profile(user_id, all_ratings) if all_ratings else None
    return RatingsResponse(ratings=all_ratings, profile=profile)


@router.get("/{user_id}/profile", response_model=PreferenceResponse)
async def get_preference_profile(user_id: str):
    """Get the learned preference profile for a user."""
    _ensure_tables()
    if not db.conn:
        raise HTTPException(503, "Database not ready")

    all_ratings = _get_user_ratings(user_id)
    profile = build_preference_profile(user_id, all_ratings)
    return PreferenceResponse(profile=profile)


@router.delete("/{user_id}/{strain_name}")
async def delete_rating(user_id: str, strain_name: str):
    """Delete a rating for a specific strain."""
    _ensure_tables()
    if not db.conn:
        raise HTTPException(503, "Database not ready")

    db.conn.execute(
        "DELETE FROM user_ratings WHERE user_id = ? AND LOWER(strain_name) = LOWER(?)",
        (user_id, strain_name),
    )
    db.conn.commit()
    return {"status": "deleted", "strain_name": strain_name}
