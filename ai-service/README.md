# AI Inference Service

Independent FastAPI service for face-based AI inference. It currently exposes
health and gender-verification endpoints. Face verification, liveness, age, and
NSFW features are intentionally not implemented; their future use cases belong
in separate service and API modules.

## Requirements

- Python 3.12 (InsightFace 0.7.3 is not compatible with NumPy 2.x, which
  prevents a reliable Python 3.13+ installation)
- A compatible InsightFace model pack containing detection and `genderage`
  ONNX models

The Python libraries in this project are open source and can be used in
commercial software under their respective licenses. **Model weights have
separate licenses.** InsightFace's official pretrained model packs are marked
for non-commercial research use. This service therefore disables automatic
model downloads by default. For commercial deployment, place model weights
whose license permits your use in:

```text
models/<MODEL_NAME>/
```

For the default name, that path is `models/buffalo_l/`. Do not enable
`ALLOW_MODEL_DOWNLOAD` in a commercial deployment unless you have separately
confirmed the downloaded model's license.

## Setup

Run these commands from the repository root:

```bash
cd ai-service
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install "numpy>=1.26,<2.0" "Cython>=3.0,<4.0"
python -m pip install -r requirements.txt
cp .env.example .env
```

Configure `.env` and install the licensed model files before starting:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Open Swagger UI at:

```text
http://127.0.0.1:8000/docs
```

Use `GET /health` in Swagger to verify the service. The expected response is:

```json
{"status": "ok"}
```

`POST /verify-gender` accepts JSON containing a raw base64 image or a base64
data URL:

```json
{"image": "data:image/jpeg;base64,..."}
```

## Configuration

Copy `.env.example` to `.env`. Important settings:

- `MODEL_ROOT`: root directory managed by InsightFace
- `MODEL_NAME`: directory/model-pack name
- `MODEL_PROVIDERS`: ONNX Runtime providers as a JSON list
- `MODEL_CONTEXT_ID`: use `-1` for CPU
- `ALLOW_MODEL_DOWNLOAD`: opt-in download switch, disabled by default
- `MAX_IMAGE_BYTES` and `MAX_IMAGE_PIXELS`: input safety limits

The model is constructed once in FastAPI's application lifespan and reused for
all requests. If required models are absent or invalid, the service still
serves its health check and API documentation, while inference requests return
HTTP `503`.

## API behavior

- `200`: inference completed, including no-face and multiple-face outcomes
- `400`: malformed base64 or unsupported/corrupt image
- `413`: encoded image exceeds configured limits
- `422`: invalid JSON request schema
- `500`: unexpected server failure

Only one face is classified. If two or more faces are detected, the response
reports `multipleFaces: true` without returning a gender.
