"""WebSocket connection manager with Redis pub/sub broadcast."""
from __future__ import annotations

import asyncio
import json
import logging
from typing import Dict, Optional, Set

import redis.asyncio as aioredis
from fastapi import WebSocket

from config import get_settings

logger = logging.getLogger(__name__)

CHANNEL = "worldlive:events"


class ConnectionManager:
    def __init__(self) -> None:
        # active_connections: {layer_filter -> set of WebSocket}
        self._connections: Dict[str, Set[WebSocket]] = {"*": set()}
        self._redis: Optional[aioredis.Redis] = None
        self._pubsub_task: Optional[asyncio.Task] = None  # type: ignore[type-arg]

    async def startup(self) -> None:
        settings = get_settings()
        try:
            self._redis = aioredis.from_url(settings.redis_url, decode_responses=True)
            await self._redis.ping()
            self._pubsub_task = asyncio.create_task(self._listen())
            logger.info("WebSocket manager started with Redis pub/sub on '%s'", CHANNEL)
        except Exception as exc:
            logger.warning("Redis not available (%s) — using in-process broadcast only", exc)
            self._redis = None

    async def shutdown(self) -> None:
        if self._pubsub_task:
            self._pubsub_task.cancel()
        if self._redis:
            await self._redis.aclose()

    async def connect(self, websocket: WebSocket, layer: str = "*") -> None:
        await websocket.accept()
        self._connections.setdefault(layer, set()).add(websocket)
        self._connections.setdefault("*", set()).add(websocket)
        logger.debug("WS connected (layer=%s), total=%d", layer, self.count)

    def disconnect(self, websocket: WebSocket, layer: str = "*") -> None:
        for bucket in self._connections.values():
            bucket.discard(websocket)
        logger.debug("WS disconnected, total=%d", self.count)

    @property
    def count(self) -> int:
        return len(self._connections.get("*", set()))

    async def broadcast(self, message: dict) -> None:
        """Broadcast to all connected clients (and publish to Redis)."""
        data = json.dumps(message)
        dead: list[WebSocket] = []
        for ws in list(self._connections.get("*", set())):
            try:
                await ws.send_text(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)
        # Also publish so other worker processes receive it
        if self._redis:
            await self._redis.publish(CHANNEL, data)

    async def publish(self, message: dict) -> None:
        """Publish to Redis channel (used by collectors running in workers)."""
        if self._redis:
            await self._redis.publish(CHANNEL, json.dumps(message))

    async def _listen(self) -> None:
        """Subscribe to Redis and fan out to local WebSocket clients."""
        if not self._redis:
            return
        pubsub = self._redis.pubsub()
        await pubsub.subscribe(CHANNEL)
        try:
            async for message in pubsub.listen():
                if message["type"] != "message":
                    continue
                data = message["data"]
                dead: list[WebSocket] = []
                for ws in list(self._connections.get("*", set())):
                    try:
                        await ws.send_text(data)
                    except Exception:
                        dead.append(ws)
                for ws in dead:
                    self.disconnect(ws)
        except asyncio.CancelledError:
            pass
        finally:
            await pubsub.unsubscribe(CHANNEL)


manager = ConnectionManager()
