import time
from collections import defaultdict, deque
from typing import Tuple


_windows: dict[Tuple[str, str], deque[float]] = defaultdict(deque)

_last_cleanup = 0.0


def allow(key: str, scope: str, max_requests: int, window_seconds: int) -> bool:
    """Simple in-process sliding-window rate limit.

    key: identifier (e.g., IP or email)
    scope: logical bucket name (e.g., "forgot-ip" or "forgot-email")
    max_requests: allowed count per window
    window_seconds: window size in seconds
    """
    now = time.time()
    dq = _windows[(scope, key)]

    # Periodic cleanup of stale scope+key entries (every ~10 min)
    global _last_cleanup
    if now - _last_cleanup > 600:
        dead = [
            (k, dq)
            for k, dq in list(_windows.items())
            if not dq or dq[-1] < now - max(3600, window_seconds)
        ]
        for k, _ in dead:
            del _windows[k]
        _last_cleanup = now

    # Drop old entries within this key's deque
    cutoff = now - window_seconds
    while dq and dq[0] < cutoff:
        dq.popleft()
    if len(dq) >= max_requests:
        return False
    dq.append(now)
    return True
