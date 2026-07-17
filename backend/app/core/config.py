from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Freezeflow"
    database_url: str = "sqlite:///./freezeflow.db"
    environment: Literal["development", "test", "production"] = "development"

    model_config = SettingsConfigDict(env_file=".env", env_prefix="FREEZEFLOW_")


@lru_cache
def get_settings() -> Settings:
    return Settings()
