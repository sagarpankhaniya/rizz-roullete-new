import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ApiWrappedOkResponse } from '../../common/decorators/api-wrapped-ok.decorator';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import {
  GuestAuthDto,
  GuestAuthResponseDto,
  PublicUserDto,
} from './dto/guest-auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { AuthenticatedUser } from './interfaces/jwt-payload.interface';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('guest')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Create or resume a guest session',
    description:
      'Issues an app JWT bound to a Mongo user. Pass the same anonymousId to resume.',
  })
  @ApiWrappedOkResponse(GuestAuthResponseDto)
  createGuest(@Body() body: GuestAuthDto): Promise<GuestAuthResponseDto> {
    return this.authService.createGuestSession(body.anonymousId);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Current authenticated user' })
  @ApiWrappedOkResponse(PublicUserDto)
  getMe(@CurrentUser() user: AuthenticatedUser): Promise<PublicUserDto> {
    return this.authService.getMe(user.userId);
  }
}

