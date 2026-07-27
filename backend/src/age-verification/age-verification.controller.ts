import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  CurrentUser,
  type JwtPayload,
} from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AgeVerificationService } from './age-verification.service';
import { AgePayloadIntegrityDto } from './dto/age-payload-integrity.dto';

@Controller('api/age-verification')
export class AgeVerificationController {
  constructor(private readonly ageVerification: AgeVerificationService) {}

  /** Go.cam server-to-server callback (no JWT). */
  @Post('callback')
  handleCallback(@Body() body: Record<string, unknown>) {
    return this.ageVerification.handleCallback(body ?? {});
  }

  @Get('status')
  @UseGuards(JwtAuthGuard)
  status(@CurrentUser() user: JwtPayload) {
    return this.ageVerification.getStatus(user.userId);
  }

  @Post('session')
  @UseGuards(JwtAuthGuard)
  createSession(@CurrentUser() user: JwtPayload, @Req() req: Request) {
    return this.ageVerification.createSession(user.userId, req);
  }

  @Post('integrity')
  @UseGuards(JwtAuthGuard)
  integrity(
    @CurrentUser() user: JwtPayload,
    @Body() body: AgePayloadIntegrityDto,
  ) {
    return this.ageVerification.verifyPayloadIntegrity(
      user.userId,
      body.verificationResultPayload,
    );
  }
}
