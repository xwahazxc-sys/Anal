from fastapi import Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .db import get_db
from .models import User


def current_user(x_device_id: str = Header(min_length=8, max_length=64), db: Session = Depends(get_db)) -> User:
    """MVP-аутентификация по id устройства. Заменить на Яндекс ID / VK ID до публичного релиза."""
    user = db.scalar(select(User).where(User.device_id == x_device_id))
    if not user:
        user = User(device_id=x_device_id)
        db.add(user)
        db.commit()
    return user
