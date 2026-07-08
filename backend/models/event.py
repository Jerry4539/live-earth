"""ORM model for the ``events`` table."""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    Column,
    DateTime,
    Double,
    Integer,
    SmallInteger,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID

from database.session import Base


class Event(Base):
    __tablename__ = "events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    external_id = Column(String(256), index=True)
    type = Column(String(64), nullable=False, index=True)
    latitude = Column(Double, nullable=False)
    longitude = Column(Double, nullable=False)
    timestamp = Column(DateTime(timezone=True), nullable=False, index=True)
    severity = Column(SmallInteger, nullable=False, default=0)
    title = Column(Text)
    description = Column(Text)
    payload = Column(JSONB, nullable=False, default=dict)
    source_url = Column(Text)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)

    def to_dict(self) -> dict:
        return {
            "id": str(self.id),
            "external_id": self.external_id,
            "type": self.type,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "severity": self.severity,
            "title": self.title,
            "description": self.description,
            "payload": self.payload,
            "source_url": self.source_url,
        }
