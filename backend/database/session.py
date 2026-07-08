from __future__ import annotations

import os
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from config import get_settings

settings = get_settings()

# Support both PostgreSQL (production/Docker) and SQLite (local dev)
DATABASE_URL = settings.database_url

# Auto-detect local dev: if DB_URL still points to 'postgres' hostname, switch to SQLite
if "postgres:5432" in DATABASE_URL or DATABASE_URL.startswith("postgresql+asyncpg://worldlive:worldlive-secret@postgres"):
    # Check if we can actually reach it; if not, fall back
    import socket
    try:
        sock = socket.create_connection(("127.0.0.1", 5432), timeout=1)
        sock.close()
        # Postgres is available locally — switch to localhost
        DATABASE_URL = DATABASE_URL.replace("@postgres:5432", "@localhost:5432")
    except OSError:
        # No postgres — use SQLite
        DATABASE_URL = "sqlite+aiosqlite:///./worldlive.db"

# For SQLite we need check_same_thread=False via connect_args
connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
    engine = create_async_engine(
        DATABASE_URL,
        echo=settings.app_env == "development",
        connect_args=connect_args,
    )
else:
    engine = create_async_engine(
        DATABASE_URL,
        echo=settings.app_env == "development",
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True,
    )

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


async def get_db():  # type: ignore[return]
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
