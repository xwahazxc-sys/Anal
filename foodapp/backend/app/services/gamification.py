"""XP, уровни, серии, достижения. Вся логика в одном месте, чтобы легко крутить баланс."""
from dataclasses import dataclass, field
from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..models import DiaryEntry, Scan, User, UserAchievement
from .nutrition import min_kcal_for

XP = {"scan": 5, "diary_entry": 10, "daily_goal": 30, "better_choice": 20, "new_product": 25}
DAILY_XP_CAP_FOR_SCANS = 50  # не фармится бесконечным сканированием одного и того же

ACHIEVEMENTS = {
    "first_scan": ("Первый скан", "Отсканируйте первый продукт", 10),
    "detective_50": ("Детектив состава", "50 сканов", 50),
    "red_flag": ("Красный флаг", "Найдите продукт с оценкой ниже 25", 15),
    "better_choice": ("Лучший выбор", "Замените плохой продукт хорошим", 25),
    "streak_7": ("Неделя в ритме", "Серия 7 дней", 40),
    "streak_30": ("Месяц в ритме", "Серия 30 дней", 150),
    "first_goal": ("В норме", "Выполните дневную норму калорий", 20),
}


def level_for(xp: int) -> int:
    """Уровень n начинается с 50*(n-1)^2 XP: 0, 50, 200, 450, 800..."""
    n = 1
    while xp >= 50 * n * n:
        n += 1
    return n


@dataclass
class Events:
    xp_gained: int = 0
    coins_gained: int = 0
    unlocked: list[str] = field(default_factory=list)
    level_up: bool = False


def _touch_streak(user: User, today: date) -> None:
    if user.last_active == today:
        return
    gap = (today - user.last_active).days if user.last_active else None
    if gap == 1 or gap is None:
        user.streak += 1
    elif gap == 2 and user.streak_freezes > 0:  # пропущен один день: тратим заморозку
        user.streak_freezes -= 1
        user.streak += 1
    else:
        user.streak = 1
    user.best_streak = max(user.best_streak, user.streak)
    user.last_active = today


def award(db: Session, user: User, kind: str, ev: Events, *, today: date | None = None) -> None:
    today = today or date.today()
    before = level_for(user.xp)
    _touch_streak(user, today)
    amount = XP[kind]
    if kind == "scan":
        scans_today = db.scalar(
            select(func.count()).select_from(Scan).where(Scan.user_id == user.id, func.date(Scan.created_at) == today.isoformat())
        ) or 0
        if scans_today * XP["scan"] >= DAILY_XP_CAP_FOR_SCANS:
            amount = 0
    user.xp += amount
    ev.xp_gained += amount
    ev.level_up = ev.level_up or level_for(user.xp) > before


def _unlock(db: Session, user: User, code: str, ev: Events) -> None:
    exists = db.scalar(select(UserAchievement.id).where(UserAchievement.user_id == user.id, UserAchievement.code == code))
    if exists:
        return
    db.add(UserAchievement(user_id=user.id, code=code))
    coins = ACHIEVEMENTS[code][2]
    user.coins += coins
    ev.coins_gained += coins
    ev.unlocked.append(code)


def check_achievements(db: Session, user: User, ev: Events, *, last_score: int | None = None, better: bool = False) -> None:
    total_scans = db.scalar(select(func.count()).select_from(Scan).where(Scan.user_id == user.id)) or 0
    if total_scans >= 1:
        _unlock(db, user, "first_scan", ev)
    if total_scans >= 50:
        _unlock(db, user, "detective_50", ev)
    if last_score is not None and last_score < 25:
        _unlock(db, user, "red_flag", ev)
    if better:
        _unlock(db, user, "better_choice", ev)
    if user.streak >= 7:
        _unlock(db, user, "streak_7", ev)
    if user.streak >= 30:
        _unlock(db, user, "streak_30", ev)


def check_daily_goal(db: Session, user: User, day: date, ev: Events) -> bool:
    """Норма выполнена, если калории в диапазоне 85-110% цели и не ниже безопасного минимума.
    За недоедание награды нет."""
    if not user.target_kcal or user.last_goal_day == day:
        return False
    total = db.scalar(select(func.coalesce(func.sum(DiaryEntry.kcal), 0)).where(DiaryEntry.user_id == user.id, DiaryEntry.day == day)) or 0
    ok = max(0.85 * user.target_kcal, min_kcal_for(user.sex)) <= total <= 1.10 * user.target_kcal
    if ok:
        user.last_goal_day = day
        award(db, user, "daily_goal", ev, today=day)
        _unlock(db, user, "first_goal", ev)
    return ok


def next_level_xp(xp: int) -> int:
    n = level_for(xp)
    return 50 * n * n
