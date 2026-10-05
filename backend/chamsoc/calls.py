"""Gọi điện tự động khi không ai phản hồi cảnh báo.

Hiện để sẵn giao diện, chưa tích hợp nhà cung cấp. Khi cần, viết một lớp mới
(ví dụ Stringee hoặc Twilio) có hàm `call()` và đăng ký trong `get_provider()`,
rồi đặt biến môi trường CALL_PROVIDER.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Protocol

log = logging.getLogger(__name__)


@dataclass
class CallResult:
    provider: str
    status: str  # "skipped" | "queued" | "failed"
    detail: str = ""


class CallProvider(Protocol):
    name: str

    def call(self, phone: str, message: str) -> CallResult: ...


class NoopCallProvider:
    """Không gọi thật, chỉ ghi lại để biết lúc đó lẽ ra sẽ gọi."""

    name = "none"

    def call(self, phone: str, message: str) -> CallResult:
        log.info("Bỏ qua cuộc gọi tới %s (chưa cấu hình nhà cung cấp)", phone)
        return CallResult(self.name, "skipped", "CALL_PROVIDER chưa được cấu hình")


def get_provider(name: str | None) -> CallProvider:
    if not name or name == "none":
        return NoopCallProvider()
    raise ValueError(f"Nhà cung cấp gọi điện chưa được hỗ trợ: {name}")
