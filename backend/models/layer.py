"""ORM model for the ``layers`` table."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Integer, String

from database.session import Base


class Layer(Base):
    __tablename__ = "layers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(64), nullable=False, unique=True)
    display_name = Column(String(128), nullable=False)
    enabled = Column(Boolean, nullable=False, default=True)
    color = Column(String(16), default="#FFFFFF")
    icon = Column(String(64))
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "display_name": self.display_name,
            "enabled": self.enabled,
            "color": self.color,
            "icon": self.icon,
        }
