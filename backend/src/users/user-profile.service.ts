import { Injectable, NotFoundException } from '@nestjs/common';
import { UserDocument } from './schemas/user.schema';
import { UsersService } from './users.service';
import { PublicUser } from './dto/public-user.dto';
import { PaymentMethodsService } from '../payment-methods/payment-methods.service';

@Injectable()
export class UserProfileService {
  constructor(
    private readonly usersService: UsersService,
    private readonly paymentMethodsService: PaymentMethodsService,
  ) {}

  async toPublicUser(user: UserDocument): Promise<PublicUser> {
    const userId = String(user._id);
    const payment = user.isSubscribed
      ? await this.paymentMethodsService.findDefaultByUserId(userId)
      : null;

    return {
      id: userId,
      firstName: user.firstName,
      email: user.email,
      gender: user.gender,
      interestedIn: user.interestedIn,
      country: user.country ?? null,
      matchCountry: user.matchCountry ?? null,
      photo: user.photo ?? null,
      isSubscribed: Boolean(user.isSubscribed),
      subscriptionPlan: user.subscriptionPlan ?? null,
      nameOnCard: payment?.nameOnCard ?? null,
      cardLast4: payment?.cardNumber
        ? payment.cardNumber.slice(-4)
        : null,
      cardExpiry: payment?.cardExpiry ?? null,
      subscribedAt: user.subscribedAt ?? null,
      isVip: Boolean(user.isVip),
    };
  }

  async getPublicUserById(userId: string): Promise<PublicUser> {
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    return this.toPublicUser(user);
  }
}
