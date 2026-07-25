import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AdminAuthService } from './admin-auth.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { AdminAuthGuard } from './guards/admin-auth.guard';
import {
  CurrentUser,
  type JwtPayload,
} from '../common/decorators/current-user.decorator';

@Controller('api/admin/auth')
export class AdminAuthController {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  @Post('login')
  async login(@Body() body: AdminLoginDto) {
    const result = await this.adminAuthService.login(body.email, body.password);
    return { success: true, ...result };
  }

  @Post('forgot-password')
  async forgotPassword(@Body() body: ForgotPasswordDto) {
    const result = await this.adminAuthService.forgotPassword(body.email);
    return { success: true, ...result };
  }

  @Post('reset-password')
  async resetPassword(@Body() body: ResetPasswordDto) {
    const result = await this.adminAuthService.resetPassword(
      body.token,
      body.password,
    );
    return { success: true, ...result };
  }

  @Get('profile')
  @UseGuards(AdminAuthGuard)
  async profile(@CurrentUser() admin: JwtPayload) {
    const result = await this.adminAuthService.getProfile(admin.userId);
    return { success: true, ...result };
  }
}
