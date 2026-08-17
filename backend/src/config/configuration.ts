/**
 * Central configuration factory — all runtime settings come from env vars.
 * Bound via ConfigModule.forRoot({ load: [configuration] }).
 */
export default () => ({
  port: parseInt(process.env.PORT ?? '3001', 10),
  /** development | production | test — age verification is skipped outside production */
  nodeEnv: process.env.NODE_ENV ?? 'development',
  corsOrigin:
    process.env.CORS_ORIGIN ??
    'http://localhost:5173,http://localhost:5174',
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  adminFrontendUrl:
    process.env.ADMIN_FRONTEND_URL ?? 'http://localhost:5174',

  jwt: {
    secret: process.env.JWT_SECRET,
  },

  mongodb: {
    uri: process.env.MONGODB_URI,
  },

  mail: {
    brevoApiKey: process.env.BREVO_API_KEY,
    from: process.env.MAIL_FROM ?? 'Rizz <shahvishwash@gmail.com>',
    adminEmail: (
      process.env.ADMIN_UNBAN_EMAIL ?? 'u8jknkhkh@yopmail.com'
    ).trim(),
  },

  aiService: {
    url: process.env.AI_SERVICE_URL ?? 'http://127.0.0.1:8000',
    genderConfidenceThreshold: parseFloat(
      process.env.AI_GENDER_CONFIDENCE_THRESHOLD ?? '0.60',
    ),
  },

  /** Official self-hosted Go.cam (see /go-cam). */
  goCam: {
    /** Server-side reachability / internal base (http://localhost:3300). */
    baseUrl: process.env.GO_CAM_BASE_URL ?? 'http://localhost:3300',
    /**
     * Browser-facing base for iframe/popup URLs.
     * Behind HTTPS ngrok, set to the Vite proxy path, e.g.
     * https://YOUR.ngrok-free.dev/go-cam-avs
     * If unset, Nest derives https://<request-origin>/go-cam-avs for HTTPS pages.
     */
    publicUrl: process.env.GO_CAM_PUBLIC_URL ?? '',
    cipherKey:
      process.env.GO_CAM_CIPHER_KEY ??
      'zIkmW2zEgzlTLTRC5xeMbcOhHcE5sBHB',
    callbackUrl:
      process.env.GO_CAM_CALLBACK_URL ??
      'http://localhost:3001/api/age-verification/callback',
  },

  redis: {
    url: process.env.REDIS_URL,
    host: process.env.REDIS_HOST ?? '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB ?? '0', 10),
    keyPrefix: process.env.REDIS_KEY_PREFIX ?? 'rizz:',
  },

  /**
   * Self-hosted LiveKit on the Ubuntu VPS (not LiveKit Cloud).
   * Set LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET to match
   * the keys in the LiveKit server config (e.g. /etc/livekit.yaml).
   * RoomService HTTP host is derived from LIVEKIT_URL (ws→http, wss→https).
   */
  socket: {
    /** Allow mobile/background tabs extra time before treating socket as dead */
    pingTimeoutMs: parseInt(process.env.SOCKET_PING_TIMEOUT_MS ?? '60000', 10),
    pingIntervalMs: parseInt(process.env.SOCKET_PING_INTERVAL_MS ?? '25000', 10),
    /** Seconds to wait for socket reconnect before ending an active call */
    callDisconnectGraceSec: parseInt(
      process.env.CALL_DISCONNECT_GRACE_SEC ?? '30',
      10,
    ),
  },

  livekit: {
    /** Browser WebSocket URL returned on `matched` (ws:// or wss://) */
    url: process.env.LIVEKIT_URL,
    apiKey: process.env.LIVEKIT_API_KEY,
    apiSecret: process.env.LIVEKIT_API_SECRET,
    /** Empty-room auto-close timeout in seconds */
    roomEmptyTimeout: parseInt(
      process.env.LIVEKIT_ROOM_EMPTY_TIMEOUT ?? '300',
      10,
    ),
    maxParticipants: parseInt(
      process.env.LIVEKIT_MAX_PARTICIPANTS ?? '2',
      10,
    ),
    /** Shared roulette pool — participants stay connected across skips */
    poolRoomName: process.env.LIVEKIT_POOL_ROOM ?? 'match-pool',
    poolMaxParticipants: parseInt(
      process.env.LIVEKIT_POOL_MAX_PARTICIPANTS ?? '500',
      10,
    ),
    tokenTtl: process.env.LIVEKIT_TOKEN_TTL ?? '2h',
  },

  /** Azure AI Translator — server-side only; never expose keys to the browser. */
  translation: {
    apiKey: process.env.AZURE_TRANSLATOR_KEY,
    region: process.env.AZURE_TRANSLATOR_REGION,
    endpoint:
      process.env.AZURE_TRANSLATOR_ENDPOINT ??
      'https://api.cognitive.microsofttranslator.com',
  },
});
