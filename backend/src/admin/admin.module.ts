import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UsersModule } from '../users/users.module';
import { MailModule } from '../mail/mail.module';
import { RedisModule } from '../redis/redis.module';
import { AuthModule } from '../auth/auth.module';
import { InvitesModule } from '../invites/invites.module';
import { AdminAuthController } from './admin-auth.controller';
import { AdminUsersController } from './admin-users.controller';
import { AdminCreatorsController } from './admin-creators.controller';
import { AdminInvitesController } from './admin-invites.controller';
import { AdminAnalyticsController } from './admin-analytics.controller';
import { AdminAuthService } from './admin-auth.service';
import { AdminUsersService } from './admin-users.service';
import { AdminCreatorsService } from './admin-creators.service';
import { AdminAnalyticsService } from './admin-analytics.service';
import { AdminAuthGuard } from './guards/admin-auth.guard';

@Module({
  imports: [
    UsersModule,
    MailModule,
    RedisModule,
    AuthModule,
    InvitesModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.secret'),
        signOptions: { expiresIn: '7d' },
      }),
    }),
  ],
  controllers: [
    AdminAuthController,
    AdminUsersController,
    AdminCreatorsController,
    AdminInvitesController,
    AdminAnalyticsController,
  ],
  providers: [
    AdminAuthService,
    AdminUsersService,
    AdminCreatorsService,
    AdminAnalyticsService,
    AdminAuthGuard,
  ],
  exports: [
    AdminAuthService,
    AdminUsersService,
    AdminCreatorsService,
    AdminAnalyticsService,
  ],
})
export class AdminModule {}
