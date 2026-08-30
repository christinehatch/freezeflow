from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Freezeflow"
    database_url: str = "sqlite:///./freezeflow.db"
    environment: Literal["development", "test", "production"] = "development"

    # Comma-separated list of allowed frontend origins for CORS. The default
    # preserves today's local-dev-only behavior; a real deployment sets this
    # to its own frontend origin(s) (see ADR-0021).
    cors_allowed_origins: str = "http://127.0.0.1:5173,http://localhost:5173"

    # Feedback attachments (ADR-0020). Always available - a local directory
    # requires no configuration.
    feedback_upload_dir: str = "uploads/feedback"

    # Feedback notification email (ADR-0020). Sent via Resend's HTTP API
    # rather than raw SMTP - many cloud/VPS providers block outbound SMTP
    # ports by default for new accounts, which an HTTP API sidesteps
    # entirely. All optional: an app with no Resend API key configured
    # still accepts every submission, it just doesn't actively notify
    # anyone (FB-001).
    resend_api_key: str | None = None
    feedback_from_address: str = "onboarding@resend.dev"
    feedback_notify_email: str | None = None

    model_config = SettingsConfigDict(env_file=".env", env_prefix="FREEZEFLOW_")


@lru_cache
def get_settings() -> Settings:
    return Settings()
