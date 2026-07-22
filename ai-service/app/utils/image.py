import base64
import binascii
import io

import cv2
import numpy as np
from PIL import Image, ImageOps, UnidentifiedImageError

from app.core.exceptions import ServiceError


def decode_base64_image(
    encoded: str,
    *,
    max_bytes: int,
    max_pixels: int,
) -> np.ndarray:
    payload = encoded.strip()
    if payload.startswith("data:"):
        header, separator, payload = payload.partition(",")
        if not separator or ";base64" not in header.lower():
            raise ServiceError(400, "invalid_image", "Invalid base64 image data URL.")

    estimated_size = len(payload) * 3 // 4
    if estimated_size > max_bytes:
        raise ServiceError(413, "image_too_large", "The image exceeds the size limit.")

    try:
        raw = base64.b64decode(payload, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ServiceError(400, "invalid_image", "Image is not valid base64.") from exc

    if not raw:
        raise ServiceError(400, "invalid_image", "Image data is empty.")
    if len(raw) > max_bytes:
        raise ServiceError(413, "image_too_large", "The image exceeds the size limit.")

    try:
        with Image.open(io.BytesIO(raw)) as image:
            width, height = image.size
            if width * height > max_pixels:
                raise ServiceError(
                    413,
                    "image_too_large",
                    "The image exceeds the pixel limit.",
                )
            image.load()
            rgb = ImageOps.exif_transpose(image).convert("RGB")
            rgb_array = np.asarray(rgb)
    except ServiceError:
        raise
    except (Image.DecompressionBombError, UnidentifiedImageError, OSError) as exc:
        raise ServiceError(400, "invalid_image", "Unsupported or corrupt image.") from exc

    return cv2.cvtColor(rgb_array, cv2.COLOR_RGB2BGR)
