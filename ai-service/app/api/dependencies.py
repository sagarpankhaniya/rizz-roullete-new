from fastapi import Request

from app.core.exceptions import ServiceError
from app.services.gender_verification import GenderVerificationService


def get_gender_verifier(request: Request) -> GenderVerificationService:
    verifier = request.app.state.gender_verifier
    if verifier is None:
        raise ServiceError(
            503,
            "model_unavailable",
            "The gender inference model is not available.",
        )
    return verifier
