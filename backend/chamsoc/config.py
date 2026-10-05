from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    database_url: str
    telegram_bot_token: str
    telegram_webhook_secret: str
    cron_secret: str
    token_encryption_key: str
    call_provider: str = "none"
    web_url: str = ""

    @classmethod
    def from_env(cls) -> "Settings":
        def need(name: str) -> str:
            v = os.environ.get(name)
            if not v:
                raise RuntimeError(f"Thiếu biến môi trường {name}")
            return v

        return cls(
            database_url=need("DATABASE_URL"),
            telegram_bot_token=need("TELEGRAM_BOT_TOKEN"),
            telegram_webhook_secret=need("TELEGRAM_WEBHOOK_SECRET"),
            cron_secret=need("CRON_SECRET"),
            token_encryption_key=need("TOKEN_ENCRYPTION_KEY"),
            call_provider=os.environ.get("CALL_PROVIDER", "none"),
            web_url=os.environ.get("WEB_URL", ""),
        )
