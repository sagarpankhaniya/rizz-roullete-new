import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type Redis from 'ioredis';
import { RedisService } from '../redis/redis.service';
import { RedisKeys } from '../redis/redis.keys';
import { UsersService } from '../users/users.service';

export type CachedPrefs = {
  gender: string;
  interestedIn: string;
};

type PrefUpdateJob = {
  userId: string;
  interestedIn: string;
  enqueuedAt: number;
};

/**
 * Fast path: cache prefs in Redis immediately.
 * Slow path: enqueue Mongo write so matching doesn't wait on DB.
 */
@Injectable()
export class PreferenceQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PreferenceQueueService.name);
  private running = false;
  private worker!: Redis;

  constructor(
    private readonly redis: RedisService,
    private readonly usersService: UsersService,
  ) {}

  onModuleInit() {
    // Dedicated connection — BLPOP must not block the shared app client
    this.worker = this.redis.createClient('pref-queue');
    this.running = true;
    void this.drainLoop();
  }

  async onModuleDestroy() {
    this.running = false;
    if (this.worker) {
      await this.worker.quit();
    }
  }

  async cachePrefs(userId: string, prefs: CachedPrefs): Promise<void> {
    const key = this.redis.key(RedisKeys.userPrefs(userId));
    await this.redis
      .getClient()
      .set(key, JSON.stringify(prefs), 'EX', 60 * 60 * 24 * 7);
  }

  async getCachedPrefs(userId: string): Promise<CachedPrefs | null> {
    const raw = await this.redis
      .getClient()
      .get(this.redis.key(RedisKeys.userPrefs(userId)));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as CachedPrefs;
    } catch {
      return null;
    }
  }

  async enqueueMongoUpdate(
    userId: string,
    interestedIn: string,
  ): Promise<void> {
    const job: PrefUpdateJob = {
      userId,
      interestedIn,
      enqueuedAt: Date.now(),
    };
    await this.redis
      .getClient()
      .rpush(this.redis.key(RedisKeys.prefUpdateQueue()), JSON.stringify(job));
  }

  private async drainLoop() {
    const key = this.redis.key(RedisKeys.prefUpdateQueue());

    while (this.running) {
      try {
        const result = await this.worker.blpop(key, 1);
        if (!result) continue;
        const [, payload] = result;
        const job = JSON.parse(payload) as PrefUpdateJob;
        await this.usersService.updatePreference(job.userId, job.interestedIn);
        this.logger.debug(
          `Mongo preference updated user=${job.userId} → ${job.interestedIn}`,
        );
      } catch (error) {
        if (!this.running) break;
        this.logger.error(
          `Preference queue worker error: ${(error as Error).message}`,
        );
        await new Promise((r) => setTimeout(r, 500));
      }
    }
  }
}
