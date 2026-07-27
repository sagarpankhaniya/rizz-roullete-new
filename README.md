# Rizz Routlet — Self-hosted LiveKit PoC

Random 1-to-1 video calling proof of concept. Focus: verify a **self-hosted LiveKit** server with NestJS + React.

## Stack

| Layer | Tech |
| --- | --- |
| Frontend | React (Vite + TypeScript), LiveKit Client SDK, Socket.IO client |
| Backend | NestJS, MongoDB, Socket.IO, LiveKit Server SDK |
| Media | Self-hosted LiveKit on Ubuntu (not LiveKit Cloud) |

## Flow

1. User A and User B each open the app and click **Start Call**
2. Both connect to NestJS via Socket.IO
3. NestJS keeps an in-memory waiting queue
4. When two users are waiting, NestJS creates a LiveKit room and JWTs
5. Both clients receive `{ roomName, livekitUrl, token }` and connect via `livekit-client`
6. If one disconnects, the other gets a `partner_left` event

## Project layout

```
frontend/   # Vite + React + TypeScript
backend/    # NestJS + MongoDB + Socket.IO + LiveKit Server SDK
go-cam/     # Official self-hosted Go.cam age verification (isolated)
```

Age verification is provided by the official open-source [Go.cam](https://github.com/Godotcam/goCamOpenSource) service under `go-cam/`. It runs independently of NestJS/React. See [`go-cam/INTEGRATION.md`](./go-cam/INTEGRATION.md) for install, update, and backend integration notes.

## Prerequisites

- Node.js 20+
- MongoDB running locally (or reachable URI)
- Self-hosted LiveKit server (Ubuntu) with known URL, API key, and secret

## Configure LiveKit (backend)

Point NestJS at your **self-hosted** LiveKit server on the Ubuntu VPS.
Full native install (binary + systemd + Nginx, no Docker):
[`deploy/livekit/README.md`](./deploy/livekit/README.md).

Copy env files and set credentials that match `/etc/livekit/livekit.yaml`:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Set in `backend/.env` (copy key/secret from `deploy/livekit/credentials.env` after install):

```env
LIVEKIT_URL=wss://livekit.YOUR_DOMAIN
LIVEKIT_API_KEY=<from credentials.env>
LIVEKIT_API_SECRET=<from credentials.env>
LIVEKIT_ROOM_EMPTY_TIMEOUT=300
LIVEKIT_MAX_PARTICIPANTS=2
LIVEKIT_TOKEN_TTL=2h
MONGODB_URI=mongodb://localhost:27017/rizz-routlet
PORT=3001
CORS_ORIGIN=http://localhost:5173
```

The frontend never reads LiveKit env vars — it connects only to `livekitUrl` from the `matched` event.

## Run

Terminal 1 — backend:

```bash
cd backend
npm install
npm run start:dev
```

Terminal 2 — frontend:

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 in **two** browser windows, allow camera/mic, and click **Start Call** in both.

### Go.cam (age verification) — optional / independent

```bash
cd go-cam
cp .env.example .env
npm install
npm run startDev    # or: npm run startProd
```

Verify: `curl -s http://localhost:3300/test` → `test`. Full guide: [`go-cam/INTEGRATION.md`](./go-cam/INTEGRATION.md).

## Backend architecture

```
src/
  livekit/         # AccessToken + RoomServiceClient wrappers
  matching/        # In-memory queue + Socket.IO gateway
  call-session/    # MongoDB persistence of matched sessions
  common/types/    # Shared Socket.IO event contracts
```

Controllers/gateways stay thin; matching and LiveKit logic live in services.

## Frontend architecture

```
src/
  hooks/useMatching.ts      # Socket.IO queue / match lifecycle
  hooks/useLiveKitRoom.ts   # livekit-client Room connect + tracks
  components/               # Controls + video stage
  services/socket.ts        # Socket.IO singleton
  types/events.ts           # Event contracts
```

## Out of scope (intentional)

Auth, chat, Redis, matchmaking filters, Docker, and deployment are deferred. This PoC only proves self-hosted LiveKit integration.
