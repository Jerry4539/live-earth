"""Abstract base class for all data collectors."""
from __future__ import annotations

import asyncio
import logging
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

from config import get_settings

logger = logging.getLogger(__name__)


class NormalizedEvent:
    """Intermediate representation produced by every collector."""
    def __init__(
        self,
        external_id: str,
        type: str,
        latitude: float,
        longitude: float,
        timestamp: datetime,
        severity: int,
        title: str,
        description: str = "",
        payload: Optional[Dict[str, Any]] = None,
        source_url: str = "",
    ) -> None:
        self.external_id = external_id
        self.type = type
        self.latitude = latitude
        self.longitude = longitude
        self.timestamp = timestamp
        self.severity = severity
        self.title = title
        self.description = description
        self.payload = payload or {}
        self.source_url = source_url

    def to_dict(self) -> dict:
        return {
            "external_id": self.external_id,
            "type": self.type,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "timestamp": self.timestamp.isoformat(),
            "severity": self.severity,
            "title": self.title,
            "description": self.description,
            "payload": self.payload,
            "source_url": self.source_url,
        }


class BaseCollector(ABC):
    """
    Collector lifecycle:
      poll() → validate() → normalize() → store() → broadcast()
    """

    name: str = "base"
    interval: int = 60  # seconds between polls

    def __init__(self) -> None:
        self._client = httpx.AsyncClient(timeout=8.0, follow_redirects=True)
        self._seen_ids: set[str] = set()

    # ── Public ───────────────────────────────────────────────────────────────

    async def run_once(self) -> None:
        """Execute a single collection cycle."""
        logger.info("[%s] Starting collection cycle", self.name)
        try:
            raw = await self._fetch()
            events = self._parse(raw)
            new_events = [e for e in events if e.external_id not in self._seen_ids]
            for e in new_events:
                self._seen_ids.add(e.external_id)
            if new_events:
                await self._store_and_broadcast(new_events)
                logger.info("[%s] Collected %d new events", self.name, len(new_events))
        except Exception as exc:
            logger.exception("[%s] Collection error: %s", self.name, exc)

    # ── Overridable ───────────────────────────────────────────────────────────

    @abstractmethod
    async def _fetch(self) -> Any:
        """Fetch raw data from the source."""

    @abstractmethod
    def _parse(self, raw: Any) -> List[NormalizedEvent]:
        """Parse raw data into normalized events."""

    # ── Internal ──────────────────────────────────────────────────────────────

    async def _store_and_broadcast(self, events: List[NormalizedEvent]) -> None:
        from database.session import AsyncSessionLocal
        from models.event import Event
        from sqlalchemy import select
        from websocket.manager import manager

        async with AsyncSessionLocal() as session:
            for ev in events:
                # Upsert by external_id
                result = await session.execute(
                    select(Event).where(Event.external_id == ev.external_id)
                )
                existing = result.scalar_one_or_none()
                if existing is None:
                    db_event = Event(
                        external_id=ev.external_id,
                        type=ev.type,
                        latitude=ev.latitude,
                        longitude=ev.longitude,
                        timestamp=ev.timestamp,
                        severity=ev.severity,
                        title=ev.title,
                        description=ev.description,
                        payload=ev.payload,
                        source_url=ev.source_url,
                    )
                    session.add(db_event)
            await session.commit()

        # Broadcast each new event via WebSocket
        for ev in events:
            await manager.publish({"type": "event", "data": ev.to_dict()})

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=10))
    async def _get(self, url: str, **kwargs: Any) -> httpx.Response:
        resp = await self._client.get(url, **kwargs)
        resp.raise_for_status()
        return resp
