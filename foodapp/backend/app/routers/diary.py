from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import current_user
from ..models import DiaryEntry, Product, User
from ..schemas import DiaryAddOut, DiaryDay, DiaryEntryOut, DiaryIn, GameEvents, TargetsOut, Totals
from ..services import gamification as g

router = APIRouter(prefix="/api/v1/diary", tags=["diary"])


def _out(e: DiaryEntry) -> DiaryEntryOut:
    return DiaryEntryOut.model_validate(e, from_attributes=True)


@router.get("", response_model=DiaryDay)
def get_day(day: date | None = None, db: Session = Depends(get_db), user: User = Depends(current_user)):
    day = day or date.today()
    rows = db.scalars(select(DiaryEntry).where(DiaryEntry.user_id == user.id, DiaryEntry.day == day).order_by(DiaryEntry.id)).all()
    totals = Totals(
        kcal=round(sum(r.kcal for r in rows), 1), protein=round(sum(r.protein for r in rows), 1),
        fat=round(sum(r.fat for r in rows), 1), carbs=round(sum(r.carbs for r in rows), 1),
    )
    targets = TargetsOut(kcal=user.target_kcal, protein=user.target_protein, fat=user.target_fat, carbs=user.target_carbs)
    return DiaryDay(day=day, entries=[_out(r) for r in rows], totals=totals, targets=targets)


@router.post("", response_model=DiaryAddOut, status_code=201)
def add_entry(body: DiaryIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    k = body.grams / 100
    if body.barcode:
        p = db.get(Product, body.barcode)
        if not p:
            raise HTTPException(404, "Продукт не найден")
        name, kcal, prot, fat, carbs = p.name, p.kcal or 0, p.protein or 0, p.fat or 0, p.carbs or 0
    elif body.name and body.kcal_100 is not None:
        name, kcal, prot, fat, carbs = body.name, body.kcal_100, body.protein_100 or 0, body.fat_100 or 0, body.carbs_100 or 0
    else:
        raise HTTPException(422, "Укажите barcode или name + kcal_100")

    day = body.day or date.today()
    entry = DiaryEntry(
        user_id=user.id, day=day, meal=body.meal, barcode=body.barcode, name=name, grams=body.grams,
        kcal=round(kcal * k, 1), protein=round(prot * k, 1), fat=round(fat * k, 1), carbs=round(carbs * k, 1),
    )
    db.add(entry)
    db.flush()
    ev = g.Events()
    g.award(db, user, "diary_entry", ev, today=day)
    g.check_daily_goal(db, user, day, ev)
    g.check_achievements(db, user, ev)
    db.commit()
    return DiaryAddOut(entry=_out(entry), events=GameEvents(**vars(ev)))


@router.delete("/{entry_id}", status_code=204)
def delete_entry(entry_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    e = db.get(DiaryEntry, entry_id)
    if not e or e.user_id != user.id:
        raise HTTPException(404)
    db.delete(e)
    db.commit()
