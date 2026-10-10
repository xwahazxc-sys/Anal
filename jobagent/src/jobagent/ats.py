"""Детерминированная ATS-проверка резюме (без LLM): структура, формат, ключевые слова."""
from __future__ import annotations

import re
from dataclasses import dataclass, field

from .models import Profile, TailoredResume

_TOKEN = re.compile(r"[A-Za-zА-Яа-я0-9+#.\-]{2,}")
_STOP = {
    "and", "the", "for", "with", "you", "our", "will", "are", "have", "что", "для",
    "или", "это", "как", "при", "над", "опыт", "работы", "работа", "знание", "от",
    "на", "по", "из", "мы", "вы", "ваш", "наш",
}
_DATE = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")


@dataclass
class AtsReport:
    score: int = 100
    issues: list[str] = field(default_factory=list)
    keyword_coverage: float | None = None
    missing_keywords: list[str] = field(default_factory=list)

    def penalize(self, pts: int, msg: str) -> None:
        self.score = max(0, self.score - pts)
        self.issues.append(msg)


def keywords(text: str, top: int = 40) -> list[str]:
    freq: dict[str, int] = {}
    for t in _TOKEN.findall(text):
        k = t.lower().strip(".-")
        if len(k) < 2 or k in _STOP or k.isdigit():
            continue
        freq[k] = freq.get(k, 0) + 1
    return [k for k, _ in sorted(freq.items(), key=lambda kv: -kv[1])[:top]]


def check(resume: Profile | TailoredResume, profile: Profile, vacancy_text: str = "") -> AtsReport:
    r = AtsReport()
    skills = resume.skills
    exp = resume.experience

    if not profile.contacts.get("email"):
        r.penalize(15, "Нет email в контактах")
    if not profile.contacts.get("phone"):
        r.penalize(5, "Нет телефона")
    if not exp:
        r.penalize(30, "Нет раздела опыта")
    if len(skills) < 5:
        r.penalize(10, "Меньше 5 навыков в разделе Skills")
    if not getattr(resume, "summary", ""):
        r.penalize(5, "Нет краткого summary")
    for e in exp:
        if not _DATE.match(e.start):
            r.penalize(5, f"{e.company}: дата начала должна быть YYYY-MM")
        if not e.bullets:
            r.penalize(5, f"{e.company}: нет буллетов с достижениями")
        for b in e.bullets:
            if len(b) > 220:
                r.penalize(2, f"{e.company}: слишком длинный буллет (>220 симв.)")
            if not re.search(r"\d", b):
                r.penalize(1, f"{e.company}: буллет без цифр/метрик: «{b[:50]}…»")

    if vacancy_text:
        kws = keywords(vacancy_text)
        blob = " ".join(
            [resume.headline, getattr(resume, "summary", ""), *skills,
             *(b for e in exp for b in e.bullets)]
        ).lower()
        hit = [k for k in kws if k in blob]
        r.keyword_coverage = len(hit) / len(kws) if kws else None
        r.missing_keywords = [k for k in kws if k not in blob][:15]
        if r.keyword_coverage is not None and r.keyword_coverage < 0.4:
            r.penalize(15, f"Низкое покрытие ключевых слов вакансии ({r.keyword_coverage:.0%})")
    return r
