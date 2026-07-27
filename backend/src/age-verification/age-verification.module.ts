import { Module } from '@nestjs/common';
import { GenderVerificationModule } from '../gender-verification/gender-verification.module';
import { UsersModule } from '../users/users.module';
import { AgeVerificationController } from './age-verification.controller';
import { AgeVerificationService } from './age-verification.service';

@Module({
  imports: [UsersModule, GenderVerificationModule],
  controllers: [AgeVerificationController],
  providers: [AgeVerificationService],
  exports: [AgeVerificationService],
})
export class AgeVerificationModule {}
