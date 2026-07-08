"""WebSocket endpoint router."""
from __future__ import annotations

import json
import logging

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from websocket.manager import manager

logger = logging.getLogger(__name__)
router = APIRouter()


@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    layer: str = Query(default="*", description="Layer filter or '*' for all"),
) -> None:
    await manager.connect(websocket, layer)
    # Send initial connected message
    await websocket.send_text(
        json.dumps({"type": "connected", "layer": layer, "clients": manager.count})
    )
    try:
        while True:
            # Keep connection alive; clients may send pings
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
    except WebSocketDisconnect:
        manager.disconnect(websocket, layer)
        logger.debug("Client disconnected (layer=%s)", layer)
