"""Replay API — return historical events in a time window."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database.session import get_db
from models.event import Event

router = APIRouter(prefix="/api/replay", tags=["replay"])

ALLOWED_PRESETS = {"1h": 1, "24h": 24, "7d": 168}


@router.get("")
async def replay(
    preset: Optional[str] = Query(None, description="1h | 24h | 7d"),
    since: Optional[datetime] = Query(None),
    until: Optional[datetime] = Query(None),
    type: Optional[str] = Query(None),
    limit: int = Query(2000, ge=1, le=10000),
    db: AsyncSession = Depends(get_db),
) -> dict:
    now = datetime.now(timezone.utc)

    if preset:
        if preset not in ALLOWED_PRESETS:
            raise HTTPException(status_code=400, detail=f"preset must be one of {list(ALLOWED_PRESETS)}")
        since = now - timedelta(hours=ALLOWED_PRESETS[preset])
        until = now

    if since is None:
        since = now - timedelta(hours=1)
    if until is None:
        until = now

    stmt = (
        select(Event)
        .where(Event.timestamp >= since, Event.timestamp <= until)
        .order_by(Event.timestamp.asc())
        .limit(limit)
    )
    if type:
        stmt = stmt.where(Event.type == type)

    result = await db.execute(stmt)
    events = result.scalars().all()
    return {
        "since": since.isoformat(),
        "until": until.isoformat(),
        "count": len(events),
        "events": [e.to_dict() for e in events],
    }
