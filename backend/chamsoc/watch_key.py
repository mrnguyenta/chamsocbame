"""Tạo mã thiết bị cho ứng dụng Connect IQ trên đồng hồ của một người thân.

    python -m chamsoc.watch_key --elder <elder_id> [--label "Venu 4 của Ba"]

Mã chỉ hiện một lần; cơ sở dữ liệu chỉ lưu bản băm. Dán mã vào phần cài đặt của
ứng dụng "Chăm Sóc Người Thân" trong app Garmin Connect trên điện thoại của ba mẹ.
"""

from __future__ import annotations

import argparse
import hashlib
import os
import secrets

from . import db


def new_key() -> tuple[str, str]:
    key = secrets.token_urlsafe(24)
    return key, hashlib.sha256(key.encode()).hexdigest()


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--elder", required=True)
    p.add_argument("--label")
    args = p.parse_args()
    key, key_hash = new_key()
    with db.connect(os.environ["DATABASE_URL"]) as conn:
        db.create_watch_device(conn, args.elder, key_hash, args.label)
    print(f"Mã thiết bị (chỉ hiện một lần): {key}")


if __name__ == "__main__":
    main()
