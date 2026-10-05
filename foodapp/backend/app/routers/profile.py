from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import current_user
from ..models import User
from ..schemas import MeOut, ProfileIn, TargetsOut
from ..services.nutrition import calc_targets

router = APIRouter(prefix="/api/v1/me", tags=["profile"])


def _me(u: User) -> MeOut:
    return MeOut(
        targets=TargetsOut(kcal=u.target_kcal, protein=u.target_protein, fat=u.target_fat, carbs=u.target_carbs),
        goal=u.goal,
        allergens=[a for a in u.allergens.split(",") if a],
    )


@router.get("", response_model=MeOut)
def me(user: User = Depends(current_user)):
    return _me(user)


@router.put("/profile", response_model=MeOut)
def update_profile(body: ProfileIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    if not body.consent_health_data:
        raise HTTPException(422, "Нужно согласие на обработку данных о здоровье")
    t = calc_targets(body.sex, body.birth_year, body.height_cm, body.weight_kg, body.activity, body.goal)
    user.sex, user.birth_year = body.sex, body.birth_year
    user.height_cm, user.weight_kg = body.height_cm, body.weight_kg
    user.activity, user.goal = body.activity, body.goal
    user.allergens = ",".join(body.allergens)
    user.consent_health_data = True
    user.target_kcal, user.target_protein, user.target_fat, user.target_carbs = t.kcal, t.protein, t.fat, t.carbs
    db.commit()
    return _me(user)
