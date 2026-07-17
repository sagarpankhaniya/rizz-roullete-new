import { Module } from '@nestjs/common';
import { UserProfileService } from './user-profile.service';
import { UsersModule } from './users.module';
import { PaymentMethodsModule } from '../payment-methods/payment-methods.module';

@Module({
  imports: [UsersModule, PaymentMethodsModule],
  providers: [UserProfileService],
  exports: [UserProfileService],
})
export class UserProfileModule {}

