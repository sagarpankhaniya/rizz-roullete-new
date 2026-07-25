import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'crypto';
import { UsersService } from '../users/users.service';
import { UserDocument } from '../users/schemas/user.schema';
import { verifyPassword } from '../common/utils/password.util';
import { MailService } from '../mail/mail.service';
import { RedisService } from '../redis/redis.service';

const RESET_TOKEN_TTL_SECONDS = 60 * 30; // 30 minutes

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
  ) {}

  private toAdminProfile(user: UserDocument) {
    return {
      id: String(user._id),
      firstName: user.firstName,
      email: user.email,
      role: user.role,
      createdAt: (user as UserDocument & { createdAt?: Date }).createdAt ?? null,
    };
  }

  signAdminToken(user: UserDocument): string {
    return this.jwtService.sign({
      userId: String(user._id),
      email: user.email,
      role: 'admin',
    });
  }

  async login(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user || user.role !== 'admin') {
      throw new UnauthorizedException('Invalid email or password');
    }

    const valid = await verifyPassword(password, user.password);
    if (!valid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return {
      admin: this.toAdminProfile(user),
      token: this.signAdminToken(user),
    };
  }

  async getProfile(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user || user.role !== 'admin') {
      throw new UnauthorizedException('Admin not found');
    }
    return { admin: this.toAdminProfile(user) };
  }

  async forgotPassword(email: string) {
    const user = await this.usersService.findByEmail(email);
    // Always return success to avoid email enumeration.
    if (!user || user.role !== 'admin') {
      return {
        message:
          'If an admin account exists for that email, a reset link has been sent.',
      };
    }

    const token = randomBytes(32).toString('hex');
    const key = this.redis.key(`admin-password-reset:${token}`);
    await this.redis
      .getClient()
      .set(key, String(user._id), 'EX', RESET_TOKEN_TTL_SECONDS);

    const adminFrontendUrl = (
      this.config.get<string>('adminFrontendUrl') ?? 'http://localhost:5174'
    ).replace(/\/$/, '');
    const resetUrl = `${adminFrontendUrl}/reset-password?token=${token}`;

    try {
      await this.mailService.sendAdminPasswordReset({
        to: user.email,
        firstName: user.firstName,
        resetUrl,
      });
    } catch (error) {
      throw new ServiceUnavailableException({
        error:
          error instanceof Error
            ? error.message
            : 'Failed to send password reset email.',
        code: 'ADMIN_RESET_EMAIL_FAILED',
      });
    }

    return {
      message:
        'If an admin account exists for that email, a reset link has been sent.',
    };
  }

  async resetPassword(token: string, password: string) {
    const key = this.redis.key(`admin-password-reset:${token.trim()}`);
    const userId = await this.redis.getClient().get(key);
    if (!userId) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    const user = await this.usersService.findById(userId);
    if (!user || user.role !== 'admin') {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    await this.usersService.updatePassword(userId, password);
    await this.redis.getClient().del(key);

    return { message: 'Password updated successfully.' };
  }
}
