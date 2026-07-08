"""APScheduler job registration for all data collectors."""
from __future__ import annotations

import asyncio
import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from collectors.earthquakes import EarthquakeCollector
from collectors.weather import WeatherCollector
from collectors.satellites import SatelliteCollector
from collectors.volcanoes import VolcanoCollector
from collectors.wildfires import WildfireCollector
from collectors.airquality import AirQualityCollector
from config import get_settings

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler(timezone="UTC")

# Collector instances (shared across job invocations)
_collectors = {
    "earthquakes": EarthquakeCollector(),
    "weather": WeatherCollector(),
    "satellites": SatelliteCollector(),
    "volcanoes": VolcanoCollector(),
    "wildfires": WildfireCollector(),
    "airquality": AirQualityCollector(),
}


def _make_job(name: str):
    async def _job():
        await _collectors[name].run_once()
    _job.__name__ = f"collect_{name}"
    return _job


def setup_scheduler() -> AsyncIOScheduler:
    settings = get_settings()
    intervals = {
        "earthquakes": settings.earthquakes_interval,
        "weather": settings.weather_interval,
        "satellites": settings.satellites_interval,
        "volcanoes": settings.volcanoes_interval,
        "wildfires": settings.wildfires_interval,
        "airquality": settings.airquality_interval,
    }

    for name, interval in intervals.items():
        scheduler.add_job(
            _make_job(name),
            trigger=IntervalTrigger(seconds=interval),
            id=f"collect_{name}",
            name=f"Collect {name}",
            replace_existing=True,
            max_instances=1,
            coalesce=True,
        )
        logger.info("Scheduled collector '%s' every %ds", name, interval)

    return scheduler


async def run_initial_collection() -> None:
    """Run all collectors once immediately on startup."""
    logger.info("Running initial collection pass…")
    tasks = [c.run_once() for c in _collectors.values()]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    for name, result in zip(_collectors.keys(), results):
        if isinstance(result, Exception):
            logger.warning("Initial collection failed for '%s': %s", name, result)
