"""Database initialisation — runs on startup. Automatically supports Postgres or SQLite."""
from __future__ import annotations

import asyncio
import logging
from pathlib import Path

import hashlib

from config import get_settings

logger = logging.getLogger(__name__)

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

MIGRATIONS_DIR = Path(__file__).parent.parent.parent / "database" / "migrations"

SQLITE_SCHEMA = """
-- SQLite Schema for WorldLive

CREATE TABLE IF NOT EXISTS layers (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    enabled     INTEGER NOT NULL DEFAULT 1,
    color       TEXT DEFAULT '#FFFFFF',
    icon        TEXT,
    created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO layers (name, display_name, enabled, color, icon) VALUES
    ('earthquakes', 'Earthquakes',  1,  '#FF6B35', 'seismic'),
    ('weather',     'Weather',      1,  '#4FC3F7', 'cloud'),
    ('satellites',  'Satellites',   1,  '#B39DDB', 'satellite'),
    ('volcanoes',   'Volcanoes',    1,  '#FF5252', 'volcano'),
    ('wildfires',   'Wildfires',    1,  '#FF8F00', 'fire'),
    ('airquality',  'Air Quality',  1,  '#66BB6A', 'air');

CREATE TABLE IF NOT EXISTS events (
    id              TEXT PRIMARY KEY,
    external_id     TEXT,
    type            TEXT NOT NULL,
    latitude        REAL NOT NULL,
    longitude       REAL NOT NULL,
    timestamp       TEXT NOT NULL,
    severity        INTEGER NOT NULL DEFAULT 0,
    title           TEXT,
    description     TEXT,
    payload         TEXT NOT NULL DEFAULT '{}',
    source_url      TEXT,
    created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS history (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id        TEXT NOT NULL,
    snapshot_time   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    payload         TEXT NOT NULL DEFAULT '{}',
    FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS users (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    username    TEXT NOT NULL UNIQUE,
    hashed_pw   TEXT NOT NULL,
    is_admin    INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS settings (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL DEFAULT '',
    description TEXT,
    is_secret   INTEGER NOT NULL DEFAULT 0,
    updated_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO settings (key, value, description, is_secret) VALUES
    ('cesium_ion_token',    '', 'CesiumJS Ion access token — get free at https://ion.cesium.com', 1),
    ('nasa_firms_map_key',  '', 'NASA FIRMS MAP_KEY for wildfire data — https://firms.modaps.eosdis.nasa.gov/api/', 1),
    ('openaq_api_key',      '', 'OpenAQ API key for air quality data — https://openaq.org', 1),
    ('earthquakes_interval','60',  'Earthquake polling interval (seconds)', 0),
    ('weather_interval',    '300', 'Weather polling interval (seconds)', 0),
    ('satellites_interval', '30',  'Satellite polling interval (seconds)', 0),
    ('volcanoes_interval',  '600', 'Volcano polling interval (seconds)', 0),
    ('wildfires_interval',  '300', 'Wildfire polling interval (seconds)', 0),
    ('airquality_interval', '180', 'Air quality polling interval (seconds)', 0);
"""


async def _run_sqlite_migrations(conn) -> None:  # type: ignore[type-arg]
    """Apply clean SQLite schema."""
    logger.info("Initializing SQLite schema...")
    for stmt in SQLITE_SCHEMA.split(";"):
        stmt = stmt.strip()
        if stmt:
            await conn.execute(stmt)
    await conn.commit()


async def _run_postgres_migrations(conn) -> None:  # type: ignore[type-arg]
    """Apply schema for PostgreSQL."""
    migration_files = sorted(MIGRATIONS_DIR.glob("*.sql"))
    for mf in migration_files:
        logger.info("Applying migration (Postgres): %s", mf.name)
        sql = mf.read_text()
        await conn.execute(sql)


async def _ensure_admin_sqlite(conn, settings) -> None:  # type: ignore[type-arg]
    cursor = await conn.execute(
        "SELECT id FROM users WHERE username = ?", (settings.admin_username,)
    )
    existing = await cursor.fetchone()
    if not existing:
        hashed = hash_password(settings.admin_password)
        await conn.execute(
            "INSERT INTO users (username, hashed_pw, is_admin) VALUES (?, ?, 1)",
            (settings.admin_username, hashed),
        )
        await conn.commit()
        logger.info("Admin user '%s' created.", settings.admin_username)


async def _sync_env_to_settings_sqlite(conn, settings) -> None:
    cursor = await conn.execute("SELECT key FROM settings WHERE value = '' OR value = '[]'")
    rows = await cursor.fetchall()
    empty_keys = [r[0] for r in rows]

    mapping = {
        "cesium_ion_token": settings.vite_cesium_ion_token,
        "nasa_firms_map_key": settings.nasa_firms_map_key,
        "openaq_api_key": settings.openaq_api_key,
    }

    for key in empty_keys:
        val = mapping.get(key)
        if val:
            await conn.execute("UPDATE settings SET value = ? WHERE key = ?", (val, key))
    await conn.commit()


async def _sync_env_to_settings_postgres(conn, settings) -> None:
    rows = await conn.fetch("SELECT key FROM settings WHERE value = '' OR value = '[]'")
    empty_keys = [r['key'] for r in rows]

    mapping = {
        "cesium_ion_token": settings.vite_cesium_ion_token,
        "nasa_firms_map_key": settings.nasa_firms_map_key,
        "openaq_api_key": settings.openaq_api_key,
    }

    for key in empty_keys:
        val = mapping.get(key)
        if val:
            await conn.execute("UPDATE settings SET value = $1 WHERE key = $2", val, key)


async def init_db() -> None:
    from database.session import DATABASE_URL

    settings = get_settings()

    if DATABASE_URL.startswith("sqlite"):
        import aiosqlite
        db_path = DATABASE_URL.replace("sqlite+aiosqlite:///", "")
        logger.info("Using SQLite database: %s", db_path)
        async with aiosqlite.connect(db_path) as conn:
            conn.row_factory = aiosqlite.Row
            await _run_sqlite_migrations(conn)
            await _ensure_admin_sqlite(conn, settings)
            await _sync_env_to_settings_sqlite(conn, settings)
    else:
        import asyncpg
        dsn = DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")
        for attempt in range(10):
            try:
                conn = await asyncpg.connect(dsn)
                break
            except Exception as exc:
                logger.warning("DB not ready (%s), retrying in 2s… (%d/10)", exc, attempt + 1)
                await asyncio.sleep(2)
        else:
            raise RuntimeError("Could not connect to database after 10 attempts")
        try:
            await _run_postgres_migrations(conn)
            # Ensure admin user
            existing = await conn.fetchrow(
                "SELECT id FROM users WHERE username = $1", settings.admin_username
            )
            if not existing:
                hashed = hash_password(settings.admin_password)
                await conn.execute(
                    "INSERT INTO users (username, hashed_pw, is_admin) VALUES ($1, $2, TRUE)",
                    settings.admin_username, hashed,
                )
                logger.info("Admin user '%s' created.", settings.admin_username)
            await _sync_env_to_settings_postgres(conn, settings)
        finally:
            await conn.close()
