import { Module } from '@nestjs/common';
import { MatchmakingService } from './matchmaking.service';
import { LivekitModule } from '../livekit/livekit.module';
import { CallSessionModule } from '../call-session/call-session.module';
import { PresenceModule } from '../presence/presence.module';
import { ReportsModule } from '../reports/reports.module';

@Module({
  imports: [LivekitModule, CallSessionModule, PresenceModule, ReportsModule],
  providers: [MatchmakingService],
  exports: [MatchmakingService],
})
export class MatchmakingModule {}

