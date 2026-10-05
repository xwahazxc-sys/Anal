"""Оценка продукта 0-100. Методика открытая: веса и пороги ниже показываются пользователю.

Итог = 55% нутриенты + 30% добавки + 15% степень переработки (NOVA).
Если есть добавка высокого риска, итог не выше 49 («мы не продаём оценки»: правило жёсткое и прозрачное).
"""
import json
import re
from dataclasses import dataclass, field
from pathlib import Path

from ..models import Product

W_NUTRIENTS, W_ADDITIVES, W_PROCESSING = 0.55, 0.30, 0.15
HIGH_RISK_CAP = 49
ADDITIVE_PENALTY = {0: 0, 1: 5, 2: 20, 3: 50}
NOVA_SCORE = {1: 100, 2: 85, 3: 55, 4: 15}

_ADDITIVES: dict[str, dict] = {
    k: v for k, v in json.loads((Path(__file__).parent.parent / "data" / "additives.json").read_text("utf-8")).items()
    if not k.startswith("_")
}
# E или кириллическая Е, затем 3-4 цифры и необязательная буква (E160a, Е 330, Е-621)
_E_RE = re.compile(r"\b[EЕeе][\s\-]?(\d{3,4}[a-zA-Zа-яА-Я]?)\b")
_LATIN_FIX = str.maketrans("аАсСеЕ", "aAcCeE")


@dataclass
class Factor:
    label: str
    value: str
    impact: int  # -1 минус, 0 нейтрально, +1 плюс


@dataclass
class AdditiveHit:
    code: str
    name: str
    risk: int
    note: str


@dataclass
class ScoreResult:
    score: int
    grade: str  # excellent | good | mediocre | bad
    nutrient_score: int
    additive_score: int
    processing_score: int
    nova: int
    additives: list[AdditiveHit] = field(default_factory=list)
    unknown_additives: list[str] = field(default_factory=list)
    factors: list[Factor] = field(default_factory=list)
    capped: bool = False


def parse_additives(text: str) -> list[str]:
    codes = []
    for m in _E_RE.finditer(text or ""):
        code = "E" + m.group(1).translate(_LATIN_FIX).upper()
        if code not in codes:
            codes.append(code)
    return codes


def count_ingredients(text: str) -> int:
    if not text.strip():
        return 0
    return len([p for p in re.split(r"[,;]", re.sub(r"\([^)]*\)", "", text)) if p.strip()])


def nutrient_score(p: Product) -> tuple[int, list[Factor]]:
    """Упрощённый аналог Nutri-Score: штрафные баллы минус бонусные, шкала 0-100."""
    kcal, sugars = p.kcal or 0, p.sugars or 0
    sat, salt = p.saturated_fat or 0, p.salt or 0
    fiber, protein = p.fiber or 0, p.protein or 0

    drink = p.category == "drink"  # у напитков своя, более строгая шкала (как в Nutri-Score)
    neg = {
        "energy": min(10, int(kcal // (7 if drink else 80))),
        "sugars": min(10, int(sugars / (1.5 if drink else 4.5))),
        "sat": min(10, int(sat / 1.0)),
        "salt": min(10, int(salt / 0.25)),
    }
    pos = {"fiber": min(5, int(fiber / 0.9)), "protein": min(5, int(protein / 1.6))}
    n = sum(neg.values()) - sum(pos.values())  # -10..40
    score = round(100 * (1 - (n + 10) / (40 if drink else 50)))

    factors = [
        Factor("Сахар", f"{sugars:g} г/100 г", -1 if neg["sugars"] >= 4 else (1 if neg["sugars"] == 0 else 0)),
        Factor("Насыщенные жиры", f"{sat:g} г/100 г", -1 if neg["sat"] >= 4 else 0),
        Factor("Соль", f"{salt:g} г/100 г", -1 if neg["salt"] >= 4 else 0),
        Factor("Калорийность", f"{kcal:g} ккал/100 г", -1 if neg["energy"] >= 6 else 0),
        Factor("Клетчатка", f"{fiber:g} г/100 г", 1 if pos["fiber"] >= 3 else 0),
        Factor("Белок", f"{protein:g} г/100 г", 1 if pos["protein"] >= 3 else 0),
    ]
    return max(0, min(100, score)), factors


def estimate_nova(ingredients: int, additives: int) -> int:
    if additives >= 2 or ingredients >= 8:
        return 4
    if additives == 1 or ingredients >= 3:
        return 3
    return 1


def grade_for(score: int) -> str:
    if score >= 75:
        return "excellent"
    if score >= 50:
        return "good"
    if score >= 25:
        return "mediocre"
    return "bad"


def score_product(p: Product) -> ScoreResult:
    n_score, factors = nutrient_score(p)

    hits, unknown = [], []
    for code in parse_additives(p.ingredients_text):
        info = _ADDITIVES.get(code)
        if info:
            hits.append(AdditiveHit(code, info["name"], info["risk"], info["note"]))
        else:
            unknown.append(code)
    a_score = max(0, 100 - sum(ADDITIVE_PENALTY[h.risk] for h in hits))
    factors += [
        Factor(f"{h.code} {h.name}", h.note, {0: 0, 1: 0}.get(h.risk, -1)) for h in hits if h.risk > 0
    ]

    nova = estimate_nova(count_ingredients(p.ingredients_text), len(hits) + len(unknown))
    proc = NOVA_SCORE[nova]
    factors.append(Factor("Степень переработки (NOVA)", str(nova), 1 if nova == 1 else (-1 if nova == 4 else 0)))

    total = round(W_NUTRIENTS * n_score + W_ADDITIVES * a_score + W_PROCESSING * proc)
    capped = any(h.risk == 3 for h in hits) and total > HIGH_RISK_CAP
    if capped:
        total = HIGH_RISK_CAP
    return ScoreResult(total, grade_for(total), n_score, a_score, proc, nova, hits, unknown, factors, capped)
