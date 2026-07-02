from typing import Any

from fastapi import HTTPException
from fastapi.encoders import jsonable_encoder

from app.services.errors import BusinessRuleError


def success(data: Any = None, *, meta: dict[str, Any] | None = None) -> dict[str, Any]:
    return {
        "success": True,
        "data": jsonable_encoder({} if data is None else data),
        "meta": meta or {},
    }


def empty_success() -> dict[str, Any]:
    return {"success": True, "data": {}, "meta": {}}


def raise_api_error(error: BusinessRuleError) -> None:
    raise HTTPException(
        status_code=error.status_code,
        detail={
            "code": "business_rule_violation",
            "message": str(error),
        },
    )
