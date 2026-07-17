# LiveKit Module

**Purpose:** Mint participant JWTs; create/delete rooms via LiveKit Server API.

**Why isolated module?** Keeps API key/secret behind one boundary; backend never imports WebRTC media stacks.

**Does not:** Relay audio/video. Ever.

