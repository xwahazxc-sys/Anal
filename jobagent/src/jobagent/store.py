"""SQLite-журнал: что уже оценено/отправлено (защита от дублей и дневной лимит)."""
from __future__ import annotations

import sqlite3
from datetime import date

from .config import DATA


class Store:
    def __init__(self, path=DATA / "jobagent.sqlite"):
        DATA.mkdir(exist_ok=True)
        self.db = sqlite3.connect(path)
        self.db.execute(
            "CREATE TABLE IF NOT EXISTS applications("
            "source TEXT, vid TEXT, title TEXT, company TEXT, score INT, status TEXT, day TEXT, "
            "PRIMARY KEY(source, vid))"
        )

    def seen(self, source: str, vid: str) -> bool:
        return self.db.execute("SELECT 1 FROM applications WHERE source=? AND vid=?", (source, vid)).fetchone() is not None

    def record(self, source, vid, title, company, score, status) -> None:
        self.db.execute(
            "INSERT OR REPLACE INTO applications VALUES(?,?,?,?,?,?,?)",
            (source, vid, title, company, score, status, date.today().isoformat()),
        )
        self.db.commit()

    def sent_today(self) -> int:
        return self.db.execute(
            "SELECT COUNT(*) FROM applications WHERE status='sent' AND day=?", (date.today().isoformat(),)
        ).fetchone()[0]
