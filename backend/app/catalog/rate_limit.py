# backend/app/catalog/rate_limit.py
"""In-process sliding-window rate limiter for catalog proxied calls.

Per-process, keyed on (scope, key). Sufficient for a single instance;
would need Redis for multi-instance deployments (M5+).
"""
from __future__ import annotations

import time
from collections import deque
from typing import Deque, Dict, Tuple


class SlidingWindow:
    def __init__(self, max_requests: int, window_seconds: float = 60.0):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._buckets: Dict[Tuple[str, str], Deque[float]] = {}
        self._last_cleanup = time.time()

    def allow(self, scope: str, key: str) -> tuple[bool, float]:
        """Return (allowed, retry_after_seconds)."""
        now = time.time()
        self._maybe_cleanup(now)
        k = (scope, key)
        dq = self._buckets.get(k)
        if dq is None:
            dq = deque()
            self._buckets[k] = dq
        # drop expired
        while dq and dq[0] <= now - self.window_seconds:
            dq.popleft()
        if len(dq) >= self.max_requests:
            retry = max(0.0, dq[0] + self.window_seconds - now)
            return False, retry
        dq.append(now)
        return True, 0.0

    def _maybe_cleanup(self, now: float) -> None:
        # Every ~10 minutes, drop fully-stale buckets
        if now - self._last_cleanup < 600:
            return
        self._last_cleanup = now
        for k in list(self._buckets.keys()):
            dq = self._buckets[k]
            while dq and dq[0] <= now - self.window_seconds:
                dq.popleft()
            if not dq:
                del self._buckets[k]


_catalog_limiter: SlidingWindow | None = None


def catalog_limiter() -> SlidingWindow:
    global _catalog_limiter
    from app.config import CATALOG_RATE_LIMIT_PER_MIN
    if _catalog_limiter is None:
        _catalog_limiter = SlidingWindow(CATALOG_RATE_LIMIT_PER_MIN, 60.0)
    return _catalog_limiter
