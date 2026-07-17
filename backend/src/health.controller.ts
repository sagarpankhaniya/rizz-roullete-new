import { Controller, Get, Logger } from '@nestjs/common';
import { RedisService } from './redis/redis.service';
import { PresenceService } from './presence/presence.service';
import { MatchmakingService } from './matchmaking/matchmaking.service';

@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(
    private readonly redis: RedisService,
    private readonly presence: PresenceService,
    private readonly matchmaking: MatchmakingService,
  ) {}

  @Get()
  async check() {
    let redisOk = false;
    try {
      redisOk = (await this.redis.ping()) === 'PONG';
    } catch (error) {
      this.logger.error(`Redis health check failed: ${(error as Error).message}`);
    }

    let online = 0;
    let waiting = 0;
    try {
      online = await this.presence.getOnlineCount();
      waiting = await this.matchmaking.getQueueLength();
    } catch (error) {
      this.logger.warn(
        `Presence/queue stats unavailable: ${(error as Error).message}`,
      );
    }

    return {
      status: redisOk ? 'ok' : 'degraded',
      service: 'rizz-routlet-backend',
      redis: redisOk ? 'up' : 'down',
      onlineUsers: online,
      waitingUsers: waiting,
      timestamp: new Date().toISOString(),
    };
  }
}
