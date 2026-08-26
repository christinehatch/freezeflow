from __future__ import annotations

import logging
import mimetypes
import smtplib
from email.message import EmailMessage
from pathlib import Path

from app.core.config import Settings
from app.models import Feedback

logger = logging.getLogger(__name__)


def send_feedback_notification(feedback: Feedback, settings: Settings) -> None:
    """Best-effort, non-blocking notification (ADR-0020, FB-001). The
    Feedback row is always committed before this runs; failure here is
    always caught and logged, never raised, so it can never fail or lose a
    submission that was already saved.
    """
    if not settings.smtp_host or not settings.feedback_notify_email:
        logger.info("Feedback notification skipped: SMTP is not configured.")
        return

    message = EmailMessage()
    message["Subject"] = f"[Freezeflow] {feedback.category} feedback"
    message["From"] = (
        settings.smtp_from_address or settings.smtp_username or "freezeflow@localhost"
    )
    message["To"] = settings.feedback_notify_email
    body_lines = [
        f"Category: {feedback.category}",
        f"Submitted: {feedback.submitted_at.isoformat()}",
        f"Page: {feedback.page or '(unknown)'}",
        "",
        feedback.description,
    ]
    if feedback.context_json:
        body_lines += ["", "Context:", str(feedback.context_json)]
    message.set_content("\n".join(body_lines))

    for filename in feedback.attachments:
        file_path = Path(settings.feedback_upload_dir) / filename
        try:
            data = file_path.read_bytes()
        except OSError:
            continue
        content_type, _ = mimetypes.guess_type(filename)
        maintype, _, subtype = (content_type or "application/octet-stream").partition(
            "/"
        )
        message.add_attachment(
            data, maintype=maintype, subtype=subtype, filename=filename
        )

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as client:
            client.starttls()
            if settings.smtp_username and settings.smtp_password:
                client.login(settings.smtp_username, settings.smtp_password)
            client.send_message(message)
    except Exception:
        # Never let a notification failure surface past this point - the
        # Feedback row is already saved regardless (FB-001).
        logger.exception("Failed to send Feedback notification email.")
