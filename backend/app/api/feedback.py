import json
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, UploadFile
from sqlalchemy.orm import Session

from app.api.responses import raise_api_error, success
from app.api.serializers import feedback_data
from app.core.config import Settings, get_settings
from app.database.session import get_db
from app.models import FeedbackCategory
from app.services.errors import BusinessRuleError
from app.services.feedback import create_feedback
from app.services.notifications import send_feedback_notification

router = APIRouter(tags=["feedback"])
DBSession = Annotated[Session, Depends(get_db)]
AppSettings = Annotated[Settings, Depends(get_settings)]


@router.post("/feedback", status_code=201)
def submit_feedback_endpoint(
    db: DBSession,
    settings: AppSettings,
    background_tasks: BackgroundTasks,
    category: Annotated[FeedbackCategory, Form()],
    description: Annotated[str, Form()],
    page: Annotated[str | None, Form()] = None,
    context_json: Annotated[str | None, Form()] = None,
    attachments: Annotated[list[UploadFile], File()] = [],  # noqa: B006
) -> dict[str, object]:
    parsed_context: dict[str, object] | None = None
    if context_json:
        try:
            parsed_context = json.loads(context_json)
        except ValueError:
            parsed_context = {"raw": context_json}

    try:
        feedback = create_feedback(
            db,
            category=category,
            description=description,
            page=page,
            context_json=parsed_context,
            attachment_files=attachments,
            upload_dir=settings.feedback_upload_dir,
        )
    except BusinessRuleError as error:
        raise_api_error(error)

    background_tasks.add_task(send_feedback_notification, feedback, settings)
    return success(feedback_data(feedback))
