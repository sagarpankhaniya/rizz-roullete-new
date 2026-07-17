import { Module } from '@nestjs/common';
import { MatchingGateway } from './matching.gateway';
import { MatchmakingModule } from '../matchmaking/matchmaking.module';
import { PresenceModule } from '../presence/presence.module';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { ProfileModule } from '../profile/profile.module';

@Module({
  imports: [
    MatchmakingModule,
    PresenceModule,
    AuthModule,
    UsersModule,
    ProfileModule,
  ],
  providers: [MatchingGateway],
})
export class MatchingModule {}
