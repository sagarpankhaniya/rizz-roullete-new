import { Injectable, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { PresenceService } from '../presence/presence.service';
import { UserDocument } from '../users/schemas/user.schema';
import { UsersService } from '../users/users.service';
import { creatorSlug, mapCreator } from './creators.mapper';
import { Creator } from './creators.types';
import { findShowcaseCreator, SHOWCASE_CREATORS } from './showcase-creators';

@Injectable()
export class CreatorsService {
  constructor(
    private readonly usersService: UsersService,
    private readonly presence: PresenceService,
  ) {}

  async isCreatorOnline(creatorUserId: string): Promise<boolean> {
    const socketId = await this.presence.getSocketForUser(creatorUserId);
    if (!socketId) return false;
    return this.presence.isOnline(socketId);
  }

  async listForBrowse(): Promise<{ items: Creator[]; total: number }> {
    const result = await this.usersService.listUsers({
      isVip: true,
      isBanned: false,
      page: 1,
      limit: 100,
    });

    if (result.total > 0) {
      const items = await Promise.all(
        result.items.map((user) => this.mapWithPresence(user)),
      );
      return { items, total: result.total };
    }

    return {
      items: SHOWCASE_CREATORS.map((c) => ({ ...c, isShowcase: true })),
      total: SHOWCASE_CREATORS.length,
    };
  }

  async getByIdOrSlug(id: string): Promise<Creator> {
    const fromDb = await this.resolveDbCreator(id);
    if (fromDb) {
      return this.mapWithPresence(fromDb);
    }

    const showcase = findShowcaseCreator(id);
    if (showcase) {
      return { ...showcase, isShowcase: true };
    }

    throw new NotFoundException('Creator not found');
  }

  /**
   * Resolve a creator for paid room entry.
   * Returns Mongo user id when the creator exists in the database.
   */
  async resolveCreatorUserId(id: string): Promise<string | null> {
    const fromDb = await this.resolveDbCreator(id);
    return fromDb ? String(fromDb._id) : null;
  }

  private async mapWithPresence(user: UserDocument): Promise<Creator> {
    const isOnline = await this.isCreatorOnline(String(user._id));
    return mapCreator(user, isOnline);
  }

  private async resolveDbCreator(id: string): Promise<UserDocument | null> {
    if (Types.ObjectId.isValid(id)) {
      const user = await this.usersService.findById(id);
      if (user && user.isVip && !user.isBanned) {
        return user;
      }
    }

    const result = await this.usersService.listUsers({
      isVip: true,
      isBanned: false,
      page: 1,
      limit: 200,
    });

    return (
      result.items.find((u) => creatorSlug(u.firstName) === id.toLowerCase()) ??
      null
    );
  }
}
