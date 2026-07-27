# Backend — NestJS + MongoDB + Redis + LiveKit

## Scripts

```bash
npm run start:dev   # watch mode
npm run build
npm run start:prod
```

## Environment

Copy `.env.example` → `.env`. Key variables:

| Variable | Purpose |
|----------|---------|
| `PORT` / `CORS_ORIGIN` | HTTP + Socket.IO |
| `MONGODB_URI` | Call session persistence |
| `REDIS_URL` (or `REDIS_HOST`/`PORT`) | Presence, waiting queue, Socket.IO adapter |
| `REDIS_KEY_PREFIX` | Key namespace (default `rizz:`) |
| `LIVEKIT_URL` | Browser WebSocket URL (`ws://` / `wss://`); Nest derives the HTTP Room API host from it |
| `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | Must match keys in the self-hosted `livekit.yaml` |
| `LIVEKIT_ROOM_EMPTY_TIMEOUT` / `LIVEKIT_MAX_PARTICIPANTS` / `LIVEKIT_TOKEN_TTL` | Room/token tunables |

## Architecture

```
MatchingGateway (Socket.IO)     ← thin emit/validation layer
        │
        ├── PresenceService     ← online users in Redis
        └── MatchmakingService  ← waiting queue + match orchestration
                ├── LivekitService     ← rooms + tokens only
                └── CallSessionService ← MongoDB session records
```

Redis holds:
- Online users (`presence:*`)
- Waiting queue (`matchmaking:waiting`)
- Active call mappings (`call:socket:*`)

Socket.IO uses the Redis adapter so multiple NestJS instances can notify partners across processes.

## Matchmaking flow

1. Client connects → marked online in Redis
2. `start_call` → join Redis FIFO queue
3. If a waiter exists → create LiveKit room + tokens → `matched` to both
4. Disconnect before match → removed from Redis queue
5. Disconnect / leave during call → partner gets `partner_left`, room cleaned up
6. Remaining user stays connected and can `start_call` again without refresh
