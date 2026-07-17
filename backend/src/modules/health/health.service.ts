import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';
import { RedisService } from '../../redis/redis.service';
import type { HealthStatusDto } from './dto/health-status.dto';

@Injectable()
export class HealthService {
  constructor(
    @InjectConnection() private readonly mongoConnection: Connection,
    private readonly redisService: RedisService,
  ) {}

  async check(): Promise<HealthStatusDto> {
    const mongodb = this.mongoConnection.readyState === 1;

    let redis = false;
    try {
      redis = (await this.redisService.ping()) === 'PONG';
    } catch {
      redis = false;
    }

    const healthy = mongodb && redis;

    return {
      status: healthy ? 'ok' : 'degraded',
      version: '0.1.0',
      checks: { mongodb, redis },
      timestamp: new Date().toISOString(),
    };
  }
}

