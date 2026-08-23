import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';
import { UsersService } from '../users/users.service';

type BinaryGender = 'male' | 'female';

type AiGenderResponse = {
  faceDetected: boolean;
  multipleFaces?: boolean;
  gender?: BinaryGender;
  confidence?: number;
};

export type GenderVerificationResult = AiGenderResponse & {
  expectedGender: BinaryGender;
  matchesProfile: boolean | null;
  confidenceAccepted: boolean;
  verificationPassed: boolean;
  accountBanned: boolean;
};

const BAN_REASON =
  'Account banned after gender verification mismatch.';

@Injectable()
export class GenderVerificationService {
  private readonly logger = new Logger(GenderVerificationService.name);
  private readonly aiServiceUrl: string;
  private readonly confidenceThreshold: number;

  constructor(
    config: ConfigService,
    private readonly usersService: UsersService,
    private readonly redis: RedisService,
  ) {
    this.aiServiceUrl = (
      config.get<string>('aiService.url') ?? 'http://127.0.0.1:8000'
    ).replace(/\/$/, '');
    this.confidenceThreshold =
      config.get<number>('aiService.genderConfidenceThreshold') ?? 0.6;
  }

  async verify(
    userId: string,
    image: string,
  ): Promise<GenderVerificationResult> {
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
    if (user.gender !== 'male' && user.gender !== 'female') {
      throw new BadRequestException(
        'A male or female profile gender is required for verification.',
      );
    }

    let response: Response;
    try {
      response = await fetch(`${this.aiServiceUrl}/verify-gender`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image }),
        signal: AbortSignal.timeout(20_000),
      });
    } catch (error) {
      this.logger.error(
        `AI gender request failed: ${(error as Error).message}`,
      );
      throw new ServiceUnavailableException(
        'Gender verification is temporarily unavailable.',
      );
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      this.logger.error(
        `AI gender request returned ${response.status}: ${detail.slice(0, 300)}`,
      );
      throw new ServiceUnavailableException(
        'Gender verification is temporarily unavailable.',
      );
    }

    const result = (await response.json()) as AiGenderResponse;
    const canCompare =
      result.faceDetected &&
      !result.multipleFaces &&
      (result.gender === 'male' || result.gender === 'female');
    const matchesProfile = canCompare ? result.gender === user.gender : null;
    const confidenceAccepted =
      typeof result.confidence === 'number' &&
      result.confidence >= this.confidenceThreshold;
    const isConfidentMatch =
      matchesProfile === true && confidenceAccepted;
    const isConfidentMismatch =
      matchesProfile === false && confidenceAccepted;

    const { verificationPassed, accountBanned } =
      await this.recordFrameResult(userId, {
        isConfidentMatch,
        isConfidentMismatch,
        detectedGender:
          isConfidentMismatch &&
          (result.gender === 'male' || result.gender === 'female')
            ? result.gender
            : undefined,
      });

    return {
      faceDetected: Boolean(result.faceDetected),
      ...(result.multipleFaces !== undefined
        ? { multipleFaces: Boolean(result.multipleFaces) }
        : {}),
      ...(result.gender ? { gender: result.gender } : {}),
      ...(typeof result.confidence === 'number'
        ? { confidence: result.confidence }
        : {}),
      expectedGender: user.gender,
      matchesProfile,
      confidenceAccepted,
      verificationPassed,
      accountBanned,
    };
  }

  async isVerified(userId: string): Promise<boolean> {
    const value = await this.redis
      .getClient()
      .get(this.redis.key(`gender-verification:verified:${userId}`));
    return value === '1';
  }

  private async recordFrameResult(
    userId: string,
    outcome: {
      isConfidentMatch: boolean;
      isConfidentMismatch: boolean;
      detectedGender?: BinaryGender;
    },
  ): Promise<{ verificationPassed: boolean; accountBanned: boolean }> {
    const client = this.redis.getClient();
    const progressKey = this.redis.key(
      `gender-verification:progress:${userId}`,
    );
    const mismatchKey = this.redis.key(
      `gender-verification:mismatch:${userId}`,
    );
    const verifiedKey = this.redis.key(
      `gender-verification:verified:${userId}`,
    );

    if (outcome.isConfidentMismatch) {
      await client.del(progressKey, verifiedKey);
      const mismatchCount = await client.incr(mismatchKey);
      await client.expire(mismatchKey, 60);

      if (mismatchCount >= 2) {
        await client.del(mismatchKey);
        if (outcome.detectedGender) {
          await this.usersService.banUserForGenderMismatch(
            userId,
            BAN_REASON,
            outcome.detectedGender,
          );
          this.logger.warn(
            `Banned user ${userId} after gender verification mismatch; profile gender set to ${outcome.detectedGender}`,
          );
        } else {
          await this.usersService.banUser(userId, BAN_REASON);
          this.logger.warn(
            `Banned user ${userId} after gender verification mismatch`,
          );
        }
        return { verificationPassed: false, accountBanned: true };
      }

      return { verificationPassed: false, accountBanned: false };
    }

    if (!outcome.isConfidentMatch) {
      // Keep an existing verified session alive across temporary no-face frames
      // so in-call rechecks do not unlock matchmaking incorrectly.
      await client.del(progressKey);
      const stillVerified = await client.get(verifiedKey);
      return {
        verificationPassed: stillVerified === '1',
        accountBanned: false,
      };
    }

    await client.del(mismatchKey);
    const count = await client.incr(progressKey);
    await client.expire(progressKey, 60);
    if (count < 2) {
      const stillVerified = await client.get(verifiedKey);
      return {
        verificationPassed: stillVerified === '1',
        accountBanned: false,
      };
    }

    await client.set(verifiedKey, '1', 'EX', 30 * 60);
    return { verificationPassed: true, accountBanned: false };
  }
}
