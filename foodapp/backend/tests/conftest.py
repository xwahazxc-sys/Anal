import os

os.environ["FOODAPP_DATABASE_URL"] = "sqlite:///:memory:"

import pytest
from fastapi.testclient import TestClient

from app import seed
from app.db import Base, engine
from app.main import app


@pytest.fixture()
def client():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    seed.run()
    with TestClient(app) as c:
        c.headers["X-Device-Id"] = "test-device-0001"
        yield c
