"""Liên kết tài khoản Garmin Connect từ website (thay cho chạy link_garmin.py trên máy tính).

Một lượt gọi /api/garmin/link làm trọn việc đăng nhập. Nếu Garmin gửi mã xác thực qua email,
lượt gọi đó chờ (tối đa `wait_s` giây) cho tới khi website ghi mã vào garmin_link_requests,
vì phiên đăng nhập dở dang chỉ sống trong bộ nhớ của lượt gọi này.
"""

from __future__ import annotations

import logging
import time
from typing import Callable

from garminconnect import Garmin, GarminConnectAuthenticationError

from . import crypto, db

log = logging.getLogger(__name__)


def _set(conn, request_id: str, status: str, message: str | None = None) -> None:
    conn.execute(
        "update garmin_link_requests set status = %s, message = %s, updated_at = now() where id = %s",
        (status, message, request_id),
    )


def _take_code(conn, request_id: str) -> str | None:
    row = conn.execute(
        """
        with old as (select id, mfa_code from garmin_link_requests
                     where id = %s and mfa_code is not null for update)
        update garmin_link_requests g set mfa_code = null, status = 'checking_code', updated_at = now()
        from old where g.id = old.id
        returning old.mfa_code as code
        """,
        (request_id,),
    ).fetchone()
    return row["code"] if row else None


def link(conn, encryption_key: str, request_id: str, elder_id: str, email: str, password: str, *,
         wait_s: float = 240, poll_s: float = 2, make_client: Callable[..., Garmin] = Garmin,
         sleep: Callable[[float], None] = time.sleep, clock: Callable[[], float] = time.monotonic) -> str:
    """Trả về trạng thái cuối: done, failed hoặc expired (cũng được ghi vào garmin_link_requests)."""
    client = make_client(email, password, return_on_mfa=True)
    try:
        status, _ = client.login()
    except GarminConnectAuthenticationError:
        _set(conn, request_id, "failed", "Sai email hoặc mật khẩu Garmin.")
        return "failed"
    except Exception as e:  # Garmin chặn tạm thời, lỗi mạng...
        log.exception("Đăng nhập Garmin lỗi")
        _set(conn, request_id, "failed", f"Garmin chưa cho đăng nhập lúc này, thử lại sau ít phút ({type(e).__name__}).")
        return "failed"

    if status == "needs_mfa":
        _set(conn, request_id, "awaiting_mfa", "Garmin đã gửi mã xác thực về email. Nhập mã vào ô bên dưới.")
        deadline = clock() + wait_s
        while True:
            if clock() > deadline:
                _set(conn, request_id, "expired", "Hết thời gian chờ mã xác thực. Bấm liên kết lại để nhận mã mới.")
                return "expired"
            code = _take_code(conn, request_id)
            if code is None:
                sleep(poll_s)
                continue
            try:
                client.resume_login(None, code)
                break
            except GarminConnectAuthenticationError:
                _set(conn, request_id, "wrong_code", "Mã chưa đúng. Kiểm tra email rồi nhập lại.")
            except Exception as e:
                log.exception("Xác thực mã Garmin lỗi")
                _set(conn, request_id, "failed", f"Không xác thực được mã ({type(e).__name__}). Thử liên kết lại.")
                return "failed"

    db.save_garmin_tokens(conn, elder_id, crypto.encrypt(encryption_key, client.client.dumps()))
    try:
        name = client.get_full_name()
    except Exception:
        name = None
    _set(conn, request_id, "done", f"Đã liên kết Garmin Connect{f' ({name})' if name else ''}. Dữ liệu sẽ về trong ít phút.")
    return "done"
