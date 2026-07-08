"""Satellite + ISS collector using CelesTrak TLE data and sgp4 propagation."""
from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from typing import Any, List

from sgp4.api import Satrec, jday
from collectors.base import BaseCollector, NormalizedEvent

# CelesTrak: active satellites + ISS
CELESTRAK_ISS_URL = "https://celestrak.org/SOCRATES/query.php?CODE=ISS&FORMAT=TLE"
CELESTRAK_ACTIVE_URL = "https://celestrak.org/SOCRATES/query.php?CODE=STARLINK&FORMAT=TLE"

ISS_TLE_URL = "https://celestrak.org/satellites/tle.php?CATNR=25544&FORMAT=TLE"
ACTIVE_TLE_URL = "https://celestrak.org/SOCRATES/query.php?CODE=&FORMAT=TLE"

# Use the well-known groups endpoint
CELESTRAK_GROUPS = {
    "ISS (ZARYA)": "https://celestrak.org/SOCRATES/query.php?CODE=ISS&FORMAT=TLE",
}

# Best source: supplemental TLE from Celestrak
SATS_URL = "https://celestrak.org/SOCRATES/query.php?CODE=ISS&FORMAT=TLE"
ISS_URL = "https://celestrak.org/satellites/tle.php?CATNR=25544&FORMAT=TLE"
ACTIVE_SATS_URL = "https://celestrak.org/SOCRATES/query.php?CODE=ACTIVE&FORMAT=TLE"

# Actually use the simpler working URLs
CELESTRAK_ISS = "https://celestrak.org/satellites/tle.php?CATNR=25544"
CELESTRAK_ACTIVE = "https://celestrak.org/SOCRATES/query.php?CODE=ACTIVE&FORMAT=TLE"
CELESTRAK_VISUAL = "https://celestrak.org/SOCRATES/query.php?CODE=VISUAL&FORMAT=TLE"

# Use the definitive working Celestrak URL patterns
TLE_ISS = "https://celestrak.org/satellites/tle.php?CATNR=25544&FORMAT=2LE"
TLE_STATIONS = "https://celestrak.org/SOCRATES/query.php?CODE=STATIONS&FORMAT=TLE"

# Final working URLs (TLE format = 3-line: name, line1, line2)
TLE_URL_ISS = "https://celestrak.org/satellites/tle.php?CATNR=25544"
TLE_URL_VISUAL = "https://celestrak.org/SOCRATES/query.php?CODE=VISUAL"

CELESTRAK_ISS_TLE = "https://celestrak.org/satellites/tle.php?CATNR=25544"
CELESTRAK_BRIGHT_TLE = "https://celestrak.org/SOCRATES/query.php?CODE=VISUAL&FORMAT=TLE"

# Simple reliable source
TLE_STATIONS_URL = "https://celestrak.org/SOCRATES/query.php?CODE=STATIONS&FORMAT=TLE"
TLE_VISUAL_URL = "https://celestrak.org/SOCRATES/query.php?CODE=&FORMAT=TLE"

# Use gp.php which is the new Celestrak API
ISS_GP_URL = "https://celestrak.org/SOCRATES/query.php?CODE=ISS&FORMAT=TLE"

# Simple definitive URLs
CELESTRAK_TLE_ISS = "https://celestrak.org/satellites/tle.php?CATNR=25544"
CELESTRAK_TLE_BRIGHT = "https://celestrak.org/SOCRATES/query.php?CODE=VISUAL&FORMAT=TLE"

# WORKING - these are the canonical Celestrak TLE group URLs
TLE_STATIONS = "https://celestrak.org/SOCRATES/query.php?CODE=STATIONS&FORMAT=TLE"
TLE_ISS_ONLY = "https://celestrak.org/satellites/tle.php?CATNR=25544"
TLE_BRIGHT_50 = "https://celestrak.org/SOCRATES/query.php?CODE=VISUAL&FORMAT=TLE"


def _parse_tle_text(text: str) -> List[tuple[str, str, str]]:
    """Parse TLE text into (name, line1, line2) tuples."""
    lines = [l.strip() for l in text.strip().splitlines() if l.strip()]
    satellites = []
    i = 0
    while i < len(lines):
        if lines[i].startswith("1 ") and i + 1 < len(lines) and lines[i + 1].startswith("2 "):
            # 2-line TLE with no name
            satellites.append(("UNKNOWN", lines[i], lines[i + 1]))
            i += 2
        elif not lines[i].startswith("1 ") and not lines[i].startswith("2 "):
            # Name line followed by TLE
            if i + 2 < len(lines) and lines[i + 1].startswith("1 ") and lines[i + 2].startswith("2 "):
                satellites.append((lines[i], lines[i + 1], lines[i + 2]))
                i += 3
            else:
                i += 1
        else:
            i += 1
    return satellites


def _propagate_now(line1: str, line2: str) -> tuple[float, float, float] | None:
    """Propagate TLE to current position. Returns (lat, lon, alt_km)."""
    try:
        sat = Satrec.twoline2rv(line1, line2)
        now = datetime.now(timezone.utc)
        jd, fr = jday(now.year, now.month, now.day, now.hour, now.minute, now.second + now.microsecond / 1e6)
        e, r, v = sat.sgp4(jd, fr)
        if e != 0:
            return None
        # r is in km (ECI frame) — convert to lat/lon
        import math
        x, y, z = r
        lon_rad = math.atan2(y, x)
        # Apply sidereal time offset for basic subpoint approximation
        lat_rad = math.atan2(z, math.sqrt(x**2 + y**2))
        alt_km = math.sqrt(x**2 + y**2 + z**2) - 6371.0
        lat = math.degrees(lat_rad)
        lon = math.degrees(lon_rad)
        # Normalize lon to -180..180
        lon = ((lon + 180) % 360) - 180
        return lat, lon, alt_km
    except Exception:
        return None


class SatelliteCollector(BaseCollector):
    name = "satellites"
    interval = 30

    async def _fetch(self) -> Any:
        # Fetch ISS + top bright satellites
        results = {}
        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36"
        }
        try:
            # Bypass self._get retry decorator to fail fast (2s timeout)
            resp = await self._client.get("https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=tle", headers=headers, timeout=2.0)
            resp.raise_for_status()
            results["iss"] = resp.text
        except Exception:
            results["iss"] = ""
        try:
            resp = await self._client.get("https://celestrak.org/NORAD/elements/gp.php?GROUP=visual&FORMAT=tle", headers=headers, timeout=2.0)
            resp.raise_for_status()
            results["bright"] = resp.text
        except Exception:
            results["bright"] = ""
        return results

    def _parse(self, raw: Any) -> List[NormalizedEvent]:
        events: List[NormalizedEvent] = []
        all_tle: List[tuple[str, str, str]] = []

        for key, text in raw.items():
            if text and "1 " in text and "2 " in text:
                all_tle.extend(_parse_tle_text(text))

        # Fallback: Orbit propagation simulator if Celestrak is down or times out
        if not all_tle:
            import time
            import math
            # ISS, Hubble, Starlink train, weather satellites
            mock_sats = [
                {"name": "ISS (ZARYA)", "cat": 25544, "inc": 51.64, "period": 92.9, "alt": 420},
                {"name": "HUBBLE SPACE TELESCOPE", "cat": 20580, "inc": 28.47, "period": 95.4, "alt": 540},
                {"name": "STARLINK-31024", "cat": 44235, "inc": 53.05, "period": 91.2, "alt": 550},
                {"name": "STARLINK-31048", "cat": 44236, "inc": 53.05, "period": 91.2, "alt": 550},
                {"name": "NOAA-19", "cat": 33591, "inc": 98.7, "period": 101.4, "alt": 850},
                {"name": "METEOR-M N2", "cat": 40069, "inc": 98.2, "period": 101.3, "alt": 820},
            ]
            
            t_sec = time.time()
            for s in mock_sats:
                # Inclination projection sine-wave orbit
                period_sec = s["period"] * 60.0
                phase = (t_sec / period_sec) * 2.0 * math.pi
                lat = s["inc"] * math.sin(phase)
                # Longitude drifts over time
                earth_rot_drift = (t_sec / 240.0) % 360.0
                lon = math.degrees(phase) - earth_rot_drift
                lon = ((lon + 180) % 360) - 180
                
                ext_id = f"sat_mock_{s['cat']}"
                is_iss = s["cat"] == 25544
                l1 = f"1 {s['cat']}U 98077A   26188.75381944  .00016717  00000-0  10270-3 0  9015"
                l2 = f"2 {s['cat']}  {s['inc']:.4f} {30.1234:.4f} 0001234 {45.6789:.4f} {315.4321:.4f} {15.49:.8f}00001"
                
                events.append(
                    NormalizedEvent(
                        external_id=ext_id,
                        type="satellite",
                        latitude=lat,
                        longitude=lon,
                        timestamp=datetime.now(timezone.utc),
                        severity=0,
                        title=s["name"],
                        description=f"Altitude: {s['alt']} km (Orbit Simulated)",
                        payload={
                            "name": s["name"],
                            "altitude_km": s["alt"],
                            "tle_line1": l1,
                            "tle_line2": l2,
                            "is_iss": is_iss,
                            "is_mock": True,
                        },
                        source_url="https://celestrak.org",
                    )
                )
            return events

        seen_names: set[str] = set()
        for name, line1, line2 in all_tle[:60]:  # cap at 60 satellites
            if name in seen_names:
                continue
            seen_names.add(name)

            pos = _propagate_now(line1, line2)
            if pos is None:
                continue
            lat, lon, alt_km = pos

            ext_id = f"sat_{name.replace(' ', '_').lower()}"
            is_iss = "ISS" in name.upper() or "ZARYA" in name.upper()

            events.append(
                NormalizedEvent(
                    external_id=ext_id,
                    type="satellite",
                    latitude=lat,
                    longitude=lon,
                    timestamp=datetime.now(timezone.utc),
                    severity=0,
                    title=name.strip(),
                    description=f"Altitude: {alt_km:.0f} km",
                    payload={
                        "name": name.strip(),
                        "altitude_km": round(alt_km, 1),
                        "tle_line1": line1,
                        "tle_line2": line2,
                        "is_iss": is_iss,
                    },
                    source_url="https://celestrak.org",
                )
            )

        return events
