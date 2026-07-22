import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { GenderVerificationController } from './gender-verification.controller';
import { GenderVerificationService } from './gender-verification.service';

@Module({
  imports: [UsersModule],
  controllers: [GenderVerificationController],
  providers: [GenderVerificationService],
  exports: [GenderVerificationService],
})
export class GenderVerificationModule {}
