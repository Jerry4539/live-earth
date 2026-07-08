"""WorldLive FastAPI application entry point."""
from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.auth import router as auth_router
from api.events import router as events_router
from api.layers import router as layers_router
from api.replay import router as replay_router
from api.settings import router as settings_router
from config import get_settings
from database.init_db import init_db
from scheduler.jobs import run_initial_collection, setup_scheduler
from websocket.manager import manager
from websocket.router import router as ws_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

settings = get_settings()

app = FastAPI(
    title="WorldLive API",
    description="Real-time global event monitoring — self-hosted",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

# ── CORS ─────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth_router)
app.include_router(events_router)
app.include_router(layers_router)
app.include_router(replay_router)
app.include_router(settings_router)
app.include_router(ws_router)


# ── Lifecycle ─────────────────────────────────────────────────────────────────
@app.on_event("startup")
async def startup() -> None:
    logger.info("WorldLive API starting…")
    await init_db()
    await manager.startup()
    scheduler = setup_scheduler()
    scheduler.start()
    await run_initial_collection()
    logger.info("WorldLive API ready ✓")


@app.on_event("shutdown")
async def shutdown() -> None:
    from scheduler.jobs import scheduler
    if scheduler.running:
        scheduler.shutdown(wait=False)
    await manager.shutdown()
    logger.info("WorldLive API shut down.")


# ── Health ────────────────────────────────────────────────────────────────────
@app.get("/api/health")
async def health() -> dict:
    return {"status": "ok", "version": "1.0.0"}


@app.get("/api/stats")
async def stats() -> dict:
    from database.session import AsyncSessionLocal
    from sqlalchemy import func, select, text
    from models.event import Event

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Event.type, func.count(Event.id).label("count"))
            .group_by(Event.type)
        )
        counts = {row.type: row.count for row in result}

    return {
        "events_by_type": counts,
        "websocket_clients": manager.count,
    }
