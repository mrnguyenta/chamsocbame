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


def test_telegram_setup_registers_webhook(monkeypatch):
    import api.index as api
    from fastapi.testclient import TestClient

    for k, v in {"DATABASE_URL": "postgresql://x", "TELEGRAM_BOT_TOKEN": "t", "TELEGRAM_WEBHOOK_SECRET": "h",
                 "CRON_SECRET": "c", "TOKEN_ENCRYPTION_KEY": "k"}.items():
        monkeypatch.setenv(k, v)
    calls = []

    def fake_call(self, method, payload):
        calls.append((method, payload))
        return {"username": "chamsoc_bot"} if method == "getMe" else True

    monkeypatch.setattr(api.TelegramClient, "_call", fake_call)
    from contextlib import contextmanager

    @contextmanager
    def fake_connect(url):
        yield None

    monkeypatch.setattr(api.db, "connect", fake_connect)
    monkeypatch.setattr(api.db, "get_setting", lambda conn, key: None)
    client = TestClient(api.app, base_url="https://chamsocbame-api.vercel.app")
    assert client.post("/api/telegram/setup").status_code == 401
    r = client.post("/api/telegram/setup", headers={"Authorization": "Bearer c"})
    assert r.json() == {"ok": True, "bot": "chamsoc_bot", "webhook": "https://chamsocbame-api.vercel.app/api/telegram/webhook"}
    assert calls[0] == ("setWebhook", {"url": "https://chamsocbame-api.vercel.app/api/telegram/webhook", "secret_token": "h",
                                       "allowed_updates": ["message", "callback_query"], "drop_pending_updates": True})
