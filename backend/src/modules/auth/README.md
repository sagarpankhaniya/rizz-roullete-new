# Auth Module

**Purpose:** Issue and validate JWTs for guest (and later Google) users.

**Why Passport?** Standard Nest auth strategy pattern; swapping Google OAuth later is additive, not a rewrite.

**Public API (Step 4):**
- `POST /api/auth/guest` → `{ accessToken, user }` (wrapped as `{ success, data }`)
- `GET /api/auth/me` → current user (Bearer JWT)

**Internal:** `JwtStrategy`, `JwtAuthGuard`. Socket handshake middleware reuses the same JWT secret in Step 5.
