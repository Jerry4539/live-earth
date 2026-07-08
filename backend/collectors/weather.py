"""Weather collector — Open-Meteo global weather points."""
from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from typing import Any, List

from collectors.base import BaseCollector, NormalizedEvent

# Sample locations grid for global coverage (every 30° lat/lon ~ 144 points)
# In production expand to a denser grid or use user viewport
SAMPLE_GRID = [
    (lat, lon)
    for lat in range(-60, 91, 30)
    for lon in range(-180, 181, 30)
]

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"


def _wind_severity(wind_kmh: float) -> int:
    if wind_kmh < 20:
        return 0
    elif wind_kmh < 50:
        return 1
    elif wind_kmh < 90:
        return 2
    elif wind_kmh < 120:
        return 3
    elif wind_kmh < 180:
        return 4
    return 5


class WeatherCollector(BaseCollector):
    name = "weather"
    interval = 300  # 5 minutes

    async def _fetch(self) -> Any:
        results = []
        # Batch 10 locations at a time (Open-Meteo supports multi-location via separate requests)
        for lat, lon in SAMPLE_GRID[:25]:  # 25 points for demo
            try:
                resp = await self._get(
                    OPEN_METEO_URL,
                    params={
                        "latitude": lat,
                        "longitude": lon,
                        "current": "temperature_2m,wind_speed_10m,wind_direction_10m,weather_code,apparent_temperature,precipitation",
                        "timezone": "UTC",
                    },
                )
                results.append((lat, lon, resp.json()))
            except Exception:
                pass
        return results

    def _parse(self, raw: Any) -> List[NormalizedEvent]:
        events: List[NormalizedEvent] = []
        for lat, lon, data in raw:
            current = data.get("current", {})
            if not current:
                continue

            temp = current.get("temperature_2m", 0)
            wind = current.get("wind_speed_10m", 0)
            wind_dir = current.get("wind_direction_10m", 0)
            code = current.get("weather_code", 0)
            precip = current.get("precipitation", 0)

            ext_id = f"weather_{lat:.0f}_{lon:.0f}"
            ts_str = current.get("time", datetime.now(timezone.utc).isoformat())
            try:
                ts = datetime.fromisoformat(ts_str).replace(tzinfo=timezone.utc)
            except Exception:
                ts = datetime.now(timezone.utc)

            title = f"Weather at ({lat:.0f}°, {lon:.0f}°)"
            severity = _wind_severity(wind)

            events.append(
                NormalizedEvent(
                    external_id=ext_id,
                    type="weather",
                    latitude=lat,
                    longitude=lon,
                    timestamp=ts,
                    severity=severity,
                    title=title,
                    description=f"Temp: {temp}°C, Wind: {wind} km/h",
                    payload={
                        "temperature_c": temp,
                        "wind_speed_kmh": wind,
                        "wind_direction": wind_dir,
                        "weather_code": code,
                        "precipitation_mm": precip,
                    },
                    source_url="https://open-meteo.com",
                )
            )
        return events
