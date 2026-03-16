"""Tests for Redis/DB reconnection behavior (WRK-02)."""

from unittest.mock import MagicMock, patch


def test_redis_client_has_retry_config():
    """Verify QueueService creates Redis client with retry configuration."""
    with patch("redis.Redis") as mock_redis:
        from services.queue import QueueService

        qs = QueueService("localhost:6379")
        call_kwargs = mock_redis.call_args[1]
        assert "retry" in call_kwargs
        assert "retry_on_error" in call_kwargs
        assert call_kwargs["health_check_interval"] == 30
        assert call_kwargs["socket_timeout"] == 10
        assert call_kwargs["socket_connect_timeout"] == 5


def test_db_service_reconnects_on_failure():
    """Verify DBService uses tenacity retry for connection."""
    import psycopg2

    mock_conn = MagicMock()
    mock_conn.closed = False

    with patch(
        "psycopg2.connect",
        side_effect=[psycopg2.OperationalError("fail"), mock_conn],
    ):
        from services.db import DBService

        db = DBService("postgresql://localhost/test")
        assert db.conn is mock_conn
