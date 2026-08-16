import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { PresenceModule } from '../presence/presence.module';
import { CreatorsController } from './creators.controller';
import { CreatorsService } from './creators.service';

@Module({
  imports: [UsersModule, PresenceModule],
  controllers: [CreatorsController],
  providers: [CreatorsService],
  exports: [CreatorsService],
})
export class CreatorsModule {}
