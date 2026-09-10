import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';
import { UsersService } from '../users/users.service';
import { UserProfileService } from '../users/user-profile.service';
import { UserDocument } from '../users/schemas/user.schema';
import { verifyPassword } from '../common/utils/password.util';
import { normalizeGender, normalizeInterestedIn } from '../common/utils/normalize.util';
import { InvitesService } from '../invites/invites.service';
import { MailService } from '../mail/mail.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

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
    registrationIp?: string | null;
    userAgent?: string | null;
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
      registrationIp: data.registrationIp ?? null,
      userAgent: data.userAgent ?? null,
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

    if (user.authProvider === 'google' || !user.password) {
      throw new UnauthorizedException(
        'This account uses Google sign-in. Please continue with Google.',
      );
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

  /**
   * Exchange an OAuth2 authorization code (from the auth-code flow) for an
   * ID token, then delegate to loginWithGoogle for the rest of the logic.
   * This flow supports passkeys, hardware keys, and all Google auth methods
   * because the browser navigates to accounts.google.com directly.
   */
  async loginWithGoogleCode(data: {
    code: string;
    redirectUri: string;
    gender?: string;
    interestedIn?: string;
    inviteId?: string;
    registrationIp?: string | null;
    userAgent?: string | null;
  }) {
    const clientId = this.config.getOrThrow<string>('google.clientId');
    const clientSecret = this.config.getOrThrow<string>('google.clientSecret');

    const client = new OAuth2Client(clientId, clientSecret, data.redirectUri);

    this.logger.log(`[Google Auth] Exchanging auth code — redirectUri=${data.redirectUri} ip=${data.registrationIp ?? 'unknown'}`);

    let idToken: string;
    try {
      const { tokens } = await client.getToken(data.code);
      if (!tokens.id_token) {
        this.logger.error('[Google Auth] Code exchange succeeded but Google returned no id_token');
        throw new UnauthorizedException('Google did not return an ID token');
      }
      idToken = tokens.id_token;
      this.logger.log('[Google Auth] Code exchange successful, verifying ID token');
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      const msg = error instanceof Error ? error.message : String(error);
      // Log the full error including any response body from Google
      const detail = (error as Record<string, unknown>)?.response
        ? JSON.stringify((error as Record<string, unknown>).response)
        : msg;
      this.logger.error(`[Google Auth] Code exchange failed — redirectUri=${data.redirectUri} error=${detail}`);
      throw new UnauthorizedException(`Failed to exchange Google auth code: ${msg}`);
    }

    return this.loginWithGoogle({
      idToken,
      gender: data.gender,
      interestedIn: data.interestedIn,
      inviteId: data.inviteId,
      registrationIp: data.registrationIp,
      userAgent: data.userAgent,
    });
  }

  private verifyGoogleIdToken(idToken: string): Promise<{
    googleId: string;
    email: string;
    firstName: string;
    photo: string | null;
  }> {
    const clientId = this.config.getOrThrow<string>('google.clientId');

    const client = new OAuth2Client(clientId);
    return client
      .verifyIdToken({ idToken, audience: clientId })
      .then((ticket) => {
        const payload = ticket.getPayload();
        if (!payload?.sub || !payload.email) {
          this.logger.error('[Google Auth] ID token payload missing sub or email');
          throw new UnauthorizedException('Google profile missing required fields');
        }
        if (!payload.email_verified) {
          this.logger.warn(`[Google Auth] Email not verified — email=${payload.email}`);
          throw new UnauthorizedException('Google email is not verified');
        }

        const firstName =
          payload.given_name?.trim() ||
          payload.name?.trim().split(/\s+/)[0] ||
          'User';

        this.logger.log(`[Google Auth] ID token verified — email=${payload.email} googleId=${payload.sub}`);

        return {
          googleId: payload.sub,
          email: payload.email,
          firstName,
          photo: payload.picture ?? null,
        };
      })
      .catch((error) => {
        if (
          error instanceof UnauthorizedException ||
          error instanceof ServiceUnavailableException
        ) {
          throw error;
        }
        const msg = error instanceof Error ? error.message : String(error);
        this.logger.error(`[Google Auth] ID token verification failed: ${msg}`);
        throw new UnauthorizedException('Invalid Google sign-in token');
      });
  }

  async loginWithGoogle(data: {
    idToken: string;
    gender?: string;
    interestedIn?: string;
    inviteId?: string;
    registrationIp?: string | null;
    userAgent?: string | null;
  }): Promise<
    | {
        user: Awaited<ReturnType<UserProfileService['toPublicUser']>>;
        token: string;
        isNewUser: false;
      }
    | {
        needsGender: true;
        profile: { firstName: string; email: string };
      }
    | {
        user: Awaited<ReturnType<UserProfileService['toPublicUser']>>;
        token: string;
        isNewUser: true;
      }
  > {
    const googleProfile = await this.verifyGoogleIdToken(data.idToken);

    if (data.inviteId) {
      const invite = await this.invitesService.getPendingInvite(data.inviteId);
      if (invite.email !== googleProfile.email.toLowerCase().trim()) {
        this.logger.warn(`[Google Auth] Invite email mismatch — expected=${invite.email} got=${googleProfile.email}`);
        throw new BadRequestException({
          error: 'Signup email must match the invite email',
        });
      }
    }

    let user =
      (await this.usersService.findByGoogleId(googleProfile.googleId)) ??
      (await this.usersService.findByEmail(googleProfile.email));

    if (user) {
      if (!user.googleId) {
        this.logger.log(`[Google Auth] Linking Google account to existing email user — email=${googleProfile.email}`);
        user = await this.usersService.linkGoogleAccount(
          String(user._id),
          googleProfile.googleId,
        );
      }
      this.assertNotBanned(user);
      this.logger.log(`[Google Auth] Existing user signed in — email=${googleProfile.email} userId=${String(user._id)}`);
      return {
        user: await this.userProfileService.toPublicUser(user),
        token: this.signToken(user),
        isNewUser: false,
      };
    }

    const gender = normalizeGender(data.gender);
    if (!gender) {
      this.logger.log(`[Google Auth] New user needs gender selection — email=${googleProfile.email}`);
      return {
        needsGender: true,
        profile: {
          firstName: googleProfile.firstName,
          email: googleProfile.email,
        },
      };
    }

    const interestedIn =
      normalizeInterestedIn(data.interestedIn) ?? 'everyone';

    this.logger.log(`[Google Auth] Creating new Google user — email=${googleProfile.email} gender=${gender}`);

    user = await this.usersService.createGoogleUser({
      firstName: googleProfile.firstName,
      email: googleProfile.email,
      googleId: googleProfile.googleId,
      gender,
      interestedIn,
      photo: googleProfile.photo,
      isVip: Boolean(data.inviteId),
      creatorInviteId: data.inviteId ?? null,
      registrationIp: data.registrationIp ?? null,
      userAgent: data.userAgent ?? null,
    });

    if (data.inviteId) {
      try {
        await this.invitesService.consumeInvite(
          data.inviteId,
          googleProfile.email,
          String(user._id),
        );
      } catch (err) {
        await user.deleteOne();
        throw err;
      }
    }

    this.logger.log(`[Google Auth] New user created — email=${googleProfile.email} userId=${String(user._id)}`);

    return {
      user: await this.userProfileService.toPublicUser(user),
      token: this.signToken(user),
      isNewUser: true,
    };
  }
}
