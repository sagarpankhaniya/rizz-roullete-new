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
```

## Prerequisites

- Node.js 20+
- MongoDB running locally (or reachable URI)
- Self-hosted LiveKit server (Ubuntu) with known URL, API key, and secret

## Configure LiveKit (backend)

Copy env files and point them at your LiveKit host:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Set in `backend/.env`:

```env
LIVEKIT_URL=ws://YOUR_UBUNTU_HOST:7880      # browser WebSocket URL
LIVEKIT_HOST=http://YOUR_UBUNTU_HOST:7880   # NestJS RoomService API
LIVEKIT_API_KEY=devkey                      # must match livekit.yaml
LIVEKIT_API_SECRET=secret
MONGODB_URI=mongodb://localhost:27017/rizz-routlet
PORT=3001
CORS_ORIGIN=http://localhost:5173
```

`LIVEKIT_URL` is what React uses. `LIVEKIT_HOST` is what NestJS uses for `RoomServiceClient`.

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
