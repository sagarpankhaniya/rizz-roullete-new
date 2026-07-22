from pydantic import BaseModel, ConfigDict, Field

from app.models.gender import Gender


class GenderVerificationRequest(BaseModel):
    image: str = Field(min_length=1, description="A base64 image or data URL")


class GenderVerificationResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    face_detected: bool = Field(alias="faceDetected")
    multiple_faces: bool | None = Field(default=None, alias="multipleFaces")
    gender: Gender | None = None
    confidence: float | None = Field(default=None, ge=0.0, le=1.0)
