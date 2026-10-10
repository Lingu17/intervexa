import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import Base, get_db
from app.main import app
from app.security import attempts


@pytest.fixture
def database():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)

    @event.listens_for(engine, "connect")
    def foreign_keys(connection, _):
        connection.execute("PRAGMA foreign_keys=ON")

    Base.metadata.create_all(engine)
    factory = sessionmaker(engine, expire_on_commit=False)
    with factory() as db:
        yield db, factory
    engine.dispose()


@pytest.fixture
def client(database):
    db, _ = database

    def override():
        yield db

    app.dependency_overrides[get_db] = override
    attempts.clear()
    client = TestClient(app, raise_server_exceptions=False)
    yield client
    client.close()
    app.dependency_overrides.clear()


@pytest.fixture
def authenticated(client):
    result = client.post(
        "/api/auth/register",
        headers={"Origin": "http://localhost:3000"},
        json={"email": "owner@example.com", "password": "secure-test-passphrase", "name": "Owner"},
    )
    assert result.status_code == 200, result.text
    client.headers.update({"Origin": "http://localhost:3000", "X-CSRF-Token": result.json()["csrf"]})
    return client
