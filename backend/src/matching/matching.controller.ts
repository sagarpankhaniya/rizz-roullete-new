import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import {
  CurrentUser,
  type JwtPayload,
} from '../common/decorators/current-user.decorator';
import { MatchmakingService } from '../matchmaking/matchmaking.service';
import { PresenceService } from '../presence/presence.service';

/**
 * HTTP fallback for call-state sync — mobile Safari + ngrok often drops
 * Socket.IO `matched` / `call_resumed` events while the REST path stays reliable.
 */
@Controller('api/match')
@UseGuards(JwtAuthGuard)
export class MatchingController {
  constructor(
    private readonly matchmaking: MatchmakingService,
    private readonly presence: PresenceService,
  ) {}

  @Get('active')
  async getActiveCall(@CurrentUser() user: JwtPayload) {
    const socketId = await this.presence.getSocketForUser(user.userId);
    if (!socketId) {
      return { synced: false as const };
    }

    const call = await this.matchmaking.syncUserToActiveCall(
      user.userId,
      socketId,
    );
    if (!call) {
      return { synced: false as const };
    }

    return { synced: true as const, call };
  }
}
