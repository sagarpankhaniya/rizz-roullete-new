import { Module } from '@nestjs/common';
import { MatchingGateway } from './matching.gateway';
import { MatchmakingModule } from '../matchmaking/matchmaking.module';
import { PresenceModule } from '../presence/presence.module';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { ProfileModule } from '../profile/profile.module';
import { GenderVerificationModule } from '../gender-verification/gender-verification.module';
import { AgeVerificationModule } from '../age-verification/age-verification.module';

@Module({
  imports: [
    MatchmakingModule,
    PresenceModule,
    AuthModule,
    UsersModule,
    ProfileModule,
    GenderVerificationModule,
    AgeVerificationModule,
  ],
  providers: [MatchingGateway],
})
export class MatchingModule {}
