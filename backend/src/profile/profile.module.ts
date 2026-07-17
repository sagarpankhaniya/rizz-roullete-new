import { Module } from '@nestjs/common';
import { ProfileController } from './profile.controller';
import { PreferenceQueueService } from './preference-queue.service';
import { UsersModule } from '../users/users.module';
import { UserProfileModule } from '../users/user-profile.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [UsersModule, UserProfileModule, RedisModule],
  controllers: [ProfileController],
  providers: [PreferenceQueueService],
  exports: [PreferenceQueueService],
})
export class ProfileModule {}
