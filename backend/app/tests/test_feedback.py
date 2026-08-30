from __future__ import annotations

import io
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.core.config import Settings, get_settings


def _data(response):
    return response.json()["data"]


def _override_settings(client: TestClient, **overrides) -> None:
    settings = Settings(**overrides)
    client.app.dependency_overrides[get_settings] = lambda: settings


def test_submits_text_only_feedback(client: TestClient, tmp_path: Path) -> None:
    _override_settings(client, feedback_upload_dir=str(tmp_path))

    response = client.post(
        "/api/v1/feedback",
        data={"category": "Bug", "description": "The Save button did nothing."},
    )

    assert response.status_code == 201
    body = _data(response)
    assert body["category"] == "Bug"
    assert body["status"] == "New"
    assert list(tmp_path.iterdir()) == []


def test_submits_feedback_with_an_attachment_and_writes_it_to_disk(
    client: TestClient, tmp_path: Path
) -> None:
    _override_settings(client, feedback_upload_dir=str(tmp_path))
    image_bytes = b"\x89PNG\r\n\x1a\n" + b"0" * 20

    response = client.post(
        "/api/v1/feedback",
        data={"category": "Bug", "description": "See attached."},
        files={"attachments": ("screenshot.png", io.BytesIO(image_bytes), "image/png")},
    )

    assert response.status_code == 201
    saved_files = list(tmp_path.iterdir())
    assert len(saved_files) == 1
    assert saved_files[0].name.endswith("screenshot.png")
    assert saved_files[0].read_bytes() == image_bytes


def test_rejects_a_non_image_attachment(client: TestClient, tmp_path: Path) -> None:
    _override_settings(client, feedback_upload_dir=str(tmp_path))

    response = client.post(
        "/api/v1/feedback",
        data={"category": "Bug", "description": "See attached."},
        files={"attachments": ("notes.txt", io.BytesIO(b"hello"), "text/plain")},
    )

    assert response.status_code == 400
    assert list(tmp_path.iterdir()) == []


def test_rejects_an_oversized_attachment(client: TestClient, tmp_path: Path) -> None:
    _override_settings(client, feedback_upload_dir=str(tmp_path))
    oversized = b"0" * (10 * 1024 * 1024 + 1)

    response = client.post(
        "/api/v1/feedback",
        data={"category": "Bug", "description": "See attached."},
        files={"attachments": ("big.png", io.BytesIO(oversized), "image/png")},
    )

    assert response.status_code == 400
    assert list(tmp_path.iterdir()) == []


def test_missing_description_is_a_validation_error(client: TestClient) -> None:
    response = client.post("/api/v1/feedback", data={"category": "Bug"})
    assert response.status_code == 422


def test_blank_description_is_rejected(client: TestClient, tmp_path: Path) -> None:
    _override_settings(client, feedback_upload_dir=str(tmp_path))

    response = client.post(
        "/api/v1/feedback", data={"category": "Bug", "description": "   "}
    )

    assert response.status_code == 400


def test_feedback_is_saved_even_when_the_notification_email_fails_to_send(
    client: TestClient, tmp_path: Path
) -> None:
    _override_settings(
        client,
        feedback_upload_dir=str(tmp_path),
        resend_api_key="re_test_key",
        feedback_notify_email="me@example.com",
    )

    with patch("app.services.notifications.httpx.post") as mock_post:
        mock_post.side_effect = OSError("connection refused")
        response = client.post(
            "/api/v1/feedback",
            data={"category": "Bug", "description": "Still saved, right?"},
        )

    assert response.status_code == 201
    assert _data(response)["status"] == "New"
    mock_post.assert_called_once()


def test_feedback_succeeds_with_no_resend_configured(
    client: TestClient, tmp_path: Path
) -> None:
    _override_settings(client, feedback_upload_dir=str(tmp_path))

    response = client.post(
        "/api/v1/feedback",
        data={
            "category": "Question",
            "description": "Just curious about something.",
        },
    )

    assert response.status_code == 201
