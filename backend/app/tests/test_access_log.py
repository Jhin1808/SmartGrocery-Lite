import logging

from app.access_log import RedactQueryString, install_access_log_redaction


def test_uvicorn_access_log_query_values_are_redacted():
    record = logging.LogRecord(
        "uvicorn.access", logging.INFO, __file__, 1,
        '%s - "%s %s HTTP/%s" %d',
        ("127.0.0.1", "GET", "/auth/google/callback?code=private&state=private", "1.1", 307),
        None,
    )
    assert RedactQueryString().filter(record)
    rendered = record.getMessage()
    assert "/auth/google/callback?[redacted]" in rendered
    assert "private" not in rendered


def test_access_log_filter_installation_is_idempotent():
    logger = logging.getLogger("uvicorn.access")
    install_access_log_redaction()
    install_access_log_redaction()
    assert sum(isinstance(item, RedactQueryString) for item in logger.filters) == 1
