"""Keep request paths in access logs without recording query-string credentials."""

import logging


class RedactQueryString(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        # Uvicorn emits: client, method, path_with_query, HTTP version, status.
        args = record.args
        if isinstance(args, tuple) and len(args) >= 3:
            path = args[2]
            if isinstance(path, str) and "?" in path:
                record.args = (*args[:2], path.partition("?")[0] + "?[redacted]", *args[3:])
        return True


def install_access_log_redaction() -> None:
    logger = logging.getLogger("uvicorn.access")
    if not any(isinstance(item, RedactQueryString) for item in logger.filters):
        logger.addFilter(RedactQueryString())
