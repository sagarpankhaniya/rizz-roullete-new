import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Shared ioredis client. One connection for app commands;
 * Socket.IO adapter creates its own pub/sub pair via createClient().
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client!: Redis;
  private readonly keyPrefix: string;

  constructor(private readonly config: ConfigService) {
    this.keyPrefix = this.config.get<string>('redis.keyPrefix') ?? 'rizz:';
  }

  onModuleInit() {
    this.client = this.createClient('app');
    this.client.on('connect', () => this.logger.log('Redis connected'));
    this.client.on('error', (err) =>
      this.logger.error(`Redis error: ${err.message}`),
    );
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit();
      this.logger.log('Redis connection closed');
    }
  }

  getClient(): Redis {
    return this.client;
  }

  /** Prefix-aware key helper used by Presence / Matchmaking. */
  key(suffix: string): string {
    return `${this.keyPrefix}${suffix}`;
  }

  /**
   * Fresh Redis client (no keyPrefix option — we prefix manually).
   * Used for Socket.IO pub/sub adapter pairs.
   */
  createClient(label = 'aux'): Redis {
    const url = this.config.get<string>('redis.url');
    const common = {
      maxRetriesPerRequest: null as null,
      enableReadyCheck: true,
      lazyConnect: false,
    };

    const client = url
      ? new Redis(url, common)
      : new Redis({
          host: this.config.get<string>('redis.host') ?? '127.0.0.1',
          port: this.config.get<number>('redis.port') ?? 6379,
          password: this.config.get<string>('redis.password'),
          db: this.config.get<number>('redis.db') ?? 0,
          ...common,
        });

    client.on('error', (err) =>
      this.logger.error(`Redis(${label}) error: ${err.message}`),
    );

    return client;
  }

  async ping(): Promise<string> {
    return this.client.ping();
  }
}

