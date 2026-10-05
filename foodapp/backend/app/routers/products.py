from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import current_user
from ..models import Product, Scan, User
from ..schemas import AlternativeOut, GameEvents, ProductCard, ProductIn, ProductOut, ScanIn, ScanOut
from ..services import gamification as g
from ..services.products import build_card, find_alternatives, to_out
from ..services.scoring import score_product

router = APIRouter(prefix="/api/v1", tags=["products"])


def _get(db: Session, barcode: str) -> Product:
    p = db.get(Product, barcode)
    if not p:
        raise HTTPException(404, "Продукта нет в базе: добавьте его фото состава")
    return p


@router.get("/products/{barcode}", response_model=ProductCard)
def get_product(barcode: str, db: Session = Depends(get_db), user: User = Depends(current_user)):
    return build_card(_get(db, barcode), user)


@router.get("/products/{barcode}/alternatives", response_model=list[AlternativeOut])
def alternatives(barcode: str, db: Session = Depends(get_db)):
    return find_alternatives(db, _get(db, barcode))


@router.post("/products", response_model=ProductOut, status_code=201)
def add_product(body: ProductIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    """Краудсорсинг. Запись непроверенная, пока не прошла модерацию."""
    if db.get(Product, body.barcode):
        raise HTTPException(409, "Продукт уже есть в базе")
    p = Product(**body.model_dump(), source="crowd", verified=False)
    db.add(p)
    db.commit()
    return to_out(p)


@router.post("/scans", response_model=ScanOut)
def scan(body: ScanIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    """Скан штрихкода: карточка + начисление XP/достижений."""
    p = _get(db, body.barcode)
    card = build_card(p, user)
    ev = g.Events()
    # сначала считаем сканы за сегодня внутри award, потом пишем новый скан
    g.award(db, user, "scan", ev)
    db.add(Scan(user_id=user.id, barcode=p.barcode, score=card.score.score))
    db.flush()

    better = False
    if body.replaced_barcode and (old := db.get(Product, body.replaced_barcode)):
        old_score = score_product(old).score
        if old_score < 50 <= card.score.score and card.score.score > old_score:
            better = True
            g.award(db, user, "better_choice", ev)
    g.check_achievements(db, user, ev, last_score=card.score.score, better=better)
    db.commit()
    return ScanOut(card=card, events=GameEvents(**vars(ev)))
