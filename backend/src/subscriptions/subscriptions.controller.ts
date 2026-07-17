import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import {
  CurrentUser,
  type JwtPayload,
} from '../common/decorators/current-user.decorator';
import { PaymentMethodsService } from '../payment-methods/payment-methods.service';
import { UserProfileService } from '../users/user-profile.service';
import { UsersService } from '../users/users.service';
import { SubscribeDto } from './dto/subscribe.dto';

@Controller('api')
@UseGuards(JwtAuthGuard)
export class SubscriptionsController {
  constructor(
    private readonly usersService: UsersService,
    private readonly paymentMethodsService: PaymentMethodsService,
    private readonly userProfileService: UserProfileService,
  ) {}

  /** Mock subscribe — stores card separately, sets user.isSubscribed. */
  @Post('subscribe')
  async subscribe(
    @CurrentUser() user: JwtPayload,
    @Body() body: SubscribeDto,
  ) {
    const digits = body.cardNumber.replace(/\s/g, '');
    if (!/^\d{13,19}$/.test(digits)) {
      throw new BadRequestException('Invalid card number.');
    }
    if (!/^\d{2}\/\d{2}$/.test(body.expiry.trim())) {
      throw new BadRequestException('Expiry must be MM/YY.');
    }

    await this.paymentMethodsService.upsertDefaultForUser(user.userId, {
      nameOnCard: body.nameOnCard.trim(),
      cardNumber: digits,
      cardExpiry: body.expiry.trim(),
    });
    await this.usersService.markSubscribed(user.userId, body.plan);

    const publicUser = await this.userProfileService.getPublicUserById(
      user.userId,
    );
    return { success: true, user: publicUser };
  }
}
