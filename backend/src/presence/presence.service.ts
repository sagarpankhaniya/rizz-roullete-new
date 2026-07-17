import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { PresenceStatus, RedisKeys } from '../redis/redis.keys';

export interface PresenceRecord {
  socketId: string;
  identity: string;
  status: PresenceStatus;
  connectedAt: string;
}

/**
 * Tracks connected (online) users in Redis so any NestJS instance
 * can see who is currently connected.
 */
@Injectable()
export class PresenceService implements OnModuleInit {
  private readonly logger = new Logger(PresenceService.name);

  constructor(private readonly redis: RedisService) {}

  /**
   * Nest restarts skip handleDisconnect, leaving zombie presence / queues /
   * active-call keys. Wipe ephemeral matchmaking state on boot so live users
   * are never paired with dead sockets.
   */
  async onModuleInit() {
    // RedisService creates the client in onModuleInit; wait a tick for connect.
    await new Promise((r) => setTimeout(r, 50));
    await this.purgeEphemeralState();
  }

  async purgeEphemeralState(): Promise<void> {
    const client = this.redis.getClient();
    const prefix = this.redis.key('');
    const patterns = [
      `${prefix}presence:*`,
      `${prefix}matchmaking:*`,
      `${prefix}call:*`,
    ];

    let deleted = 0;
    for (const pattern of patterns) {
      let cursor = '0';
      do {
        const [next, keys] = await client.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          200,
        );
        cursor = next;
        if (keys.length > 0) {
          deleted += await client.del(...keys);
        }
      } while (cursor !== '0');
    }

    this.logger.log(
      `Purged ${deleted} ephemeral Redis key(s) (presence/matchmaking/call)`,
    );
  }

  async setOnline(socketId: string, identity = ''): Promise<void> {
    const client = this.redis.getClient();
    const userKey = this.redis.key(RedisKeys.presenceUser(socketId));
    const onlineKey = this.redis.key(RedisKeys.onlineSet());
    const connectedAt = new Date().toISOString();

    const pipeline = client.pipeline();
    pipeline.hset(userKey, {
      socketId,
      identity,
      status: 'online',
      connectedAt,
    });
    pipeline.sadd(onlineKey, socketId);
    await pipeline.exec();

    this.logger.log(`Presence online: ${socketId}`);
  }

  async setOffline(socketId: string): Promise<void> {
    const client = this.redis.getClient();
    const userKey = this.redis.key(RedisKeys.presenceUser(socketId));
    const onlineKey = this.redis.key(RedisKeys.onlineSet());

    const pipeline = client.pipeline();
    pipeline.del(userKey);
    pipeline.srem(onlineKey, socketId);
    await pipeline.exec();

    this.logger.log(`Presence offline: ${socketId}`);
  }

  async updateIdentity(socketId: string, identity: string): Promise<void> {
    const userKey = this.redis.key(RedisKeys.presenceUser(socketId));
    const exists = await this.redis.getClient().exists(userKey);
    if (!exists) {
      await this.setOnline(socketId, identity);
      return;
    }
    await this.redis.getClient().hset(userKey, 'identity', identity);
  }

  async setStatus(socketId: string, status: PresenceStatus): Promise<void> {
    const userKey = this.redis.key(RedisKeys.presenceUser(socketId));
    const exists = await this.redis.getClient().exists(userKey);
    if (!exists) {
      this.logger.warn(
        `Cannot set status=${status}; socket ${socketId} not online`,
      );
      return;
    }
    await this.redis.getClient().hset(userKey, 'status', status);
  }

  async isOnline(socketId: string): Promise<boolean> {
    const onlineKey = this.redis.key(RedisKeys.onlineSet());
    return (await this.redis.getClient().sismember(onlineKey, socketId)) === 1;
  }

  async getUser(socketId: string): Promise<PresenceRecord | null> {
    const userKey = this.redis.key(RedisKeys.presenceUser(socketId));
    const data = await this.redis.getClient().hgetall(userKey);
    if (!data || !data.socketId) {
      return null;
    }
    return {
      socketId: data.socketId,
      identity: data.identity ?? '',
      status: (data.status as PresenceStatus) ?? 'online',
      connectedAt: data.connectedAt ?? '',
    };
  }

  async getOnlineCount(): Promise<number> {
    const onlineKey = this.redis.key(RedisKeys.onlineSet());
    return this.redis.getClient().scard(onlineKey);
  }
}

