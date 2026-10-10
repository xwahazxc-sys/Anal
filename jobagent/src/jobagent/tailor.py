from __future__ import annotations

from .llm import ask
from .models import Match, Profile, TailoredResume, Vacancy

SCORE_SYS = (
    "Ты строгий технический рекрутер. Оцени соответствие кандидата вакансии "
    "от 0 до 100. Учитывай обязательные требования, стек, уровень, зарплатные "
    "ожидания и локацию. В keywords верни только те ключевые слова вакансии, "
    "которые подтверждены профилем."
)

TAILOR_SYS = (
    "Ты эксперт по ATS-резюме. Перепиши резюме под вакансию: один столбец, "
    "стандартные заголовки, без таблиц и графики, ключевые слова вакансии "
    "естественно вплетены в факты профиля, достижения с метриками, буллеты "
    "в формате «глагол + результат + цифра». Язык резюме = язык вакансии. "
    "Также напиши сопроводительное письмо до 120 слов без шаблонных фраз."
)


def _vac(v: Vacancy) -> str:
    return f"Вакансия: {v.title} @ {v.company}\nЗарплата: {v.salary}\nЛокация: {v.area}\n\n{v.description}"


def score(profile: Profile, vacancy: Vacancy) -> Match:
    return ask(SCORE_SYS, f"ПРОФИЛЬ:\n{profile.model_dump_json(indent=1)}\n\n{_vac(vacancy)}", Match)


def tailor(profile: Profile, vacancy: Vacancy) -> TailoredResume:
    return ask(TAILOR_SYS, f"ПРОФИЛЬ:\n{profile.model_dump_json(indent=1)}\n\n{_vac(vacancy)}", TailoredResume, 6000)
