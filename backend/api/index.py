"""Điểm vào cho Vercel (Python runtime).

- POST /api/cron/sync        mỗi 15 phút: đọc Garmin, đánh giá cảnh báo
- POST /api/cron/tick        mỗi 5 phút: gửi/leo thang cảnh báo, nhắc thuốc, báo cáo
- POST /api/telegram/webhook tin nhắn và nút bấm từ Telegram
Supabase pg_cron gọi hai địa chỉ cron (xem supabase/cron.sql).
"""

from __future__ import annotations

import hmac
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, Header, HTTPException, Request

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from chamsoc import db, jobs  # noqa: E402
from chamsoc.calls import get_provider  # noqa: E402
from chamsoc.config import Settings  # noqa: E402
from chamsoc.telegram import TelegramClient  # noqa: E402

logging.basicConfig(level=logging.INFO)
app = FastAPI(title="Chăm Sóc Ba Mẹ")


def _settings() -> Settings:
    return Settings.from_env()


def _check(given: str | None, expected: str) -> None:
    if not given or not hmac.compare_digest(given, expected):
        raise HTTPException(status_code=401)


@app.get("/api/health")
def health() -> dict:
    return {"ok": True}


@app.post("/api/cron/sync")
def cron_sync(authorization: str | None = Header(default=None)) -> dict:
    s = _settings()
    _check(authorization, f"Bearer {s.cron_secret}")
    with db.connect(s.database_url) as conn:
        n = jobs.sync_all(conn, s, TelegramClient(s.telegram_bot_token), datetime.now(timezone.utc))
    return {"synced": n}


@app.post("/api/cron/tick")
def cron_tick(authorization: str | None = Header(default=None)) -> dict:
    s = _settings()
    _check(authorization, f"Bearer {s.cron_secret}")
    with db.connect(s.database_url) as conn:
        jobs.tick(conn, TelegramClient(s.telegram_bot_token), get_provider(s.call_provider),
                  datetime.now(timezone.utc))
    return {"ok": True}


@app.post("/api/telegram/webhook")
async def telegram_webhook(
    request: Request,
    x_telegram_bot_api_secret_token: str | None = Header(default=None),
) -> dict:
    s = _settings()
    _check(x_telegram_bot_api_secret_token, s.telegram_webhook_secret)
    update = await request.json()
    try:
        with db.connect(s.database_url) as conn:
            jobs.handle_update(conn, TelegramClient(s.telegram_bot_token),
                               get_provider(s.call_provider), update, datetime.now(timezone.utc))
    except Exception:
        # Luôn trả 200 để Telegram không gửi lại mãi một tin lỗi.
        logging.exception("Xử lý tin Telegram lỗi")
    return {"ok": True}
