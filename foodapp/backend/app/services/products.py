from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Product, User
from ..schemas import AlternativeOut, ProductCard, ProductOut, ScoreOut
from .scoring import score_product

# аллерген -> слова, по которым ищем в составе
ALLERGEN_WORDS = {
    "milk": ["молок", "сливк", "лактоз", "сыворотк", "казеин"],
    "gluten": ["пшениц", "рожь", "ячмен", "овсян", "глютен", "мук"],
    "eggs": ["яйц", "яичн"],
    "nuts": ["орех", "арахис", "миндал", "фундук"],
    "soy": ["соев", "соя"],
    "fish": ["рыб"],
}


def to_out(p: Product) -> ProductOut:
    return ProductOut.model_validate(p, from_attributes=True)


def build_card(p: Product, user: User | None = None) -> ProductCard:
    result = score_product(p)
    warnings = []
    if user and user.allergens:
        text = p.ingredients_text.lower()
        for a in filter(None, (x.strip() for x in user.allergens.split(","))):
            if any(w in text for w in ALLERGEN_WORDS.get(a, [a.lower()])):
                warnings.append(a)
    return ProductCard(
        product=to_out(p),
        score=ScoreOut.model_validate(result, from_attributes=True),
        allergen_warnings=warnings,
    )


def find_alternatives(db: Session, p: Product, limit: int = 5) -> list[AlternativeOut]:
    """Продукты той же категории с оценкой выше. Без рекламных мест: сортировка только по оценке."""
    base = score_product(p).score
    q = select(Product).where(Product.barcode != p.barcode, Product.category == p.category) if p.category else None
    if q is None:
        return []
    scored = [(score_product(c).score, c) for c in db.scalars(q.limit(200))]
    better = sorted((x for x in scored if x[0] > base), key=lambda x: -x[0])[:limit]
    return [AlternativeOut(product=to_out(c), score=s) for s, c in better]
