import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UsersService, ListUsersQuery } from '../users/users.service';
import { UserDocument } from '../users/schemas/user.schema';

type ListFilterQuery = Omit<ListUsersQuery, 'isVip' | 'role'>;

@Injectable()
export class AdminUsersService {
  constructor(private readonly usersService: UsersService) {}

  private toAdminUserView(user: UserDocument) {
    const timestamps = user as UserDocument & {
      createdAt?: Date;
      updatedAt?: Date;
    };
    return {
      id: String(user._id),
      firstName: user.firstName,
      email: user.email,
      role: user.role,
      gender: user.gender,
      interestedIn: user.interestedIn,
      country: user.country ?? null,
      matchCountry: user.matchCountry ?? null,
      photo: user.photo ?? null,
      isSubscribed: Boolean(user.isSubscribed),
      subscriptionPlan: user.subscriptionPlan ?? null,
      subscribedAt: user.subscribedAt ?? null,
      isVip: Boolean(user.isVip),
      creatorInviteId: user.creatorInviteId ?? null,
      registrationIp: user.registrationIp ?? null,
      userAgent: user.userAgent ?? null,
      isBanned: Boolean(user.isBanned),
      banReason: user.banReason ?? null,
      bannedAt: user.bannedAt ?? null,
      createdAt: timestamps.createdAt ?? null,
      updatedAt: timestamps.updatedAt ?? null,
    };
  }

  private paginateView(
    result: Awaited<ReturnType<UsersService['listUsers']>>,
  ) {
    return {
      items: result.items.map((u) => this.toAdminUserView(u)),
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: result.totalPages,
    };
  }

  /** Normal users only (excludes admins and creators). */
  async listNormalUsers(query: ListFilterQuery) {
    return this.paginateView(
      await this.usersService.listUsers({ ...query, isVip: false }),
    );
  }

  async getUser(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user || user.role === 'admin' || user.isVip) {
      throw new NotFoundException('User not found');
    }
    return this.toAdminUserView(user);
  }

  async banUser(userId: string, reason?: string) {
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    if (user.role === 'admin') {
      throw new ForbiddenException('Cannot ban an admin account');
    }
    if (user.isBanned) {
      throw new BadRequestException('User is already banned');
    }

    const updated = await this.usersService.banUser(
      userId,
      reason?.trim() || 'Banned by admin',
    );
    return this.toAdminUserView(updated);
  }

  async unbanUser(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    if (user.role === 'admin') {
      throw new ForbiddenException('Cannot unban an admin account');
    }
    if (!user.isBanned) {
      throw new BadRequestException('User is not banned');
    }

    const updated = await this.usersService.unbanUser(userId);
    return this.toAdminUserView(updated);
  }
}
