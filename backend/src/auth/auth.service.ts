import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { UserProfileService } from '../users/user-profile.service';
import { UserDocument } from '../users/schemas/user.schema';
import { verifyPassword } from '../common/utils/password.util';
import { InvitesService } from '../invites/invites.service';
import { MailService } from '../mail/mail.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly userProfileService: UserProfileService,
    private readonly jwtService: JwtService,
    private readonly invitesService: InvitesService,
    private readonly mailService: MailService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
  ) {}

  signToken(user: UserDocument): string {
    return this.jwtService.sign({
      userId: String(user._id),
      email: user.email,
    });
  }

  private assertNotBanned(user: UserDocument): void {
    if (user.isBanned) {
      throw new ForbiddenException({
        error: user.banReason ?? 'You are banned.',
        code: 'USER_BANNED',
      });
    }
  }

  async register(data: {
    firstName: string;
    email: string;
    password: string;
    gender: string;
    interestedIn: string;
    inviteId?: string;
  }) {
    if (data.inviteId) {
      const invite = await this.invitesService.getPendingInvite(data.inviteId);
      if (invite.email !== data.email.toLowerCase().trim()) {
        throw new BadRequestException({
          error: 'Signup email must match the invite email',
        });
      }
    }

    const user = await this.usersService.create({
      firstName: data.firstName,
      email: data.email,
      password: data.password,
      gender: data.gender,
      interestedIn: data.interestedIn,
      isVip: Boolean(data.inviteId),
      creatorInviteId: data.inviteId ?? null,
    });

    if (data.inviteId) {
      try {
        await this.invitesService.consumeInvite(
          data.inviteId,
          data.email,
          String(user._id),
        );
      } catch (err) {
        // Roll back the user if the invite could not be claimed (race / mismatch).
        await user.deleteOne();
        throw err;
      }
    }

    return {
      user: await this.userProfileService.toPublicUser(user),
      token: this.signToken(user),
    };
  }

  async login(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const valid = await verifyPassword(password, user.password);
    if (!valid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    this.assertNotBanned(user);

    return {
      user: await this.userProfileService.toPublicUser(user),
      token: this.signToken(user),
    };
  }

  async getProfile(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    this.assertNotBanned(user);
    return {
      user: await this.userProfileService.toPublicUser(user),
    };
  }

  async requestUnban(email: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user || !user.isBanned) {
      throw new BadRequestException({
        error: 'No banned account found for this email.',
        code: 'UNBAN_NOT_ELIGIBLE',
      });
    }

    const cooldownKey = this.redis.key(`unban-request:${String(user._id)}`);
    const alreadyRequested = await this.redis.getClient().get(cooldownKey);
    if (alreadyRequested) {
      return {
        success: true,
        message:
          'Your unban request was already sent. Please wait for admin review.',
      };
    }

    const adminEmail = (
      this.config.get<string>('mail.adminEmail') ?? 'u8jknkhkh@yopmail.com'
    ).trim();

    try {
      await this.mailService.sendUnbanRequest({
        adminEmail,
        userEmail: user.email,
        userId: String(user._id),
        firstName: user.firstName,
        banReason: user.banReason ?? null,
        bannedAt: user.bannedAt ?? null,
      });
    } catch (error) {
      throw new ServiceUnavailableException({
        error:
          error instanceof Error
            ? error.message
            : 'Failed to send unban request email.',
        code: 'UNBAN_EMAIL_FAILED',
      });
    }

    await this.redis.getClient().set(cooldownKey, '1', 'EX', 60 * 60);

    return {
      success: true,
      message: 'Unban request sent to admin.',
    };
  }
}
