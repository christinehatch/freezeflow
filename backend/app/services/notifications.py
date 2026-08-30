from __future__ import annotations

import base64
import logging
from pathlib import Path

import httpx

from app.core.config import Settings
from app.models import Feedback

logger = logging.getLogger(__name__)

RESEND_API_URL = "https://api.resend.com/emails"


def send_feedback_notification(feedback: Feedback, settings: Settings) -> None:
    """Best-effort, non-blocking notification (ADR-0020, FB-001). The
    Feedback row is always committed before this runs; failure here is
    always caught and logged, never raised, so it can never fail or lose a
    submission that was already saved.

    Sent via Resend's HTTP API rather than raw SMTP - many cloud/VPS
    providers block outbound SMTP ports by default for new accounts, which
    an HTTPS-based API sidesteps entirely (see ADR-0020 amendment).
    """
    if not settings.resend_api_key or not settings.feedback_notify_email:
        logger.info("Feedback notification skipped: Resend is not configured.")
        return

    body_lines = [
        f"Category: {feedback.category}",
        f"Submitted: {feedback.submitted_at.isoformat()}",
        f"Page: {feedback.page or '(unknown)'}",
        "",
        feedback.description,
    ]
    if feedback.context_json:
        body_lines += ["", "Context:", str(feedback.context_json)]

    attachments = []
    for filename in feedback.attachments:
        file_path = Path(settings.feedback_upload_dir) / filename
        try:
            data = file_path.read_bytes()
        except OSError:
            continue
        attachments.append(
            {"filename": filename, "content": base64.b64encode(data).decode("ascii")}
        )

    payload = {
        "from": settings.feedback_from_address,
        "to": [settings.feedback_notify_email],
        "subject": f"[Freezeflow] {feedback.category} feedback",
        "text": "\n".join(body_lines),
        "attachments": attachments,
    }

    try:
        response = httpx.post(
            RESEND_API_URL,
            headers={"Authorization": f"Bearer {settings.resend_api_key}"},
            json=payload,
            timeout=10,
        )
        response.raise_for_status()
    except Exception:
        # Never let a notification failure surface past this point - the
        # Feedback row is already saved regardless (FB-001).
        logger.exception("Failed to send Feedback notification email.")
