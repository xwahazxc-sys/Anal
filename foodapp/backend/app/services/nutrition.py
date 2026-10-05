"""Расчёт суточных целей КБЖУ (Миффлин-Сан Жеор)."""
from dataclasses import dataclass
from datetime import date

ACTIVITY = {"sedentary": 1.2, "light": 1.375, "moderate": 1.55, "high": 1.725}
GOAL_ADJUST = {"lose": 0.85, "maintain": 1.0, "gain": 1.10}
PROTEIN_PER_KG = {"lose": 1.8, "maintain": 1.4, "gain": 1.8}
# Защита от РПП: приложение не предлагает цель ниже этого порога и не награждает за недоедание.
MIN_KCAL = {"f": 1200, "m": 1500}


@dataclass
class Targets:
    kcal: int
    protein: int
    fat: int
    carbs: int


def calc_targets(sex: str, birth_year: int, height_cm: float, weight_kg: float, activity: str, goal: str) -> Targets:
    age = max(14, date.today().year - birth_year)
    bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age + (5 if sex == "m" else -161)
    kcal = bmr * ACTIVITY[activity] * GOAL_ADJUST[goal]
    kcal = max(kcal, MIN_KCAL[sex])
    protein = PROTEIN_PER_KG[goal] * weight_kg
    fat = 0.28 * kcal / 9
    carbs = max(0.0, (kcal - protein * 4 - fat * 9) / 4)
    return Targets(round(kcal), round(protein), round(fat), round(carbs))


def min_kcal_for(sex: str | None) -> int:
    return MIN_KCAL.get(sex or "f", 1200)
