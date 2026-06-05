"""Shared dependencies & helpers untuk routes modules.
Re-exports DB, auth, models, dan utility functions dari server.py.
Routes import dari sini agar decoupled dari server.py.
"""
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List
import os
import logging

logger = logging.getLogger(__name__)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()
