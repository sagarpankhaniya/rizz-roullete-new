import { Module } from '@nestjs/common';
import { SubscriptionsController } from './subscriptions.controller';
import { PaymentMethodsModule } from '../payment-methods/payment-methods.module';
import { UsersModule } from '../users/users.module';
import { UserProfileModule } from '../users/user-profile.module';

@Module({
  imports: [PaymentMethodsModule, UsersModule, UserProfileModule],
  controllers: [SubscriptionsController],
})
export class SubscriptionsModule {}
