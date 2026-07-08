"""Layers REST API — toggle and inspect data source layers."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from database.session import get_db
from models.layer import Layer

router = APIRouter(prefix="/api/layers", tags=["layers"])


class LayerUpdate(BaseModel):
    enabled: bool


@router.get("")
async def list_layers(db: AsyncSession = Depends(get_db)) -> dict:
    result = await db.execute(select(Layer).order_by(Layer.id))
    layers = result.scalars().all()
    return {"layers": [l.to_dict() for l in layers]}


@router.patch("/{name}")
async def update_layer(
    name: str,
    body: LayerUpdate,
    db: AsyncSession = Depends(get_db),
) -> dict:
    await db.execute(
        update(Layer).where(Layer.name == name).values(enabled=body.enabled)
    )
    result = await db.execute(select(Layer).where(Layer.name == name))
    layer = result.scalar_one_or_none()
    if not layer:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Layer not found")
    return layer.to_dict()
