# LiveKit Module

**Purpose:** Mint participant JWTs and create/delete rooms against the
**self-hosted** LiveKit server on the Ubuntu VPS.

**Config (backend `.env`):** `LIVEKIT_URL`, `LIVEKIT_API_KEY`,
`LIVEKIT_API_SECRET`, `LIVEKIT_ROOM_EMPTY_TIMEOUT`,
`LIVEKIT_MAX_PARTICIPANTS`, `LIVEKIT_TOKEN_TTL`.

Keys must match the LiveKit server config (`livekit.yaml`). No Cloud account.

**Why isolated?** Keeps API key/secret behind one boundary; backend never
imports WebRTC media stacks. Clients receive `{ roomName, livekitUrl, token }`
on the existing `matched` event.

**Does not:** Relay audio/video. Ever.
