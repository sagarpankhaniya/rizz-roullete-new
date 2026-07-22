import logging
from pathlib import Path
from typing import Any

import cv2
import numpy as np
from insightface.app import FaceAnalysis
from insightface.utils import face_align

from app.core.config import Settings
from app.models.gender import Gender, GenderVerificationResult

logger = logging.getLogger(__name__)


class GenderVerificationService:
    """Owns the process-wide InsightFace and ONNX Runtime model sessions."""

    def __init__(self, face_analysis: FaceAnalysis, gender_model: Any) -> None:
        self._face_analysis = face_analysis
        self._gender_model = gender_model

    @classmethod
    def load(cls, settings: Settings) -> "GenderVerificationService":
        model_directory = settings.model_directory.resolve()
        if not model_directory.is_dir() and not settings.allow_model_download:
            raise RuntimeError(
                f"Models not found at {model_directory}. Supply commercially "
                "licensed weights or explicitly enable model downloading for "
                "non-production evaluation."
            )

        logger.info(
            "Loading InsightFace models name=%s providers=%s",
            settings.model_name,
            settings.model_providers,
        )
        analysis = FaceAnalysis(
            name=settings.model_name,
            root=str(Path(settings.model_root).resolve()),
            allowed_modules=["detection", "genderage"],
            providers=settings.model_providers,
        )
        analysis.prepare(
            ctx_id=settings.model_context_id,
            det_size=settings.detection_size,
        )

        gender_model = analysis.models.get("genderage")
        if gender_model is None:
            raise RuntimeError(
                f"Model pack '{settings.model_name}' has no gender-age model."
            )

        logger.info("InsightFace models loaded successfully")
        return cls(analysis, gender_model)

    def verify(self, image: np.ndarray) -> GenderVerificationResult:
        # Two detections are enough to distinguish the supported outcomes.
        faces = self._face_analysis.get(image, max_num=2)
        if not faces:
            return GenderVerificationResult(face_detected=False)
        if len(faces) > 1:
            return GenderVerificationResult(
                face_detected=True,
                multiple_faces=True,
            )

        gender, confidence = self._classify_gender(image, faces[0])
        return GenderVerificationResult(
            face_detected=True,
            multiple_faces=False,
            gender=gender,
            confidence=confidence,
        )

    def _classify_gender(self, image: np.ndarray, face: Any) -> tuple[Gender, float]:
        model = self._gender_model
        width = face.bbox[2] - face.bbox[0]
        height = face.bbox[3] - face.bbox[1]
        center = (
            (face.bbox[2] + face.bbox[0]) / 2,
            (face.bbox[3] + face.bbox[1]) / 2,
        )
        scale = model.input_size[0] / (max(width, height) * 1.5)
        aligned, _ = face_align.transform(
            image,
            center,
            model.input_size[0],
            scale,
            0,
        )
        mean = (model.input_mean,) * 3
        blob = cv2.dnn.blobFromImage(
            aligned,
            scalefactor=1.0 / model.input_std,
            size=tuple(aligned.shape[:2][::-1]),
            mean=mean,
            swapRB=True,
        )
        prediction = model.session.run(
            model.output_names,
            {model.input_name: blob},
        )[0][0]
        scores = np.asarray(prediction[:2], dtype=np.float64)
        probabilities = _as_probabilities(scores)
        index = int(np.argmax(probabilities))
        gender = Gender.FEMALE if index == 0 else Gender.MALE
        return gender, round(float(probabilities[index]), 4)


def _as_probabilities(scores: np.ndarray) -> np.ndarray:
    if np.all((scores >= 0.0) & (scores <= 1.0)) and np.isclose(
        scores.sum(), 1.0, atol=1e-3
    ):
        return scores
    shifted = scores - np.max(scores)
    exponentials = np.exp(shifted)
    return exponentials / exponentials.sum()
