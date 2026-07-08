"""Volcano collector — Smithsonian GVP (Global Volcanism Program) RSS feed."""
from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from typing import Any, List

import feedparser

from collectors.base import BaseCollector, NormalizedEvent

GVP_RSS_URL = "https://volcano.si.edu/news/WeeklyVolcanoActivity.cfm"
GVP_FEED_URL = "https://volcano.si.edu/gvp_votw.cfm"

# Fallback: use Smithsonian GVP weekly activity report RSS
SMITHSONIAN_RSS = "https://volcano.si.edu/rss/rss.cfm?news=eruptions"

# Alert-level color → severity mapping
ALERT_SEVERITY = {
    "green": 1,
    "yellow": 2,
    "orange": 3,
    "red": 4,
    "normal": 1,
    "advisory": 2,
    "watch": 3,
    "warning": 4,
}


class VolcanoCollector(BaseCollector):
    name = "volcanoes"
    interval = 600  # 10 minutes

    async def _fetch(self) -> Any:
        try:
            resp = await self._get(SMITHSONIAN_RSS)
            return resp.text
        except Exception:
            return ""

    def _parse(self, raw: Any) -> List[NormalizedEvent]:
        if not raw:
            return self._get_known_volcanoes()

        events: List[NormalizedEvent] = []
        feed = feedparser.parse(raw)
        for entry in feed.entries[:30]:
            title = entry.get("title", "")
            summary = entry.get("summary", "")
            link = entry.get("link", "")

            # Extract coordinates if available in feed
            lat = getattr(entry, "geo_lat", None)
            lon = getattr(entry, "geo_long", None)

            if lat is None or lon is None:
                # Use known volcano positions as fallback
                continue

            try:
                lat, lon = float(lat), float(lon)
            except (ValueError, TypeError):
                continue

            ext_id = hashlib.md5(link.encode() or title.encode()).hexdigest()[:16]
            ts = datetime.now(timezone.utc)
            if hasattr(entry, "published_parsed") and entry.published_parsed:
                import time
                ts = datetime.fromtimestamp(time.mktime(entry.published_parsed), tz=timezone.utc)

            events.append(
                NormalizedEvent(
                    external_id=f"volcano_{ext_id}",
                    type="volcano",
                    latitude=lat,
                    longitude=lon,
                    timestamp=ts,
                    severity=3,
                    title=title,
                    description=summary[:500],
                    payload={"link": link},
                    source_url=link,
                )
            )

        return events if events else self._get_known_volcanoes()

    def _get_known_volcanoes(self) -> List[NormalizedEvent]:
        """Return statically known active volcanoes as fallback."""
        known = [
            ("Kīlauea", 19.421, -155.287, 4, "Active lava lake, ongoing eruption"),
            ("Etna", 37.748, 14.999, 3, "Europe's most active volcano"),
            ("Stromboli", 38.789, 15.213, 2, "Continuous eruptions since ancient times"),
            ("Merapi", -7.540, 110.446, 3, "Indonesia – frequent eruptions"),
            ("Popocatépetl", 19.023, -98.622, 3, "Mexico – active with ash plumes"),
            ("Sakurajima", 31.585, 130.659, 3, "Japan – multiple eruptions per day"),
            ("Piton de la Fournaise", -21.244, 55.708, 2, "Réunion – frequent lava flows"),
            ("Nyiragongo", -1.520, 29.250, 4, "DRC – world's largest lava lake"),
            ("Fuego", 14.473, -90.880, 3, "Guatemala – regular explosive eruptions"),
            ("Semeru", -8.108, 112.922, 3, "Indonesia – near-continuous eruptions"),
            ("Erebus", -77.530, 167.153, 2, "Antarctica – permanent lava lake"),
            ("Erta Ale", 13.600, 40.670, 3, "Ethiopia – persistent lava lake"),
        ]
        ts = datetime.now(timezone.utc)
        events = []
        for name, lat, lon, sev, desc in known:
            events.append(
                NormalizedEvent(
                    external_id=f"volcano_known_{name.lower().replace(' ', '_')}",
                    type="volcano",
                    latitude=lat,
                    longitude=lon,
                    timestamp=ts,
                    severity=sev,
                    title=name,
                    description=desc,
                    payload={"alert": "orange" if sev >= 3 else "yellow", "name": name},
                    source_url="https://volcano.si.edu",
                )
            )
        return events
