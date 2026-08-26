from __future__ import annotations

import uuid
from pathlib import Path

from fastapi import UploadFile
from sqlalchemy.orm import Session

from app.models import Feedback, FeedbackCategory
from app.services.errors import BusinessRuleError

MAX_ATTACHMENTS = 5
MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024


def create_feedback(
    db: Session,
    *,
    category: FeedbackCategory,
    description: str,
    page: str | None,
    context_json: dict | None,
    attachment_files: list[UploadFile],
    upload_dir: str,
) -> Feedback:
    if not description.strip():
        raise BusinessRuleError("Description is required.")
    if len(attachment_files) > MAX_ATTACHMENTS:
        raise BusinessRuleError(
            f"At most {MAX_ATTACHMENTS} attachments are allowed per submission."
        )

    # Validate every attachment before writing anything to disk, so a
    # rejected submission never leaves a partial set of files behind.
    validated: list[tuple[str, bytes]] = []
    for upload in attachment_files:
        content = upload.file.read()
        if not (upload.content_type or "").startswith("image/"):
            raise BusinessRuleError(f'"{upload.filename}" is not an image file.')
        if len(content) > MAX_ATTACHMENT_BYTES:
            raise BusinessRuleError(f'"{upload.filename}" is larger than 10 MB.')
        # Strip any directory components - an attachment's filename is
        # untrusted input and must never be used to escape the upload
        # directory.
        safe_name = Path(upload.filename or "attachment").name or "attachment"
        validated.append((safe_name, content))

    feedback_id = uuid.uuid4()
    stored_filenames: list[str] = []
    if validated:
        destination = Path(upload_dir)
        destination.mkdir(parents=True, exist_ok=True)
        for index, (filename, content) in enumerate(validated):
            stored_filename = f"{feedback_id}-{index}-{filename}"
            (destination / stored_filename).write_bytes(content)
            stored_filenames.append(stored_filename)

    feedback = Feedback(
        id=feedback_id,
        category=category,
        description=description.strip(),
        page=page,
        context_json=context_json,
        attachments=stored_filenames,
    )
    db.add(feedback)
    db.commit()
    db.refresh(feedback)
    return feedback
