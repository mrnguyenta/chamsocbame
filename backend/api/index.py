"""Điểm vào cho Vercel (Python runtime).

- POST /api/cron/sync        mỗi 15 phút: đọc Garmin, đánh giá cảnh báo
- POST /api/cron/tick        mỗi 5 phút: gửi/leo thang cảnh báo, nhắc thuốc, báo cáo
- POST /api/telegram/webhook tin nhắn và nút bấm từ Telegram
- POST /api/telegram/setup   (Bearer CRON_SECRET) đăng ký webhook cho bot sau khi đặt TELEGRAM_BOT_TOKEN
- POST /api/watch/push       ứng dụng Connect IQ trên đồng hồ gửi dữ liệu mỗi 5 phút
- POST /api/watch/pair/start đồng hồ xin mã ghép 6 số; GET /api/watch/pair/status hỏi đã ghép chưa
Supabase pg_cron gọi hai địa chỉ cron (xem supabase/cron.sql).
"""

from __future__ import annotations

import hashlib
import hmac
import logging
import secrets
import sys
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from chamsoc import db, jobs  # noqa: E402
from chamsoc.calls import get_provider  # noqa: E402
from chamsoc.config import Settings  # noqa: E402
from chamsoc.telegram import TelegramClient  # noqa: E402

logging.basicConfig(level=logging.INFO)
app = FastAPI(title="Chăm Sóc Ba Mẹ")


def _settings() -> Settings:
    return Settings.from_env()


def _tg(conn, s: Settings) -> TelegramClient:
    """Token bot: ưu tiên token nhập ở trang /quan-tri (bảng app_settings), không có thì lấy biến môi trường."""
    return TelegramClient(db.get_setting(conn, "telegram_bot_token") or s.telegram_bot_token)


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
        n = jobs.sync_all(conn, s, _tg(conn, s), datetime.now(timezone.utc))
    return {"synced": n}


@app.post("/api/cron/tick")
def cron_tick(authorization: str | None = Header(default=None)) -> dict:
    s = _settings()
    _check(authorization, f"Bearer {s.cron_secret}")
    with db.connect(s.database_url) as conn:
        jobs.tick(conn, _tg(conn, s), get_provider(s.call_provider),
                  datetime.now(timezone.utc))
    return {"ok": True}


@app.post("/api/telegram/setup")
def telegram_setup(request: Request, authorization: str | None = Header(default=None)) -> dict:
    """Đăng ký lại webhook cho bot (token lấy từ trang /quan-tri hoặc biến môi trường)."""
    s = _settings()
    _check(authorization, f"Bearer {s.cron_secret}")
    with db.connect(s.database_url) as conn:
        tg = _tg(conn, s)
    url = str(request.url_for("telegram_webhook"))
    if url.startswith("http://"):
        url = "https://" + url[len("http://"):]
    tg.set_webhook(url, s.telegram_webhook_secret)
    me = tg.get_me()
    return {"ok": True, "bot": me.get("username"), "webhook": url}


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
            jobs.handle_update(conn, _tg(conn, s),
                               get_provider(s.call_provider), update, datetime.now(timezone.utc))
    except Exception:
        # Luôn trả 200 để Telegram không gửi lại mãi một tin lỗi.
        logging.exception("Xử lý tin Telegram lỗi")
    return {"ok": True}


class WatchPush(BaseModel):
    v: int = 1
    ts: int | None = None
    # Giá trị ngoài 20–250 bị bỏ khi lưu; không từ chối cả lần gửi vì một số đo lạ.
    hr: int | None = Field(default=None, ge=0, le=255)
    hr_samples: list[tuple[int, int]] = Field(default_factory=list, max_length=200)
    resting_hr: int | None = Field(default=None, ge=0, le=255)
    steps: int | None = Field(default=None, ge=0)
    stress: int | None = Field(default=None, ge=-2, le=100)
    body_battery: int | None = Field(default=None, ge=0, le=100)
    spo2: int | None = Field(default=None, ge=0, le=100)
    respiration: int | None = Field(default=None, ge=0, le=80)
    battery: int | None = Field(default=None, ge=0, le=100)
    charging: bool | None = None
    calories: int | None = Field(default=None, ge=0, le=20000)
    distance_m: int | None = Field(default=None, ge=0, le=200000)
    floors: int | None = Field(default=None, ge=0, le=1000)
    active_min: int | None = Field(default=None, ge=0, le=1440)
    move_bar: int | None = Field(default=None, ge=0, le=5)
    stress_1h: int | None = Field(default=None, ge=0, le=100)
    device: str | None = None


@app.post("/api/watch/push")
def watch_push(body: WatchPush, authorization: str | None = Header(default=None)) -> dict:
    s = _settings()
    key_hash = _key_hash(authorization)
    with db.connect(s.database_url) as conn:
        device = db.watch_device_by_key(conn, key_hash)
        if device is None:
            raise HTTPException(status_code=401)
        payload = body.model_dump()
        # Garmin dùng số âm cho "chưa có dữ liệu" (stress -1, -2).
        if payload["stress"] is not None and payload["stress"] < 0:
            payload["stress"] = None
        jobs.handle_watch_push(conn, _tg(conn, s),
                               get_provider(s.call_provider), device, payload,
                               datetime.now(timezone.utc))
    return {"ok": True}


def _key_hash(authorization: str | None) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401)
    return hashlib.sha256(authorization[7:].strip().encode()).hexdigest()


class PairStart(BaseModel):
    device: str | None = Field(default=None, max_length=64)


DEFAULT_WEB_URL = "https://chamsocbame.vercel.app"
PAIR_TTL_S = 15 * 60


@app.post("/api/watch/pair/start")
def watch_pair_start(body: PairStart) -> dict:
    """Đồng hồ chưa có khoá: cấp mã 6 số để hiện lên màn hình và khoá bí mật để giữ lại."""
    s = _settings()
    key = secrets.token_urlsafe(24)
    key_hash = hashlib.sha256(key.encode()).hexdigest()
    with db.connect(s.database_url) as conn:
        for _ in range(10):
            code = f"{secrets.randbelow(10**6):06d}"
            if db.start_pairing(conn, code, key_hash, body.device):
                # link: đồng hồ bật thông báo trên điện thoại, bấm vào là mở trang kết nối có sẵn mã.
                web = (s.web_url or DEFAULT_WEB_URL).rstrip("/")
                return {"code": code, "key": key, "expires_in": PAIR_TTL_S, "link": f"{web}/d/{code}"}
    raise HTTPException(status_code=503)


@app.get("/api/watch/pair/status")
def watch_pair_status(authorization: str | None = Header(default=None)):
    s = _settings()
    key_hash = _key_hash(authorization)
    with db.connect(s.database_url) as conn:
        row = db.pairing_status(conn, key_hash)
    if row is None:
        raise HTTPException(status_code=404)
    if row["claimed_at"]:
        return {"status": "paired", "elder": row["display_name"]}
    if row["expired"]:
        # Mã hết hạn: đồng hồ xin mã mới.
        return JSONResponse({"status": "expired"}, status_code=410)
    return {"status": "pending"}
