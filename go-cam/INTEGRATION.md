# Go.cam Age Verification (self-hosted)

This folder contains the **official** [Go.cam open-source](https://github.com/Godotcam/goCamOpenSource) age verification service, installed as an isolated sibling of `frontend/` and `backend/`.

- No custom AI models
- No third-party age-estimation libraries
- No paid/cloud age APIs
- Fully self-hosted; verification runs on-device in the browser

Upstream pin: see [`UPSTREAM`](./UPSTREAM). Official docs: [`README.md`](./README.md) and https://go.cam/devDoc/

---

## Prerequisites

- **Node.js 20** (officially recommended by Go.cam; Node 22+ may work but is untested by upstream)
- Webcam access requires `localhost` or HTTPS

---

## Exact commands

### 1. Install dependencies

```bash
cd go-cam
npm install
```

### 2. Configure the environment

**Local development** (default official values):

```bash
cd go-cam
cp .env.example .env
```

**Production**:

```bash
cd go-cam
cp .env.production.example .env
# Edit .env:
# - set HTTP_SERVER_PROTOCOL=https
# - set HTTP_SERVER_HOST to your public hostname
# - set ENCRYPTION_KEY to a fresh 32-character secret (openssl rand -hex 16)
```

Environment variables (from official `.env.example`):

| Variable | Default | Purpose |
| --- | --- | --- |
| `HTTP_SERVER_PROTOCOL` | `http` | `http` or `https` |
| `HTTP_SERVER_HOST` | `localhost` | Bind / advertised host |
| `HTTP_SERVER_PORT` | `3300` | Service port |
| `ENCRYPTION_KEY` | (example key) | AES-256-CBC key; **must match** NestJS `cipherKey` |
| `ENCRYPTION_ALGORITHM` | `aes-256-cbc` | Must stay `aes-256-cbc` |
| `ENABLE_FRONTEND_DEBUG` | `false` | Frontend debug flag |

### 3. Start the service

Development (auto-restart on backend file changes):

```bash
cd go-cam
npm run startDev
```

Production:

```bash
cd go-cam
npm run startProd
```

Default URL: **http://localhost:3300**

### 4. Verify the service is working

```bash
# Health-style smoke check (official /test route)
curl -s http://localhost:3300/test
# Expected: test

# Home / implementation guide UI
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3300/
# Expected: 200
```

Open http://localhost:3300 in a browser. You should see the Go.cam UI and the built-in implementation guide.

Optional: run the official Node.js partner demo (separate process) against this service:

```bash
cd go-cam/example/nodejs
npm install
npm run start
# Demo UI: http://localhost:8000
```

---

## Architecture (recommended / official)

```
┌─────────────────┐     encrypted token URL      ┌──────────────────┐
│  NestJS backend │ ───────────────────────────► │  go-cam (:3300)  │
│  (generates URL │                              │  official AVS    │
│   via official  │◄── POST callback (S2S) ──────│  selfie / ID     │
│   Node SDK)     │                              └────────┬─────────┘
└────────┬────────┘                                       │
         │                                                │ iframe or redirect
         ▼                                                ▼
┌─────────────────┐                              ┌──────────────────┐
│ React frontend  │ ◄── overlay events / unlock ─│ User browser     │
└─────────────────┘                              └──────────────────┘
```

1. Your backend builds an encrypted payload with the official SDK (`example/nodejs/app/lib/avsNodejsSdkV1.js`).
2. User opens `/token/?d=...` (redirect) or `/token/iframeCheck?d=...` (iframe).
3. Age check runs **in the browser** (self-hosted models served by this app).
4. Go.cam POSTs results to your `callbackUrl` (server-to-server).
5. Optionally verify cookie/payload integrity with `fromPayload()` using the same `ENCRYPTION_KEY`.

---

## How our NestJS backend should communicate with Go.cam

**No backend changes have been made yet.** When you are ready to integrate, use the official Node SDK only — do not invent a custom protocol.

### Shared secret

`go-cam/.env` → `ENCRYPTION_KEY` must equal the NestJS SDK `cipherKey` (32 characters).

Suggested NestJS env (to add later, with your approval):

```env
GO_CAM_BASE_URL=http://localhost:3300
GO_CAM_CIPHER_KEY=zIkmW2zEgzlTLTRC5xeMbcOhHcE5sBHB
GO_CAM_CALLBACK_URL=http://localhost:3001/age-verification/callback
GO_CAM_LINK_BACK=http://localhost:5173/
```

### Generate a verification URL (server-side)

Copy the official SDK from:

`go-cam/example/nodejs/app/lib/avsNodejsSdkV1.js`

Example (redirect flow):

```js
const AvsNodejsSdkV1 = require('./avsNodejsSdkV1');

const avsSdk = new AvsNodejsSdkV1(process.env.GO_CAM_CIPHER_KEY);

avsSdk.fillRequest({
  userData: {
    userId: user.id, // your account id
  },
  httpParamList: {
    userAgent: req.headers['user-agent'],
    websiteHostname: 'your-site.example',
    paramList: {
      showDetectedAgeNumber: false,
      verificationTypeList: ['selfie', 'scanId'],
    },
  },
  verificationVersion: AvsNodejsSdkV1.VERIFICATION_VERSION_STANDARD_V1, // or IFRAME_V1
  linkBack: process.env.GO_CAM_LINK_BACK,
  callbackURL: process.env.GO_CAM_CALLBACK_URL,
  ipStr: req.ip,
  countryCode: 'US', // optional ISO country
  stateCode: '',
});

const redirectUrl = avsSdk.toUrl(process.env.GO_CAM_BASE_URL);
// or iframe: avsSdk.toIframeUrl(process.env.GO_CAM_BASE_URL)
```

### Receive the verification callback (server-to-server)

Go.cam POSTs `application/x-www-form-urlencoded` to `callbackUrl` with fields including:

| Field | Meaning |
| --- | --- |
| `userData` | JSON string of the `userData` you sent |
| `state` / `stateInt` | Result state (`stateInt === 2` = success in official examples) |
| `sessionId` | Go.cam session id |
| `errorCode` | Error code when failed |
| `stepId` | Verification step |
| `idCountry` / `idState` / `idType` | ID document metadata when applicable |
| `websiteHostname` | Hostname you supplied |
| `ip` | IP recorded for the session |
| `deviceType` | Parsed device type |

Your NestJS endpoint should:

1. Parse `userData` and look up the user.
2. Accept only `stateInt === 2` as verified.
3. Persist verification status in MongoDB.
4. Return a success HTTP response so Go.cam considers the callback delivered.

Official demo callback logger lives at Go.cam’s own `POST /callback` (writes `log/callback.log`). Point `callbackURL` at **your** NestJS route in production, not at Go.cam’s demo logger.

### Payload integrity check (optional, iframe flow)

Frontend can send the encrypted cookie/payload to NestJS; decrypt with the same SDK:

```js
const avsSdk = new AvsNodejsSdkV1(process.env.GO_CAM_CIPHER_KEY);
if (avsSdk.fromPayload(verificationResultPayload)
    && avsSdk.verificationResult.stateInt === 2) {
  // trusted success
}
```

See official example: `example/nodejs/app/route/iframe.js` → `POST /iframe/payloadIntegrityCheck`.

### Frontend integration options

| Mode | SDK helper | UX |
| --- | --- | --- |
| Redirect | `toUrl()` | New window / full redirect |
| Iframe overlay | `toIframeUrl()` + `avsJsSdkV1.js` | Overlay on current page |

JS overlay events are documented in the Go.cam UI at http://localhost:3300 (Implementation guide). Official frontend helper: `example/nodejs/app/public/static/js/avsJsSdkV1.js`.

---

## Updating Go.cam in the future

This tree is a vendored copy of the official repo (nested `.git` removed so it lives inside this monorepo). Upstream commit is recorded in `UPSTREAM`.

```bash
# From repo root
cd /tmp
git clone --depth 1 https://github.com/Godotcam/goCamOpenSource.git goCamOpenSource-latest
COMMIT=$(git -C goCamOpenSource-latest rev-parse HEAD)

# Preserve our env and docs, replace upstream code
rsync -a --delete \
  --exclude '.env' \
  --exclude 'node_modules' \
  --exclude 'log' \
  --exclude 'INTEGRATION.md' \
  --exclude 'UPSTREAM' \
  --exclude '.env.production.example' \
  /tmp/goCamOpenSource-latest/ \
  /path/to/rizz-routlet/go-cam/

# Refresh pin + deps
echo "source=https://github.com/Godotcam/goCamOpenSource.git" > go-cam/UPSTREAM
echo "ref=main" >> go-cam/UPSTREAM
echo "commit=$COMMIT" >> go-cam/UPSTREAM
echo "cloned=$(date -u +%Y-%m-%d)" >> go-cam/UPSTREAM

cd go-cam
npm install
npm run startProd
curl -s http://localhost:3300/test
```

After updating:

1. Re-apply any production `.env` values (never commit secrets).
2. Diff `example/nodejs/app/lib/avsNodejsSdkV1.js` if you copied it into NestJS (`backend/src/age-verification/lib/`).
3. Smoke-test `/test`, redirect, and iframe flows.

---

## NestJS integration (wired)

This monorepo now runs:

1. **Gender verification** (existing camera + AI service)
2. **Go.cam age verification** (official iframe overlay)
3. **Ban under 18** — Go.cam callback `stateInt === 3` bans the account

Backend env (see `backend/.env.example`):

```env
GO_CAM_BASE_URL=http://localhost:3300
GO_CAM_CIPHER_KEY=zIkmW2zEgzlTLTRC5xeMbcOhHcE5sBHB
GO_CAM_CALLBACK_URL=http://localhost:3001/api/age-verification/callback
```

`GO_CAM_CIPHER_KEY` must equal `ENCRYPTION_KEY` in `go-cam/.env`.

NestJS routes:

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/api/age-verification/session` | JWT | Create Go.cam iframe URL (requires gender verified) |
| POST | `/api/age-verification/callback` | none | Go.cam S2S result → mark verified or ban |
| POST | `/api/age-verification/integrity` | JWT | Decrypt/verify iframe success payload |
| GET | `/api/age-verification/status` | JWT | `{ ageVerified, isBanned, banReason }` |

Matching is blocked until both gender Redis flag and `user.ageVerified` are set.

---

## Production notes

- Terminate TLS in front of Go.cam (webcam APIs require secure context except on `localhost`).
- Keep Go.cam on its own process/port (or reverse-proxy path) — do not merge it into NestJS.
- Rotate `ENCRYPTION_KEY` only with a coordinated NestJS deploy (old cookies become invalid).
- Process manager example (optional):

```bash
cd go-cam
# e.g. with pm2
npx pm2 start npm --name go-cam -- run startProd
```

- Official build tooling (only needed if you change Go.cam source):

```bash
npm run build          # full rebuild
npm run startProd      # run compiled app under app/backend
```

---

## Isolation policy

| Path | Role |
| --- | --- |
| `go-cam/` | Official AVS service only |
| `backend/` | NestJS — integrate later via official SDK + callback |
| `frontend/` | React — integrate later via redirect or iframe SDK |

This setup does **not** modify `frontend/` or `backend/`. Backend env vars and routes above are documentation for a future integration step — say when you want those wired in.
