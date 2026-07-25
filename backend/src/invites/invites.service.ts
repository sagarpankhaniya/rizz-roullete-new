import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { FilterQuery, Model } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import {
  CreatorInvite,
  CreatorInviteDocument,
  CreatorInviteStatus,
  normalizeCreatorStatus,
} from './schemas/creator-invite.schema';
import { MailService } from '../mail/mail.service';

export interface ListCreatorInvitesQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: CreatorInviteStatus;
}

@Injectable()
export class InvitesService {
  constructor(
    @InjectModel(CreatorInvite.name)
    private readonly inviteModel: Model<CreatorInviteDocument>,
    private readonly mailService: MailService,
    private readonly config: ConfigService,
  ) {}

  inviteUrl(inviteId: string): string {
    const base = (
      this.config.get<string>('frontendUrl') ?? 'http://localhost:5173'
    ).replace(/\/$/, '');
    return `${base}/?invite_id=${encodeURIComponent(inviteId)}`;
  }

  private statusFilter(
    status?: CreatorInviteStatus,
  ): FilterQuery<CreatorInviteDocument>['status'] | undefined {
    if (status === 'invited') return { $in: ['invited', 'pending'] };
    if (status === 'accepted') return { $in: ['accepted', 'used'] };
    return undefined;
  }

  async createCreatorInvite(email: string) {
    const normalizedEmail = email.toLowerCase().trim();

    const existingPending = await this.inviteModel
      .findOne({
        email: normalizedEmail,
        status: { $in: ['invited', 'pending'] },
      })
      .exec();
    if (existingPending) {
      throw new BadRequestException({
        error: 'An invite is already pending for this email',
        code: 'INVITE_ALREADY_PENDING',
      });
    }

    const inviteId = uuidv4();
    const invite = await this.inviteModel.create({
      inviteId,
      email: normalizedEmail,
      status: 'invited',
    });

    const url = this.inviteUrl(invite.inviteId);

    let emailSent = true;
    let emailError: string | null = null;
    try {
      await this.mailService.sendCreatorInvite(normalizedEmail, url);
    } catch (err) {
      emailSent = false;
      emailError =
        err instanceof Error ? err.message : 'Failed to send invite email';
    }

    return {
      inviteId: invite.inviteId,
      email: invite.email,
      inviteUrl: url,
      status: normalizeCreatorStatus(invite.status),
      emailSent,
      emailError,
    };
  }

  async getPendingInvite(inviteId: string) {
    const invite = await this.inviteModel.findOne({ inviteId }).exec();
    if (!invite) {
      throw new NotFoundException({ error: 'Invite not found' });
    }
    if (normalizeCreatorStatus(invite.status) !== 'invited') {
      throw new BadRequestException({
        error: 'This invite has already been used',
      });
    }
    return {
      inviteId: invite.inviteId,
      email: invite.email,
      status: 'invited' as const,
    };
  }

  async findByInviteId(inviteId: string): Promise<CreatorInviteDocument | null> {
    return this.inviteModel.findOne({ inviteId }).exec();
  }

  async listCreatorInvites(query: ListCreatorInvitesQuery) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 10));
    const filter: FilterQuery<CreatorInviteDocument> = {};

    const status = this.statusFilter(query.status);
    if (status) filter.status = status;

    const search = query.search?.trim();
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.email = new RegExp(escaped, 'i');
    }

    const [items, total] = await Promise.all([
      this.inviteModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.inviteModel.countDocuments(filter).exec(),
    ]);

    return {
      items,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit) || 1),
    };
  }

  /**
   * Atomically consume a pending invite for the given email.
   * Marks status as accepted.
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
          status: { $in: ['invited', 'pending'] },
          email: normalizedEmail,
        },
        {
          status: 'accepted',
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
      if (normalizeCreatorStatus(existing.status) !== 'invited') {
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
