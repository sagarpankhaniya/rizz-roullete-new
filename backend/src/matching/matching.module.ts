import { Module } from '@nestjs/common';
import { MatchingController } from './matching.controller';
import { MatchingGateway } from './matching.gateway';
import { MatchmakingModule } from '../matchmaking/matchmaking.module';
import { PresenceModule } from '../presence/presence.module';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { ProfileModule } from '../profile/profile.module';
import { GenderVerificationModule } from '../gender-verification/gender-verification.module';
import { AgeVerificationModule } from '../age-verification/age-verification.module';
import { CoinsModule } from '../coins/coins.module';
import { ChatModule } from '../chat/chat.module';
import { TranslationModule } from '../translation/translation.module';
import { CreatorsModule } from '../creators/creators.module';

@Module({
  imports: [
    MatchmakingModule,
    PresenceModule,
    AuthModule,
    UsersModule,
    ProfileModule,
    CreatorsModule,
    GenderVerificationModule,
    AgeVerificationModule,
    CoinsModule,
    ChatModule,
    TranslationModule,
  ],
  controllers: [MatchingController],
  providers: [MatchingGateway],
})
export class MatchingModule {}
