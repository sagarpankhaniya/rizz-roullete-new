import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import AvsNodejsSdkV1 = require('./lib/avs-nodejs-sdk-v1');
import { GenderVerificationService } from '../gender-verification/gender-verification.service';
import { UsersService } from '../users/users.service';

const UNDERAGE_BAN_REASON =
  'Account banned: age verification failed. You must be 18 or older.';

const GO_CAM_SUCCESS_STATE = 2;
const GO_CAM_FAILED_STATE = 3;

/**
 * Official SDK fromArray() does parseInt(userId), which truncates Mongo ObjectIds
 * (e.g. "6a6451…" → 6). Prefer userData.userId string; ignore mangled numeric ids.
 */
function extractPayloadUserId(avsSdk: AvsNodejsSdkV1): string | null {
  const data = avsSdk.userData as {
    userId?: unknown;
    accountId?: unknown;
  } | null;

  const candidates = [data?.accountId, data?.userId];
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) {
      const trimmed = value.trim();
      // Prefer full Mongo ObjectIds; skip parseInt()-truncated leftovers.
      if (/^[a-f0-9]{24}$/i.test(trimmed) || trimmed.length > 8) {
        return trimmed;
      }
    }
  }
  return null;
}

export type AgeVerificationStatus = {
  ageVerified: boolean;
  isBanned: boolean;
  banReason: string | null;
};

export type AgeVerificationSession = {
  alreadyVerified: boolean;
  iframeUrl: string | null;
  redirectUrl: string | null;
  goCamBaseUrl: string;
  /** Prefer popup when page is HTTPS and Go.cam is plain HTTP (mixed-content). */
  preferPopup: boolean;
};

@Injectable()
export class AgeVerificationService {
  private readonly logger = new Logger(AgeVerificationService.name);
  private readonly baseUrl: string;
  private readonly publicUrl: string;
  private readonly cipherKey: string;
  private readonly callbackUrl: string;
  private readonly frontendUrl: string;

  constructor(
    config: ConfigService,
    private readonly usersService: UsersService,
    private readonly genderVerification: GenderVerificationService,
  ) {
    this.baseUrl = (
      config.get<string>('goCam.baseUrl') ?? 'http://localhost:3300'
    ).replace(/\/$/, '');
    this.publicUrl = (config.get<string>('goCam.publicUrl') ?? '').replace(
      /\/$/,
      '',
    );
    this.cipherKey =
      config.get<string>('goCam.cipherKey') ??
      'zIkmW2zEgzlTLTRC5xeMbcOhHcE5sBHB';
    this.callbackUrl =
      config.get<string>('goCam.callbackUrl') ??
      'http://localhost:3001/api/age-verification/callback';
    this.frontendUrl = (
      config.get<string>('frontendUrl') ?? 'http://localhost:5173'
    ).replace(/\/$/, '');
  }

  async getStatus(userId: string): Promise<AgeVerificationStatus> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found.');
    }
    return {
      ageVerified: Boolean(user.ageVerified),
      isBanned: Boolean(user.isBanned),
      banReason: user.banReason ?? null,
    };
  }

  async createSession(
    userId: string,
    req: Request,
  ): Promise<AgeVerificationSession> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found.');
    }
    if (user.isBanned) {
      throw new ForbiddenException({
        error: user.banReason ?? 'You are banned.',
        code: 'USER_BANNED',
      });
    }
    if (!(await this.genderVerification.isVerified(userId))) {
      throw new ForbiddenException({
        error: 'Complete camera gender verification before age verification.',
        code: 'GENDER_REQUIRED',
      });
    }
    if (user.ageVerified) {
      const browserBase = this.browserBaseUrl(req);
      return {
        alreadyVerified: true,
        iframeUrl: null,
        redirectUrl: null,
        goCamBaseUrl: browserBase,
        preferPopup: this.shouldPreferPopup(browserBase, req),
      };
    }

    await this.assertGoCamReachable();

    const browserBase = this.browserBaseUrl(req);
    const websiteHostname = this.hostnameFromUrl(this.frontendUrl);
    const userAgent =
      typeof req.headers['user-agent'] === 'string'
        ? req.headers['user-agent']
        : 'Mozilla/5.0';
    const ipStr = this.clientIp(req);

    const avsSdk = new AvsNodejsSdkV1(this.cipherKey);
    avsSdk.fillRequest({
      userData: {
        // Keep as string Mongo id — official SDK parseInt()s top-level userId.
        userId,
        accountId: userId,
      },
      httpParamList: {
        userAgent,
        websiteHostname,
        paramList: {
          showDetectedAgeNumber: false,
          verificationTypeList: ['selfie', 'scanId'],
        },
      },
      verificationVersion: AvsNodejsSdkV1.VERIFICATION_VERSION_IFRAME_V1,
      linkBack: this.frontendUrl,
      callbackUrl: this.callbackUrl,
      ipStr,
    });

    const redirectSdk = new AvsNodejsSdkV1(this.cipherKey);
    redirectSdk.fillRequest({
      userData: {
        userId,
        accountId: userId,
      },
      httpParamList: {
        userAgent,
        websiteHostname,
        paramList: {
          showDetectedAgeNumber: false,
          verificationTypeList: ['selfie', 'scanId'],
        },
      },
      verificationVersion: AvsNodejsSdkV1.VERIFICATION_VERSION_STANDARD_V1,
      linkBack: this.frontendUrl,
      callbackUrl: this.callbackUrl,
      ipStr,
    });

    return {
      alreadyVerified: false,
      iframeUrl: avsSdk.toIframeUrl(browserBase),
      redirectUrl: redirectSdk.toUrl(browserBase),
      goCamBaseUrl: browserBase,
      preferPopup: this.shouldPreferPopup(browserBase, req),
    };
  }

  async handleCallback(body: Record<string, unknown>): Promise<{ ok: true }> {
    const userId = this.extractUserId(body);
    if (!userId) {
      this.logger.warn('Go.cam callback missing userId');
      throw new BadRequestException('Invalid callback payload.');
    }

    const user = await this.usersService.findById(userId);
    if (!user) {
      this.logger.warn(`Go.cam callback for unknown user ${userId}`);
      throw new NotFoundException('User not found.');
    }

    const stateInt = this.toInt(body.stateInt);
    const sessionId = this.toInt(body.sessionId);

    if (stateInt === GO_CAM_SUCCESS_STATE) {
      await this.usersService.markAgeVerifiedClearingAgeBan(userId, sessionId);
      this.logger.log(
        `Age verified for user ${userId} (session ${sessionId ?? 'n/a'})`,
      );
      return { ok: true };
    }

    if (stateInt === GO_CAM_FAILED_STATE) {
      if (!user.isBanned) {
        await this.usersService.banUser(userId, UNDERAGE_BAN_REASON);
        this.logger.warn(
          `Banned user ${userId} after Go.cam age verification failure (under 18)`,
        );
      }
      return { ok: true };
    }

    this.logger.log(
      `Go.cam callback ignored for user ${userId}: stateInt=${String(stateInt)}`,
    );
    return { ok: true };
  }

  async verifyPayloadIntegrity(
    userId: string,
    verificationResultPayload: string,
  ): Promise<{ success: true; sessionId: number | null }> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const avsSdk = new AvsNodejsSdkV1(this.cipherKey);
    const ok = avsSdk.fromPayload(verificationResultPayload);
    if (!ok || avsSdk.verificationResult?.stateInt !== GO_CAM_SUCCESS_STATE) {
      // Still banned for under-18 — surface that clearly.
      if (user.isBanned) {
        throw new ForbiddenException({
          error: user.banReason ?? 'You are banned.',
          code: 'USER_BANNED',
        });
      }
      throw new BadRequestException({
        error: 'Age verification payload integrity check failed.',
        code: 'AGE_PAYLOAD_INVALID',
      });
    }

    const payloadUserId = extractPayloadUserId(avsSdk);
    if (payloadUserId && payloadUserId !== userId) {
      this.logger.warn(
        `Age payload user mismatch: payload=${payloadUserId} jwt=${userId}`,
      );
      throw new ForbiddenException({
        error: 'Payload user mismatch.',
        code: 'AGE_PAYLOAD_MISMATCH',
      });
    }

    // Non-age bans (e.g. gender mismatch) still block the app.
    if (
      user.isBanned &&
      !(
        typeof user.banReason === 'string' &&
        /age verification|18 or older|under.?18/i.test(user.banReason)
      )
    ) {
      throw new ForbiddenException({
        error: user.banReason ?? 'You are banned.',
        code: 'USER_BANNED',
      });
    }

    const sessionId =
      typeof avsSdk.verificationResult?.sessionId === 'number'
        ? avsSdk.verificationResult.sessionId
        : null;

    await this.usersService.markAgeVerifiedClearingAgeBan(userId, sessionId);

    return { success: true, sessionId };
  }

  async isVerified(userId: string): Promise<boolean> {
    const user = await this.usersService.findById(userId);
    return Boolean(user?.ageVerified);
  }

  private async assertGoCamReachable(): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/test`, {
        signal: AbortSignal.timeout(5_000),
      });
      if (!response.ok) {
        throw new Error(`status ${response.status}`);
      }
    } catch (error) {
      this.logger.error(
        `Go.cam unreachable at ${this.baseUrl}: ${(error as Error).message}`,
      );
      throw new ServiceUnavailableException(
        'Age verification service is temporarily unavailable. Start go-cam on port 3300.',
      );
    }
  }

  private extractUserId(body: Record<string, unknown>): string | null {
    const rawUserData = body.userData;
    const readId = (parsed: {
      userId?: unknown;
      accountId?: unknown;
    }): string | null => {
      for (const value of [parsed.accountId, parsed.userId]) {
        if (typeof value === 'string' && value.trim()) {
          const trimmed = value.trim();
          if (/^[a-f0-9]{24}$/i.test(trimmed) || trimmed.length > 8) {
            return trimmed;
          }
        }
      }
      return null;
    };

    if (typeof rawUserData === 'string' && rawUserData.trim()) {
      try {
        return readId(JSON.parse(rawUserData) as {
          userId?: unknown;
          accountId?: unknown;
        });
      } catch {
        // fall through
      }
    }
    if (rawUserData && typeof rawUserData === 'object') {
      return readId(rawUserData as { userId?: unknown; accountId?: unknown });
    }
    return null;
  }

  private toInt(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number.parseInt(value, 10);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }

  private clientIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.trim()) {
      return forwarded.split(',')[0]?.trim() || '127.0.0.1';
    }
    return req.ip || req.socket.remoteAddress || '127.0.0.1';
  }

  private browserBaseUrl(req: Request): string {
    if (this.publicUrl) {
      return this.publicUrl;
    }

    const originHeader =
      typeof req.headers.origin === 'string'
        ? req.headers.origin
        : typeof req.headers.referer === 'string'
          ? (() => {
              try {
                return new URL(req.headers.referer).origin;
              } catch {
                return '';
              }
            })()
          : '';

    // HTTPS frontends cannot embed http://localhost Go.cam (mixed content).
    // Serve Go.cam through the Vite proxy at /go-cam-avs on the same origin.
    if (originHeader.startsWith('https://')) {
      return `${originHeader.replace(/\/$/, '')}/go-cam-avs`;
    }

    return this.baseUrl;
  }

  private shouldPreferPopup(browserBase: string, req: Request): boolean {
    const origin =
      typeof req.headers.origin === 'string' ? req.headers.origin : '';
    if (!origin.startsWith('https://')) {
      return false;
    }
    try {
      return new URL(browserBase).protocol === 'http:';
    } catch {
      return true;
    }
  }

  private hostnameFromUrl(url: string): string {
    try {
      return new URL(url).hostname || 'localhost';
    } catch {
      return 'localhost';
    }
  }
}
