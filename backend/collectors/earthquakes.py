"""Earthquake collector — USGS GeoJSON real-time feeds."""
from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from typing import Any, List

from collectors.base import BaseCollector, NormalizedEvent

# All earthquakes past hour (updates every minute)
USGS_URL = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson"


def _magnitude_to_severity(mag: float) -> int:
    if mag < 2:
        return 1
    elif mag < 4:
        return 2
    elif mag < 5:
        return 3
    elif mag < 6:
        return 4
    return 5


class EarthquakeCollector(BaseCollector):
    name = "earthquakes"

    async def _fetch(self) -> Any:
        resp = await self._get(USGS_URL)
        return resp.json()

    def _parse(self, raw: Any) -> List[NormalizedEvent]:
        events: List[NormalizedEvent] = []
        for feature in raw.get("features", []):
            props = feature.get("properties", {})
            geom = feature.get("geometry", {})
            coords = geom.get("coordinates", [None, None, None])

            mag = props.get("mag") or 0.0
            lon, lat, depth = coords[0], coords[1], coords[2] or 0

            if lat is None or lon is None:
                continue

            ext_id = feature.get("id") or hashlib.md5(
                f"{lat}{lon}{props.get('time')}".encode()
            ).hexdigest()

            ts_ms = props.get("time") or 0
            ts = datetime.fromtimestamp(ts_ms / 1000, tz=timezone.utc)

            place = props.get("place", "Unknown location")
            title = f"M{mag:.1f} — {place}"

            events.append(
                NormalizedEvent(
                    external_id=ext_id,
                    type="earthquake",
                    latitude=lat,
                    longitude=lon,
                    timestamp=ts,
                    severity=_magnitude_to_severity(mag),
                    title=title,
                    description=props.get("detail", ""),
                    payload={
                        "magnitude": mag,
                        "depth_km": depth,
                        "place": place,
                        "status": props.get("status"),
                        "tsunami": props.get("tsunami", 0),
                        "alert": props.get("alert"),
                        "felt": props.get("felt"),
                        "cdi": props.get("cdi"),
                        "mmi": props.get("mmi"),
                    },
                    source_url=props.get("url", ""),
                )
            )
        return events
