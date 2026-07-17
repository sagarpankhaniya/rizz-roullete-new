import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { UserProfileService } from '../users/user-profile.service';
import { UserDocument } from '../users/schemas/user.schema';
import { verifyPassword } from '../common/utils/password.util';
import { InvitesService } from '../invites/invites.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly userProfileService: UserProfileService,
    private readonly jwtService: JwtService,
    private readonly invitesService: InvitesService,
  ) {}

  signToken(user: UserDocument): string {
    return this.jwtService.sign({
      userId: String(user._id),
      email: user.email,
    });
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

    return {
      user: await this.userProfileService.toPublicUser(user),
      token: this.signToken(user),
    };
  }

  async getProfile(userId: string) {
    return {
      user: await this.userProfileService.getPublicUserById(userId),
    };
  }
}

