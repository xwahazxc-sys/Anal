"""hh.ru через официальный API (https://api.hh.ru). Поиск публичный, отклик требует OAuth-токен."""
from __future__ import annotations

import re
import time

import httpx

from ..config import env
from ..models import Preferences, Vacancy

API = "https://api.hh.ru"


def _client() -> httpx.Client:
    headers = {"User-Agent": env("HH_USER_AGENT", "jobagent/0.1")}
    if tok := env("HH_ACCESS_TOKEN"):
        headers["Authorization"] = f"Bearer {tok}"
    return httpx.Client(base_url=API, headers=headers, timeout=20)


def _strip(html: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", html or "")).strip()


def _salary(s: dict | None) -> str:
    if not s:
        return ""
    return f"{s.get('from') or ''}–{s.get('to') or ''} {s.get('currency') or ''}".strip()


def search(prefs: Preferences, pages: int = 2, per_page: int = 20) -> list[Vacancy]:
    out: list[Vacancy] = []
    with _client() as c:
        for role in prefs.roles or [""]:
            for page in range(pages):
                params = {"text": role, "per_page": per_page, "page": page, "order_by": "publication_time"}
                if prefs.areas:
                    params["area"] = prefs.areas
                if prefs.remote_only:
                    params["schedule"] = "remote"
                if prefs.min_salary_rub:
                    params.update(salary=prefs.min_salary_rub, only_with_salary="true")
                r = c.get("/vacancies", params=params)
                r.raise_for_status()
                for it in r.json()["items"]:
                    out.append(Vacancy(
                        source="hh", id=it["id"], title=it["name"],
                        company=(it.get("employer") or {}).get("name", ""),
                        url=it["alternate_url"], salary=_salary(it.get("salary")),
                        area=(it.get("area") or {}).get("name", ""),
                        description=_strip((it.get("snippet") or {}).get("requirement", "")),
                    ))
                time.sleep(0.5)  # вежливый rate limit
    return list({v.id: v for v in out}.values())


def details(v: Vacancy) -> Vacancy:
    with _client() as c:
        r = c.get(f"/vacancies/{v.id}")
        r.raise_for_status()
        j = r.json()
    skills = ", ".join(s["name"] for s in j.get("key_skills", []))
    return v.model_copy(update={"description": f"{_strip(j.get('description', ''))}\nКлючевые навыки: {skills}"})


def apply(v: Vacancy, resume_id: str, message: str) -> None:
    """Официальный отклик: POST /negotiations."""
    with _client() as c:
        r = c.post("/negotiations", data={"vacancy_id": v.id, "resume_id": resume_id, "message": message})
        r.raise_for_status()
