import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import {
  CreatorInvite,
  CreatorInviteDocument,
} from './schemas/creator-invite.schema';
import { MailService } from '../mail/mail.service';

@Injectable()
export class InvitesService {
  constructor(
    @InjectModel(CreatorInvite.name)
    private readonly inviteModel: Model<CreatorInviteDocument>,
    private readonly mailService: MailService,
    private readonly config: ConfigService,
  ) {}

  private inviteUrl(inviteId: string): string {
    const base = (
      this.config.get<string>('frontendUrl') ?? 'http://localhost:5173'
    ).replace(/\/$/, '');
    return `${base}/?invite_id=${encodeURIComponent(inviteId)}`;
  }

  async createCreatorInvite(email: string) {
    const normalizedEmail = email.toLowerCase().trim();
    const inviteId = uuidv4();

    const invite = await this.inviteModel.create({
      inviteId,
      email: normalizedEmail,
      status: 'pending',
    });

    const url = this.inviteUrl(invite.inviteId);

    let emailSent = true;
    let emailError: string | null = null;
    try {
      await this.mailService.sendCreatorInvite(normalizedEmail, url);
    } catch (err) {
      emailSent = false;
      emailError =
        err instanceof Error
          ? err.message
          : 'Failed to send invite email';
    }

    return {
      inviteId: invite.inviteId,
      email: invite.email,
      inviteUrl: url,
      status: invite.status,
      emailSent,
      emailError,
    };
  }

  async getPendingInvite(inviteId: string) {
    const invite = await this.inviteModel.findOne({ inviteId }).exec();
    if (!invite) {
      throw new NotFoundException({ error: 'Invite not found' });
    }
    if (invite.status !== 'pending') {
      throw new BadRequestException({
        error: 'This invite has already been used',
      });
    }
    return {
      inviteId: invite.inviteId,
      email: invite.email,
      status: invite.status,
    };
  }

  /**
   * Atomically consume a pending invite for the given email.
   * Returns the invite if claimed; throws if missing, used, or email mismatch.
   */
  async consumeInvite(
    inviteId: string,
    email: string,
    userId: string,
  ): Promise<CreatorInviteDocument> {
    const normalizedEmail = email.toLowerCase().trim();
    const invite = await this.inviteModel
      .findOneAndUpdate(
        {
          inviteId,
          status: 'pending',
          email: normalizedEmail,
        },
        {
          status: 'used',
          usedByUserId: userId,
          usedAt: new Date(),
        },
        { new: true },
      )
      .exec();

    if (!invite) {
      const existing = await this.inviteModel.findOne({ inviteId }).exec();
      if (!existing) {
        throw new BadRequestException({ error: 'Invalid invite' });
      }
      if (existing.status !== 'pending') {
        throw new BadRequestException({
          error: 'This invite has already been used',
        });
      }
      if (existing.email !== normalizedEmail) {
        throw new BadRequestException({
          error: 'Signup email must match the invite email',
        });
      }
      throw new BadRequestException({ error: 'Invalid invite' });
    }

    return invite;
  }
}
