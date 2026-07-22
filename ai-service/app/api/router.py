from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.dependencies import get_gender_verifier
from app.core.config import get_settings
from app.schemas.gender import (
    GenderVerificationRequest,
    GenderVerificationResponse,
)
from app.services.gender_verification import GenderVerificationService
from app.utils.image import decode_base64_image

router = APIRouter()


@router.get("/health", tags=["system"])
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.post(
    "/verify-gender",
    response_model=GenderVerificationResponse,
    response_model_by_alias=True,
    response_model_exclude_none=True,
    tags=["inference"],
)
def verify_gender(
    payload: GenderVerificationRequest,
    verifier: Annotated[GenderVerificationService, Depends(get_gender_verifier)],
) -> GenderVerificationResponse:
    settings = get_settings()
    image = decode_base64_image(
        payload.image,
        max_bytes=settings.max_image_bytes,
        max_pixels=settings.max_image_pixels,
    )
    result = verifier.verify(image)
    return GenderVerificationResponse(
        faceDetected=result.face_detected,
        multipleFaces=result.multiple_faces,
        gender=result.gender,
        confidence=result.confidence,
    )
