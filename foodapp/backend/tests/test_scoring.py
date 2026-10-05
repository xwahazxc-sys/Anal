from app.models import Product
from app.services.scoring import parse_additives, score_product


def P(**kw):
    base = dict(barcode="1", name="x", kcal=0, protein=0, fat=0, saturated_fat=0, carbs=0, sugars=0, fiber=0, salt=0, ingredients_text="")
    base.update(kw)
    return Product(**base)


def test_parse_additives_handles_cyrillic_and_formats():
    assert parse_additives("краситель (Е102), E-211, е 330, E160a") == ["E102", "E211", "E330", "E160A"]


def test_clean_product_scores_high():
    r = score_product(P(kcal=313, protein=12.6, fat=3.3, saturated_fat=0.7, carbs=62, sugars=1, fiber=11, salt=0.01, ingredients_text="Крупа гречневая"))
    assert r.grade == "excellent" and r.score >= 75


def test_soda_with_dyes_is_bad_or_mediocre():
    r = score_product(P(category="drink", kcal=42, carbs=10.5, sugars=10.5, ingredients_text="Вода, сахар, E330, E211, E102"))
    assert r.score < 50
    assert {h.code for h in r.additives} == {"E330", "E211", "E102"}


def test_high_risk_additive_caps_score():
    r = score_product(P(kcal=40, protein=10, fiber=5, ingredients_text="Мясо, нитрит натрия (E250)"))
    assert r.capped and r.score <= 49


def test_unknown_additive_reported():
    r = score_product(P(ingredients_text="Вода, E999"))
    assert r.unknown_additives == ["E999"]
