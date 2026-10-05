import importlib

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def client(monkeypatch):
    for k, v in {"DATABASE_URL": "postgresql://unused", "TELEGRAM_BOT_TOKEN": "t",
                 "TELEGRAM_WEBHOOK_SECRET": "hook", "CRON_SECRET": "cron",
                 "TOKEN_ENCRYPTION_KEY": "k"}.items():
        monkeypatch.setenv(k, v)
    return TestClient(importlib.import_module("api.index").app)


def test_health(client):
    assert client.get("/api/health").json() == {"ok": True}


def test_cron_and_webhook_reject_missing_or_wrong_secret(client):
    assert client.post("/api/cron/sync").status_code == 401
    assert client.post("/api/cron/tick", headers={"Authorization": "Bearer sai"}).status_code == 401
    r = client.post("/api/telegram/webhook", json={},
                    headers={"X-Telegram-Bot-Api-Secret-Token": "sai"})
    assert r.status_code == 401
