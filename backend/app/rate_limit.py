import time
from collections import defaultdict, deque
from typing import Tuple


_windows: dict[Tuple[str, str], deque[float]] = defaultdict(deque)


def allow(key: str, scope: str, max_requests: int, window_seconds: int) -> bool:
    """Simple in-process sliding-window rate limit.

    key: identifier (e.g., IP or email)
    scope: logical bucket name (e.g., "forgot-ip" or "forgot-email")
    max_requests: allowed count per window
    window_seconds: window size in seconds
    """
    now = time.time()
    dq = _windows[(scope, key)]
    # drop old entries
    cutoff = now - window_seconds
    while dq and dq[0] < cutoff:
        dq.popleft()
    if len(dq) >= max_requests:
        return False
    dq.append(now)
    return True

