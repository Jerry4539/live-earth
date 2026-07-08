from __future__ import annotations

import os
from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # App
    app_name: str = "WorldLive"
    app_env: str = "development"
    secret_key: str = "dev-secret-key-change-in-production"
    access_token_expire_minutes: int = 1440

    # Admin
    admin_username: str = "admin"
    admin_password: str = "worldlive-admin"

    # Database
    database_url: str = (
        "postgresql+asyncpg://worldlive:worldlive-secret@postgres:5432/worldlive"
    )

    # Redis
    redis_url: str = "redis://redis:6379/0"

    # CORS
    cors_origins: str = "http://localhost:3000,http://localhost:5173"

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",")]

    # Collector intervals (seconds)
    earthquakes_interval: int = 60
    weather_interval: int = 300
    satellites_interval: int = 30
    volcanoes_interval: int = 600
    wildfires_interval: int = 300
    airquality_interval: int = 180

    # External API keys (optional)
    vite_cesium_ion_token: str = ""
    nasa_firms_map_key: str = ""
    openaq_api_key: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()
