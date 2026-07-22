from dataclasses import dataclass
from enum import StrEnum


class Gender(StrEnum):
    FEMALE = "female"
    MALE = "male"


@dataclass(frozen=True)
class GenderVerificationResult:
    face_detected: bool
    multiple_faces: bool | None = None
    gender: Gender | None = None
    confidence: float | None = None
