/**
 * Redis key schema for presence, waiting queue, and active calls.
 * All keys are additionally prefixed by RedisService (REDIS_KEY_PREFIX).
 *
 * Waiting queues are split by `{gender}:{interestedIn}` buckets so matching
 * stays O(1) LPOP even with thousands of concurrent waiters.
 */
export const RedisKeys = {
  /** SET of connected socket IDs */
  onlineSet: () => 'presence:online',

  /** HASH — identity, connectedAt, status for a socket */
  presenceUser: (socketId: string) => `presence:user:${socketId}`,

  /**
   * @deprecated Blind FIFO list — kept only for cleanup of legacy entries.
   * Prefer {@link waitingBucket}.
   */
  waitingQueue: () => 'matchmaking:waiting',

  /**
   * LIST — FIFO waiters for a gender/preference bucket.
   * bucket = `{gender}:{interestedIn}` e.g. `male:female`, `female:everyone`
   * Key path is `matchmaking:bucket:...` so it never collides with waiting-user hashes.
   */
  waitingBucket: (bucket: string) => `matchmaking:bucket:${bucket}`,

  /** HASH — identity, gender, interestedIn, bucket, joinedAt for a waiting socket */
  waitingUser: (socketId: string) => `matchmaking:waiting:${socketId}`,

  /** STRING (JSON) — active call shared by both participants */
  activeCall: (socketId: string) => `call:socket:${socketId}`,

  /** STRING (JSON) — live match prefs cache { gender, interestedIn } */
  userPrefs: (userId: string) => `user:prefs:${userId}`,

  /** LIST — async Mongo preference update jobs */
  prefUpdateQueue: () => 'jobs:pref-update',
} as const;

export type PresenceStatus = 'online' | 'waiting' | 'in_call';
