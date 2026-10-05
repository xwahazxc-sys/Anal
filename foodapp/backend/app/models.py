from datetime import date, datetime, timezone

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    # MVP: анонимный пользователь по id устройства. Позже: Яндекс ID / VK ID / телефон.
    device_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    # Профиль (данные о здоровье: нужно отдельное согласие по 152-ФЗ)
    sex: Mapped[str | None] = mapped_column(String(1))  # "m" | "f"
    birth_year: Mapped[int | None]
    height_cm: Mapped[float | None]
    weight_kg: Mapped[float | None]
    activity: Mapped[str] = mapped_column(String(16), default="light")
    goal: Mapped[str] = mapped_column(String(16), default="maintain")
    allergens: Mapped[str] = mapped_column(Text, default="")  # через запятую

    # Рассчитанные цели
    target_kcal: Mapped[int | None]
    target_protein: Mapped[int | None]
    target_fat: Mapped[int | None]
    target_carbs: Mapped[int | None]

    # Геймификация
    xp: Mapped[int] = mapped_column(Integer, default=0)
    coins: Mapped[int] = mapped_column(Integer, default=0)
    streak: Mapped[int] = mapped_column(Integer, default=0)
    best_streak: Mapped[int] = mapped_column(Integer, default=0)
    last_active: Mapped[date | None] = mapped_column(Date)
    streak_freezes: Mapped[int] = mapped_column(Integer, default=0)
    last_goal_day: Mapped[date | None] = mapped_column(Date)  # чтобы награда за норму шла 1 раз в день
    consent_health_data: Mapped[bool] = mapped_column(Boolean, default=False)


class Product(Base):
    __tablename__ = "products"

    barcode: Mapped[str] = mapped_column(String(14), primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    brand: Mapped[str | None] = mapped_column(String(255))
    category: Mapped[str | None] = mapped_column(String(64), index=True)
    # На 100 г / 100 мл
    kcal: Mapped[float | None]
    protein: Mapped[float | None]
    fat: Mapped[float | None]
    saturated_fat: Mapped[float | None]
    carbs: Mapped[float | None]
    sugars: Mapped[float | None]
    fiber: Mapped[float | None]
    salt: Mapped[float | None]
    serving_g: Mapped[float | None]
    ingredients_text: Mapped[str] = mapped_column(Text, default="")
    image_url: Mapped[str | None] = mapped_column(String(512))
    source: Mapped[str] = mapped_column(String(32), default="manual")  # off | manual | crowd | chestny_znak
    verified: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class DiaryEntry(Base):
    __tablename__ = "diary_entries"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    day: Mapped[date] = mapped_column(Date, index=True)
    meal: Mapped[str] = mapped_column(String(16))  # breakfast | lunch | dinner | snack
    barcode: Mapped[str | None] = mapped_column(ForeignKey("products.barcode"))
    name: Mapped[str] = mapped_column(String(255))
    grams: Mapped[float]
    kcal: Mapped[float]
    protein: Mapped[float]
    fat: Mapped[float]
    carbs: Mapped[float]


class Scan(Base):
    __tablename__ = "scans"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    barcode: Mapped[str] = mapped_column(String(14))
    score: Mapped[int | None]
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class UserAchievement(Base):
    __tablename__ = "user_achievements"
    __table_args__ = (UniqueConstraint("user_id", "code"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    code: Mapped[str] = mapped_column(String(32))
    unlocked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    user: Mapped[User] = relationship()
