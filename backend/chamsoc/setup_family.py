"""Tạo gia đình, người thân và người chăm sóc từ một file JSON (dùng một lần khi bắt đầu).

    python -m chamsoc.setup_family family.json

Xem mẫu ở backend/family.example.json. Ngưỡng cảnh báo mặc định được tạo theo bệnh nền.
"""

from __future__ import annotations

import json
import os
import sys

from . import db, rules


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    with open(sys.argv[1], encoding="utf-8") as fh:
        cfg = json.load(fh)

    with db.connect(os.environ["DATABASE_URL"]) as conn, conn.transaction():
        fam = conn.execute(
            "insert into families (name, timezone) values (%s, %s) returning id",
            (cfg["name"], cfg.get("timezone", "Asia/Ho_Chi_Minh")),
        ).fetchone()
        family_id = fam["id"]
        if cfg.get("telegram_chat_id"):
            db.link_family_chat(conn, str(family_id), cfg["telegram_chat_id"], None)
        print(f"Gia đình: {family_id}")

        for c in cfg.get("caregivers", []):
            conn.execute(
                """
                insert into caregivers (family_id, display_name, telegram_user_id, phone, role,
                                        escalation_order)
                values (%s, %s, %s, %s, %s, %s)
                """,
                (family_id, c["name"], c.get("telegram_user_id"), c.get("phone"),
                 c.get("role", "alerts"), c.get("escalation_order")),
            )

        for e in cfg.get("elders", []):
            row = conn.execute(
                """
                insert into elders (family_id, display_name, command, birth_year, conditions,
                                    telegram_user_id)
                values (%s, %s, %s, %s, %s, %s) returning id
                """,
                (family_id, e["name"], e.get("command"), e.get("birth_year"),
                 e.get("conditions", []), e.get("telegram_user_id")),
            ).fetchone()
            elder_id = str(row["id"])
            db.insert_rules(conn, rules.default_rules(elder_id, e.get("conditions", [])))
            for m in e.get("medications", []):
                conn.execute(
                    "insert into med_schedules (elder_id, name, note, times) values (%s, %s, %s, %s::time[])",
                    (elder_id, m["name"], m.get("note"), m["times"]),
                )
            print(f"Người thân {e['name']}: {elder_id}")


if __name__ == "__main__":
    main()
