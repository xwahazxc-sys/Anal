from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import current_user
from ..models import User, UserAchievement
from ..schemas import AchievementOut, GamificationOut
from ..services.gamification import ACHIEVEMENTS, level_for, next_level_xp

router = APIRouter(prefix="/api/v1/me", tags=["gamification"])


@router.get("/gamification", response_model=GamificationOut)
def state(db: Session = Depends(get_db), user: User = Depends(current_user)):
    unlocked = set(db.scalars(select(UserAchievement.code).where(UserAchievement.user_id == user.id)))
    return GamificationOut(
        xp=user.xp, level=level_for(user.xp), xp_to_next_level=next_level_xp(user.xp) - user.xp,
        coins=user.coins, streak=user.streak, best_streak=user.best_streak, streak_freezes=user.streak_freezes,
        achievements=[AchievementOut(code=c, title=t, description=d, unlocked=c in unlocked) for c, (t, d, _) in ACHIEVEMENTS.items()],
    )
