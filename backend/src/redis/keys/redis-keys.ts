/**
 * Redis key builders (runtime).
 * Mirrors shared/constants/redis-keys.ts — workspace package linking comes later.
 * WHY prefix `rr:`: avoid collisions on shared Redis instances.
 */
export const RedisKeyPrefix = 'rr' as const;

export const RedisKeys = {
  waitingQueue: () => `${RedisKeyPrefix}:queue:waiting`,
  waitingBucket: (bucket: string) =>
    `${RedisKeyPrefix}:queue:waiting:${bucket}`,
  presence: (userId: string) => `${RedisKeyPrefix}:presence:${userId}`,
  socket: (userId: string) => `${RedisKeyPrefix}:socket:${userId}`,
  room: (roomId: string) => `${RedisKeyPrefix}:room:${roomId}`,
  userRoom: (userId: string) => `${RedisKeyPrefix}:user:room:${userId}`,
  chat: (roomId: string) => `${RedisKeyPrefix}:chat:${roomId}`,
  recentPartners: (userId: string) => `${RedisKeyPrefix}:recent:${userId}`,
  matchLock: (shard = 'global') => `${RedisKeyPrefix}:lock:match:${shard}`,
  rateLimit: (userId: string, action: string) =>
    `${RedisKeyPrefix}:rate:${userId}:${action}`,
} as const;

