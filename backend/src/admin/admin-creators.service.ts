import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InvitesService } from '../invites/invites.service';
import { UsersService } from '../users/users.service';
import { UserDocument } from '../users/schemas/user.schema';
import {
  CreatorInviteDocument,
  normalizeCreatorStatus,
} from '../invites/schemas/creator-invite.schema';

@Injectable()
export class AdminCreatorsService {
  constructor(
    private readonly invitesService: InvitesService,
    private readonly usersService: UsersService,
  ) {}

  private toUserView(user: UserDocument) {
    const timestamps = user as UserDocument & {
      createdAt?: Date;
      updatedAt?: Date;
    };
    return {
      id: String(user._id),
      firstName: user.firstName,
      email: user.email,
      gender: user.gender,
      interestedIn: user.interestedIn,
      country: user.country ?? null,
      photo: user.photo ?? null,
      isSubscribed: Boolean(user.isSubscribed),
      subscriptionPlan: user.subscriptionPlan ?? null,
      isVip: Boolean(user.isVip),
      registrationIp: user.registrationIp ?? null,
      userAgent: user.userAgent ?? null,
      isBanned: Boolean(user.isBanned),
      banReason: user.banReason ?? null,
      bannedAt: user.bannedAt ?? null,
      creatorEarnings: user.creatorEarnings ?? 0,
      walletCoins: user.coins ?? 0,
      createdAt: timestamps.createdAt ?? null,
    };
  }

  private async toCreatorView(invite: CreatorInviteDocument) {
    const status = normalizeCreatorStatus(invite.status);
    const timestamps = invite as CreatorInviteDocument & {
      createdAt?: Date;
      updatedAt?: Date;
    };

    let user = null;
    if (status === 'accepted' && invite.usedByUserId) {
      const doc = await this.usersService.findById(invite.usedByUserId);
      if (doc) user = this.toUserView(doc);
    }

    return {
      id: invite.inviteId,
      email: invite.email,
      status,
      inviteUrl: this.invitesService.inviteUrl(invite.inviteId),
      invitedAt: timestamps.createdAt ?? null,
      acceptedAt: invite.usedAt ?? null,
      userId: invite.usedByUserId ?? null,
      user,
    };
  }

  async listCreators(query: {
    page?: number;
    limit?: number;
    search?: string;
    status?: 'invited' | 'accepted';
  }) {
    const result = await this.invitesService.listCreatorInvites({
      page: query.page,
      limit: query.limit,
      search: query.search,
      status: query.status,
    });

    const items = await Promise.all(
      result.items.map((invite) => this.toCreatorView(invite)),
    );

    return {
      items,
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: result.totalPages,
    };
  }

  async getCreator(inviteId: string) {
    const invite = await this.invitesService.findByInviteId(inviteId);
    if (!invite) throw new NotFoundException('Creator invite not found');
    return this.toCreatorView(invite);
  }

  async banCreator(inviteId: string, reason?: string) {
    const invite = await this.invitesService.findByInviteId(inviteId);
    if (!invite) throw new NotFoundException('Creator invite not found');
    if (normalizeCreatorStatus(invite.status) !== 'accepted' || !invite.usedByUserId) {
      throw new BadRequestException(
        'Only accepted creators can be banned',
      );
    }

    const user = await this.usersService.findById(invite.usedByUserId);
    if (!user) throw new NotFoundException('Creator user not found');
    if (user.role === 'admin') {
      throw new ForbiddenException('Cannot ban an admin account');
    }
    if (user.isBanned) {
      throw new BadRequestException('Creator is already banned');
    }

    await this.usersService.banUser(
      invite.usedByUserId,
      reason?.trim() || 'Banned by admin',
    );
    return this.getCreator(inviteId);
  }

  async unbanCreator(inviteId: string) {
    const invite = await this.invitesService.findByInviteId(inviteId);
    if (!invite) throw new NotFoundException('Creator invite not found');
    if (normalizeCreatorStatus(invite.status) !== 'accepted' || !invite.usedByUserId) {
      throw new BadRequestException(
        'Only accepted creators can be unbanned',
      );
    }

    const user = await this.usersService.findById(invite.usedByUserId);
    if (!user) throw new NotFoundException('Creator user not found');
    if (!user.isBanned) {
      throw new BadRequestException('Creator is not banned');
    }

    await this.usersService.unbanUser(invite.usedByUserId);
    return this.getCreator(inviteId);
  }
}
