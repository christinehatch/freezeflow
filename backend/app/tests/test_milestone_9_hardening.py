import definitely_not_a_real_module  # noqa
from datetime import UTC, datetime
from decimal import Decimal
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.database.session import sqlite_connect_args
from app.main import create_app
from app.schemas.package import PackageCreate


def _data(response) -> dict | list:
    return response.json()["data"]


def _create_freeze_dryer(client: TestClient) -> dict:
    response = client.post(
        "/api/v1/freeze-dryers",
        json={"name": "Freeze Dryer #1", "tray_slot_count": 2},
    )
    assert response.status_code == 201
    return _data(response)


def _create_physical_tray(client: TestClient, label: str) -> dict:
    response = client.post("/api/v1/physical-trays", json={"label": label})
    assert response.status_code == 201
    return _data(response)


def _create_batch_and_tray(client: TestClient) -> tuple[str, dict]:
    freeze_dryer = _create_freeze_dryer(client)
    physical_tray = _create_physical_tray(client, "Tray 1")
    batch_response = client.post(
        "/api/v1/production-batches",
        json={"freeze_dryer_id": freeze_dryer["id"], "batch_number": "Batch 001"},
    )
    assert batch_response.status_code == 201
    batch = _data(batch_response)
    tray_response = client.post(
        f"/api/v1/production-batches/{batch['id']}/trays",
        json={
            "tray_slot_id": freeze_dryer["tray_slots"][0]["id"],
            "physical_tray_id": physical_tray["id"],
            "product_name": "Apples",
            "preparation_methods": ["Sliced"],
        },
    )
    assert tray_response.status_code == 201
    return batch["id"], _data(tray_response)


def test_unhandled_exception_returns_internal_error_shape(
    db_session: Session,
) -> None:
    from app.database.session import get_db

    app = create_app(Settings())

    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    @app.get("/api/v1/_test-explode")
    def explode() -> None:
        raise RuntimeError("boom")

    with TestClient(app, raise_server_exceptions=False) as client:
        response = client.get("/api/v1/_test-explode")

    assert response.status_code == 500
    body = response.json()
    assert body["detail"]["code"] == "internal_error"
    assert body["detail"]["message"] == "An unexpected error occurred."
    assert "boom" not in response.text


def test_cors_allows_configured_origin_and_rejects_others() -> None:
    app = create_app(Settings(cors_allowed_origins="https://example.com"))

    with TestClient(app) as client:
        allowed = client.get(
            "/api/v1/health",
            headers={"Origin": "https://example.com"},
        )
        blocked = client.get(
            "/api/v1/health",
            headers={"Origin": "https://not-allowed.example.com"},
        )

    assert allowed.headers.get("access-control-allow-origin") == "https://example.com"
    assert "access-control-allow-origin" not in blocked.headers


def test_sqlite_connect_args_only_applied_for_sqlite_urls() -> None:
    assert sqlite_connect_args("sqlite:///./freezeflow.db") == {
        "check_same_thread": False
    }
    assert sqlite_connect_args("postgresql://user:pass@host/db") == {}


def test_correct_tray_starting_weight_rejects_non_positive_at_schema_level(
    client: TestClient,
) -> None:
    _batch_id, tray = _create_batch_and_tray(client)

    response = client.post(
        f"/api/v1/trays/{tray['id']}/correct-starting-weight",
        json={"starting_weight_grams": "0", "reason": None},
    )

    assert response.status_code == 422


def test_correct_tray_final_dry_weight_rejects_negative_at_schema_level(
    client: TestClient,
) -> None:
    _batch_id, tray = _create_batch_and_tray(client)

    response = client.post(
        f"/api/v1/trays/{tray['id']}/correct-final-dry-weight",
        json={"final_dry_weight_grams": "-5", "reason": None},
    )

    assert response.status_code == 422


def test_record_starting_weight_rejects_non_positive(client: TestClient) -> None:
    _batch_id, tray = _create_batch_and_tray(client)

    response = client.post(
        f"/api/v1/trays/{tray['id']}/starting-weight",
        json={"starting_weight_grams": "0"},
    )

    assert response.status_code == 422


def test_batch_number_rejects_blank_and_whitespace_only(client: TestClient) -> None:
    freeze_dryer = _create_freeze_dryer(client)

    blank_response = client.post(
        "/api/v1/production-batches",
        json={"freeze_dryer_id": freeze_dryer["id"], "batch_number": ""},
    )
    whitespace_response = client.post(
        "/api/v1/production-batches",
        json={"freeze_dryer_id": freeze_dryer["id"], "batch_number": "   "},
    )

    assert blank_response.status_code == 422
    assert whitespace_response.status_code == 422


def test_batch_number_is_stored_trimmed(client: TestClient) -> None:
    freeze_dryer = _create_freeze_dryer(client)

    response = client.post(
        "/api/v1/production-batches",
        json={"freeze_dryer_id": freeze_dryer["id"], "batch_number": "  Batch 001  "},
    )

    assert response.status_code == 201
    assert _data(response)["batch_number"] == "Batch 001"


@pytest.mark.parametrize("package_identifier", ["", "   "])
def test_package_identifier_rejects_blank_and_whitespace_only(
    package_identifier: str,
) -> None:
    with pytest.raises(ValidationError):
        PackageCreate(
            packaging_allocation_id=uuid4(),
            package_type_id=uuid4(),
            package_identifier=package_identifier,
            packaged_at=datetime.now(UTC),
            package_weight_grams=Decimal("100"),
        )


def test_package_identifier_is_stored_trimmed() -> None:
    package = PackageCreate(
        packaging_allocation_id=uuid4(),
        package_type_id=uuid4(),
        package_identifier="  PKG-2026-000001  ",
        packaged_at=datetime.now(UTC),
        package_weight_grams=Decimal("100"),
    )

    assert package.package_identifier == "PKG-2026-000001"
