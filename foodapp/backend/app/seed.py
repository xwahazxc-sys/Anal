"""python -m app.seed: загрузить демо-продукты."""
import json
from pathlib import Path

from .db import Base, SessionLocal, engine
from .models import Product


def run() -> int:
    Base.metadata.create_all(engine)
    items = json.loads((Path(__file__).parent / "data" / "demo_products.json").read_text("utf-8"))
    with SessionLocal() as db:
        n = 0
        for it in items:
            if not db.get(Product, it["barcode"]):
                db.add(Product(**it))
                n += 1
        db.commit()
    return n


if __name__ == "__main__":
    print(f"added {run()} products")
