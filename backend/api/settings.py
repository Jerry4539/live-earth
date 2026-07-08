"""Settings REST API — read and update runtime configuration."""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Dict, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.auth import verify_token, TokenData
from database.session import get_db
from models.setting import Setting

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/settings", tags=["settings"])

# Keys allowed to be read/written via the API
ALLOWED_KEYS = {
    "cesium_ion_token",
    "nasa_firms_map_key",
    "openaq_api_key",
    "earthquakes_interval",
    "weather_interval",
    "satellites_interval",
    "volcanoes_interval",
    "wildfires_interval",
    "airquality_interval",
}

# The "public" endpoint (GET) returns values with secrets redacted
# Only an authenticated user sees real values


class SettingPatch(BaseModel):
    value: str


class BulkPatch(BaseModel):
    settings: Dict[str, str]


@router.get("")
async def get_settings(
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Return all settings.
    Secret values are shown as '••••••••' unless the user is authenticated.
    has_value tells the frontend whether a key has been set.
    """
    result = await db.execute(select(Setting).order_by(Setting.key))
    settings = result.scalars().all()
    return {
        "settings": [s.to_dict(redact=True) for s in settings]
    }


@router.get("/full")
async def get_settings_full(
    db: AsyncSession = Depends(get_db),
    token: TokenData = Depends(verify_token),
) -> dict:
    """Return all settings with real values (requires auth)."""
    result = await db.execute(select(Setting).order_by(Setting.key))
    settings = result.scalars().all()
    return {
        "settings": [s.to_dict(redact=False) for s in settings]
    }


@router.patch("/{key}")
async def update_setting(
    key: str,
    body: SettingPatch,
    db: AsyncSession = Depends(get_db),
    token: TokenData = Depends(verify_token),
) -> dict:
    """Update a single setting value (requires auth)."""
    if key not in ALLOWED_KEYS:
        raise HTTPException(status_code=400, detail=f"Unknown setting key: {key}")

    result = await db.execute(select(Setting).where(Setting.key == key))
    setting = result.scalar_one_or_none()

    if setting is None:
        raise HTTPException(status_code=404, detail="Setting not found")

    setting.value = body.value.strip()
    setting.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(setting)

    logger.info("Setting '%s' updated by '%s'", key, token.username)
    _apply_runtime(key, setting.value)

    return setting.to_dict(redact=False)


@router.post("/bulk")
async def bulk_update(
    body: BulkPatch,
    db: AsyncSession = Depends(get_db),
    token: TokenData = Depends(verify_token),
) -> dict:
    """Update multiple settings at once (requires auth)."""
    invalid = [k for k in body.settings if k not in ALLOWED_KEYS]
    if invalid:
        raise HTTPException(status_code=400, detail=f"Unknown keys: {invalid}")

    updated: List[dict] = []
    for key, value in body.settings.items():
        result = await db.execute(select(Setting).where(Setting.key == key))
        setting = result.scalar_one_or_none()
        if setting:
            setting.value = value.strip()
            setting.updated_at = datetime.now(timezone.utc)
            updated.append(setting.to_dict(redact=False))
            _apply_runtime(key, value.strip())

    await db.commit()
    logger.info("Bulk settings updated (%d keys) by '%s'", len(updated), token.username)
    return {"updated": updated}


def _apply_runtime(key: str, value: str) -> None:
    """Apply setting changes to the live config without restart."""
    from config import get_settings
    from scheduler.jobs import scheduler, _collectors

    settings = get_settings()
    interval_map = {
        "earthquakes_interval": "earthquakes",
        "weather_interval": "weather",
        "satellites_interval": "satellites",
        "volcanoes_interval": "volcanoes",
        "wildfires_interval": "wildfires",
        "airquality_interval": "airquality",
    }

    if key in interval_map and value:
        try:
            interval = int(value)
            collector_name = interval_map[key]
            job_id = f"collect_{collector_name}"
            if scheduler.get_job(job_id):
                from apscheduler.triggers.interval import IntervalTrigger
                scheduler.reschedule_job(job_id, trigger=IntervalTrigger(seconds=interval))
                logger.info("Rescheduled '%s' to %ds interval", collector_name, interval)
        except (ValueError, Exception) as e:
            logger.warning("Could not reschedule job for '%s': %s", key, e)

    elif key == "nasa_firms_map_key":
        # Reload will pick up from DB next poll cycle
        pass
    elif key == "openaq_api_key":
        pass
    elif key == "cesium_ion_token":
        # Frontend reads this from /api/settings/public endpoint
        pass
