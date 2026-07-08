"""ORM model for the ``history`` table."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import BigInteger, Column, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB, UUID

from database.session import Base


class History(Base):
    __tablename__ = "history"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    event_id = Column(UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True)
    snapshot_time = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, index=True)
    payload = Column(JSONB, nullable=False, default=dict)
