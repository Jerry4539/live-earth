"""Wildfire collector — NASA FIRMS (Fire Information for Resource Management System)."""
from __future__ import annotations

import csv
import hashlib
import io
from datetime import datetime, timezone
from typing import Any, List

from collectors.base import BaseCollector, NormalizedEvent
from config import get_settings

# NASA FIRMS world fire data (MODIS, last 24h) — no key required for CSV
FIRMS_BASE = "https://firms.modaps.eosdis.nasa.gov/data/active_fire/modis-c6.1/csv"
FIRMS_WORLD_24H = f"{FIRMS_BASE}/MODIS_C6_1_Global_24h.csv"

# Area-based API (requires MAP_KEY for high-resolution, but works without for MODIS)
FIRMS_AREA_URL = "https://firms.modaps.eosdis.nasa.gov/api/area/csv/{key}/MODIS_NRT/world/1"


def _frp_to_severity(frp: float) -> int:
    """Fire Radiative Power (MW) → severity 0-5."""
    if frp < 10:
        return 1
    elif frp < 50:
        return 2
    elif frp < 200:
        return 3
    elif frp < 500:
        return 4
    return 5


class WildfireCollector(BaseCollector):
    name = "wildfires"
    interval = 300

    async def _fetch(self) -> Any:
        settings = get_settings()
        if settings.nasa_firms_map_key:
            url = FIRMS_AREA_URL.format(key=settings.nasa_firms_map_key)
        else:
            url = FIRMS_WORLD_24H
        try:
            resp = await self._get(url)
            return resp.text
        except Exception:
            return ""

    def _parse(self, raw: Any) -> List[NormalizedEvent]:
        if not raw or raw.strip().startswith("<"):
            return []

        events: List[NormalizedEvent] = []
        try:
            reader = csv.DictReader(io.StringIO(raw))
            rows = list(reader)
        except Exception:
            return []

        # Sample max 300 events to avoid DB flooding
        for row in rows[:300]:
            try:
                lat = float(row.get("latitude") or row.get("lat", 0))
                lon = float(row.get("longitude") or row.get("lon", 0))
                frp = float(row.get("frp", 0) or 0)
                acq_date = row.get("acq_date", "")
                acq_time = row.get("acq_time", "0000")

                ts_str = f"{acq_date} {acq_time.zfill(4)}"
                try:
                    ts = datetime.strptime(ts_str, "%Y-%m-%d %H%M").replace(tzinfo=timezone.utc)
                except Exception:
                    ts = datetime.now(timezone.utc)

                ext_id = hashlib.md5(f"{lat:.3f}{lon:.3f}{acq_date}{acq_time}".encode()).hexdigest()[:16]
                confidence = row.get("confidence", "n")
                satellite = row.get("satellite", "MODIS")

                events.append(
                    NormalizedEvent(
                        external_id=f"fire_{ext_id}",
                        type="wildfire",
                        latitude=lat,
                        longitude=lon,
                        timestamp=ts,
                        severity=_frp_to_severity(frp),
                        title=f"Active Fire ({satellite})",
                        description=f"FRP: {frp:.0f} MW, Confidence: {confidence}",
                        payload={
                            "frp_mw": frp,
                            "confidence": confidence,
                            "satellite": satellite,
                            "brightness": float(row.get("brightness", 0) or 0),
                            "scan": float(row.get("scan", 0) or 0),
                            "track": float(row.get("track", 0) or 0),
                            "daynight": row.get("daynight", "D"),
                        },
                        source_url="https://firms.modaps.eosdis.nasa.gov",
                    )
                )
            except (ValueError, KeyError):
                continue

        return events
