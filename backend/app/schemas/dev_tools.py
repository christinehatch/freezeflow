from pydantic import BaseModel, Field


class RandomBatchRequest(BaseModel):
    count: int = Field(default=100, ge=1, le=500)


class DevToolResult(BaseModel):
    action: str
    message: str
    counts: dict[str, int]
