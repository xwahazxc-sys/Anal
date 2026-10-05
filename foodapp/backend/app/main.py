from contextlib import asynccontextmanager

from fastapi import FastAPI

from .db import Base, engine
from .routers import diary, gamification, products, profile


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(engine)  # для MVP; затем перейти на Alembic
    yield


app = FastAPI(title="FoodApp API", version="0.1.0", lifespan=lifespan)
for r in (products.router, profile.router, diary.router, gamification.router):
    app.include_router(r)


@app.get("/health")
def health():
    return {"status": "ok"}
