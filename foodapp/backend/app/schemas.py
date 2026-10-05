from datetime import date
from typing import Literal

from pydantic import BaseModel, Field


class ProductIn(BaseModel):
    barcode: str = Field(pattern=r"^\d{8,14}$")
    name: str = Field(min_length=1, max_length=255)
    brand: str | None = None
    category: str | None = None
    kcal: float = Field(ge=0, le=900)
    protein: float = Field(ge=0, le=100)
    fat: float = Field(ge=0, le=100)
    saturated_fat: float = Field(0, ge=0, le=100)
    carbs: float = Field(ge=0, le=100)
    sugars: float = Field(0, ge=0, le=100)
    fiber: float = Field(0, ge=0, le=100)
    salt: float = Field(0, ge=0, le=100)
    serving_g: float | None = None
    ingredients_text: str = ""


class FactorOut(BaseModel):
    label: str
    value: str
    impact: int


class AdditiveOut(BaseModel):
    code: str
    name: str
    risk: int
    note: str


class ScoreOut(BaseModel):
    score: int
    grade: Literal["excellent", "good", "mediocre", "bad"]
    nutrient_score: int
    additive_score: int
    processing_score: int
    nova: int
    capped: bool
    additives: list[AdditiveOut]
    unknown_additives: list[str]
    factors: list[FactorOut]


class ProductOut(ProductIn):
    verified: bool
    source: str


class ProductCard(BaseModel):
    product: ProductOut
    score: ScoreOut
    allergen_warnings: list[str] = []


class AlternativeOut(BaseModel):
    product: ProductOut
    score: int


class GameEvents(BaseModel):
    xp_gained: int
    coins_gained: int
    unlocked: list[str]
    level_up: bool


class ScanIn(BaseModel):
    barcode: str = Field(pattern=r"^\d{8,14}$")
    replaced_barcode: str | None = None  # «заменил этот продукт на этот»: для достижения


class ScanOut(BaseModel):
    card: ProductCard
    events: GameEvents


class ProfileIn(BaseModel):
    sex: Literal["m", "f"]
    birth_year: int = Field(ge=1920, le=2020)
    height_cm: float = Field(ge=100, le=250)
    weight_kg: float = Field(ge=30, le=300)
    activity: Literal["sedentary", "light", "moderate", "high"] = "light"
    goal: Literal["lose", "maintain", "gain"] = "maintain"
    allergens: list[str] = []
    consent_health_data: bool  # без согласия профиль не сохраняется (152-ФЗ, особая категория)


class TargetsOut(BaseModel):
    kcal: int | None
    protein: int | None
    fat: int | None
    carbs: int | None


class MeOut(BaseModel):
    targets: TargetsOut
    goal: str
    allergens: list[str]


class DiaryIn(BaseModel):
    barcode: str | None = None
    name: str | None = None  # для ручного ввода
    grams: float = Field(gt=0, le=5000)
    meal: Literal["breakfast", "lunch", "dinner", "snack"]
    day: date | None = None
    # для ручного ввода (на 100 г)
    kcal_100: float | None = Field(None, ge=0, le=900)
    protein_100: float | None = Field(None, ge=0)
    fat_100: float | None = Field(None, ge=0)
    carbs_100: float | None = Field(None, ge=0)


class DiaryEntryOut(BaseModel):
    id: int
    meal: str
    name: str
    grams: float
    kcal: float
    protein: float
    fat: float
    carbs: float


class Totals(BaseModel):
    kcal: float
    protein: float
    fat: float
    carbs: float


class DiaryDay(BaseModel):
    day: date
    entries: list[DiaryEntryOut]
    totals: Totals
    targets: TargetsOut


class DiaryAddOut(BaseModel):
    entry: DiaryEntryOut
    events: GameEvents


class AchievementOut(BaseModel):
    code: str
    title: str
    description: str
    unlocked: bool


class GamificationOut(BaseModel):
    xp: int
    level: int
    xp_to_next_level: int
    coins: int
    streak: int
    best_streak: int
    streak_freezes: int
    achievements: list[AchievementOut]
