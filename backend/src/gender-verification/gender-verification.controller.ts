import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  CurrentUser,
  type JwtPayload,
} from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { VerifyGenderDto } from './dto/verify-gender.dto';
import { GenderVerificationService } from './gender-verification.service';

@Controller('api/gender-verification')
@UseGuards(JwtAuthGuard)
export class GenderVerificationController {
  constructor(
    private readonly genderVerification: GenderVerificationService,
  ) {}

  @Post()
  verify(
    @CurrentUser() user: JwtPayload,
    @Body() body: VerifyGenderDto,
  ) {
    return this.genderVerification.verify(user.userId, body.image);
  }
}
