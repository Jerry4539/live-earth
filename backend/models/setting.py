"""ORM model for the ``settings`` key-value table."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, String, Text

from database.session import Base


class Setting(Base):
    __tablename__ = "settings"

    key = Column(String(128), primary_key=True)
    value = Column(Text, nullable=False, default="")
    description = Column(Text)
    is_secret = Column(Boolean, nullable=False, default=False)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self, redact: bool = False) -> dict:
        return {
            "key": self.key,
            "value": "••••••••" if (redact and self.is_secret and self.value) else self.value,
            "description": self.description,
            "is_secret": self.is_secret,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "has_value": bool(self.value),
        }
