/**
 * Central configuration factory — all runtime settings come from env vars.
 * Bound via ConfigModule.forRoot({ load: [configuration] }).
 */
export default () => ({
  port: parseInt(process.env.PORT ?? '3001', 10),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',

  jwt: {
    secret: process.env.JWT_SECRET,
  },

  mongodb: {
    uri: process.env.MONGODB_URI,
  },

  mail: {
    brevoApiKey: process.env.BREVO_API_KEY,
    from: process.env.MAIL_FROM ?? 'Rizz <sagarjpdev@gmail.com>',
  },

  redis: {
    url: process.env.REDIS_URL,
    host: process.env.REDIS_HOST ?? '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB ?? '0', 10),
    keyPrefix: process.env.REDIS_KEY_PREFIX ?? 'rizz:',
  },

  livekit: {
    url: process.env.LIVEKIT_URL,
    host: process.env.LIVEKIT_HOST,
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
    tokenTtl: process.env.LIVEKIT_TOKEN_TTL ?? '2h',
  },
});
