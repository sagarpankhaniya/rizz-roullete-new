import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import configuration from './config/configuration';
import { RedisModule } from './redis/redis.module';
import { PresenceModule } from './presence/presence.module';
import { LivekitModule } from './livekit/livekit.module';
import { MatchingModule } from './matching/matching.module';
import { MatchmakingModule } from './matchmaking/matchmaking.module';
import { CallSessionModule } from './call-session/call-session.module';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { HealthController } from './health.controller';
import { ProfileModule } from './profile/profile.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { InvitesModule } from './invites/invites.module';
import { GenderVerificationModule } from './gender-verification/gender-verification.module';
import { AgeVerificationModule } from './age-verification/age-verification.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [configuration],
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const uri = config.get<string>('mongodb.uri');
        if (!uri) {
          throw new Error('MONGODB_URI is required');
        }
        return { uri };
      },
    }),
    AuthModule,
    AdminModule,
    InvitesModule,
    ProfileModule,
    SubscriptionsModule,
    GenderVerificationModule,
    AgeVerificationModule,
    RedisModule,
    PresenceModule,
    LivekitModule,
    CallSessionModule,
    MatchmakingModule,
    MatchingModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
