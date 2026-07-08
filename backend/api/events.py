"""Events REST API — query, filter and paginate stored events."""
from __future__ import annotations

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database.session import get_db
from models.event import Event

router = APIRouter(prefix="/api/events", tags=["events"])

EVENT_TYPES = ["earthquake", "weather", "satellite", "volcano", "wildfire", "airquality"]


@router.get("", response_model=None)
async def list_events(
    type: Optional[str] = Query(None, description="Filter by event type"),
    min_severity: int = Query(0, ge=0, le=5),
    lat_min: Optional[float] = Query(None, ge=-90, le=90),
    lat_max: Optional[float] = Query(None, ge=-90, le=90),
    lon_min: Optional[float] = Query(None, ge=-180, le=180),
    lon_max: Optional[float] = Query(None, ge=-180, le=180),
    since: Optional[datetime] = Query(None, description="ISO8601 timestamp"),
    until: Optional[datetime] = Query(None, description="ISO8601 timestamp"),
    limit: int = Query(500, ge=1, le=5000),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
) -> dict:
    stmt = select(Event).order_by(Event.timestamp.desc())

    if type:
        stmt = stmt.where(Event.type == type)
    if min_severity:
        stmt = stmt.where(Event.severity >= min_severity)
    if lat_min is not None:
        stmt = stmt.where(Event.latitude >= lat_min)
    if lat_max is not None:
        stmt = stmt.where(Event.latitude <= lat_max)
    if lon_min is not None:
        stmt = stmt.where(Event.longitude >= lon_min)
    if lon_max is not None:
        stmt = stmt.where(Event.longitude <= lon_max)
    if since:
        stmt = stmt.where(Event.timestamp >= since)
    if until:
        stmt = stmt.where(Event.timestamp <= until)

    stmt = stmt.limit(limit).offset(offset)
    result = await db.execute(stmt)
    events = result.scalars().all()
    return {"count": len(events), "events": [e.to_dict() for e in events]}


@router.get("/{event_id}")
async def get_event(event_id: UUID, db: AsyncSession = Depends(get_db)) -> dict:
    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Event not found")
    return event.to_dict()
