import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UnbanRequestDto } from './dto/unban-request.dto';
import { UsersService } from '../users/users.service';
import {
  normalizeGender,
  normalizeInterestedIn,
} from '../common/utils/normalize.util';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import {
  CurrentUser,
  type JwtPayload,
} from '../common/decorators/current-user.decorator';
import {
  getClientIp,
  getUserAgent,
} from '../common/utils/request-meta.util';

@Controller('api')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Post('register')
  async register(@Body() body: RegisterDto, @Req() req: Request) {
    const gender = normalizeGender(body.gender);
    const interestedIn =
      normalizeInterestedIn(body.interestedIn) ?? 'everyone';

    if (!gender) {
      throw new BadRequestException('Gender is required.');
    }

    const existing = await this.usersService.findByEmail(body.email);
    if (existing) {
      throw new BadRequestException('Email already registered');
    }

    const result = await this.authService.register({
      firstName: body.firstName,
      email: body.email,
      password: body.password,
      gender,
      interestedIn,
      inviteId: body.inviteId,
      registrationIp: getClientIp(req),
      userAgent: getUserAgent(req),
    });

    return { success: true, ...result };
  }

  @Post('login')
  async login(@Body() body: LoginDto) {
    const result = await this.authService.login(body.email, body.password);
    return { success: true, ...result };
  }

  @Post('unban-request')
  async requestUnban(@Body() body: UnbanRequestDto) {
    return this.authService.requestUnban(body.email);
  }

  /** Resume session from stored JWT — used on page reload. */
  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async profile(@CurrentUser() user: JwtPayload) {
    const result = await this.authService.getProfile(user.userId);
    return { success: true, ...result };
  }
}
