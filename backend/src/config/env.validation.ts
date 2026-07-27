import { z } from 'zod';

/**
 * WHY Zod for env validation:
 * Fail boot immediately if required secrets/URLs are missing or mistyped.
 * Prevents partial startups that only break at first match / LiveKit call.
 */
export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  MONGODB_URI: z.string().min(1),
  REDIS_URL: z.string().min(1),

  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default('7d'),

  CORS_ORIGINS: z.string().min(1),

  /** Self-hosted LiveKit — keys must match livekit.yaml on the VPS */
  LIVEKIT_API_KEY: z.string().min(1),
  LIVEKIT_API_SECRET: z.string().min(1),
  LIVEKIT_URL: z
    .string()
    .min(1)
    .refine(
      (v) => v.startsWith('ws://') || v.startsWith('wss://'),
      'LIVEKIT_URL must be a WebSocket URL (ws:// or wss://)',
    ),
  LIVEKIT_ROOM_EMPTY_TIMEOUT: z.coerce.number().int().positive().optional(),
  LIVEKIT_MAX_PARTICIPANTS: z.coerce.number().int().positive().optional(),
  LIVEKIT_TOKEN_TTL: z.string().optional(),

  TURN_URL: z.string().optional(),
  TURN_USERNAME: z.string().optional(),
  TURN_PASSWORD: z.string().optional(),

  MATCH_RECENT_HOURS: z.coerce.number().int().positive().default(24),
  PRESENCE_TTL_SEC: z.coerce.number().int().positive().default(45),

  THROTTLE_TTL_MS: z.coerce.number().int().positive().default(60_000),
  THROTTLE_LIMIT: z.coerce.number().int().positive().default(100),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const parsed = envSchema.safeParse(config);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }

  return parsed.data;
}

