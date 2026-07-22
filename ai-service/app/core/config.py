from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "Rizz Routlet AI Service"
    app_env: str = "development"
    log_level: str = "INFO"

    model_root: Path = Path(".")
    model_name: str = "buffalo_l"
    model_providers: list[str] = Field(default_factory=lambda: ["CPUExecutionProvider"])
    model_context_id: int = -1
    detection_width: int = Field(default=640, ge=160, le=2048)
    detection_height: int = Field(default=640, ge=160, le=2048)
    allow_model_download: bool = False

    max_image_bytes: int = Field(default=10 * 1024 * 1024, gt=0)
    max_image_pixels: int = Field(default=20_000_000, gt=0)

    @property
    def model_directory(self) -> Path:
        return self.model_root / "models" / self.model_name

    @property
    def detection_size(self) -> tuple[int, int]:
        return self.detection_width, self.detection_height


@lru_cache
def get_settings() -> Settings:
    return Settings()
