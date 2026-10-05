"""Kết nối tài khoản Garmin của một người thân (chạy trên máy tính của bạn).

    python -m chamsoc.link_garmin --elder <elder_id>

Hỏi email, mật khẩu và mã MFA (nếu có), rồi lưu token đã mã hoá vào cơ sở dữ liệu.
Mật khẩu không được lưu ở đâu cả. Chạy ở máy cá nhân vì bước nhập mã MFA cần
giữ phiên đăng nhập, điều mà máy chủ serverless không làm được.
"""

from __future__ import annotations

import argparse
import getpass
import os

from garminconnect import Garmin

from . import crypto, db


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--elder", required=True, help="id (uuid) của người thân trong bảng elders")
    args = p.parse_args()

    database_url = os.environ["DATABASE_URL"]
    key = os.environ["TOKEN_ENCRYPTION_KEY"]

    email = input("Email Garmin: ").strip()
    password = getpass.getpass("Mật khẩu Garmin: ")
    client = Garmin(email, password, prompt_mfa=lambda: input("Mã MFA Garmin gửi về email: ").strip())
    client.login()
    tokens = client.client.dumps()

    with db.connect(database_url) as conn:
        db.save_garmin_tokens(conn, args.elder, crypto.encrypt(key, tokens))
    print(f"Đã kết nối Garmin cho {client.get_full_name() or email}.")


if __name__ == "__main__":
    main()
