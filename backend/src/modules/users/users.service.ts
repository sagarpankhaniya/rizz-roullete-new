import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, type UserDocument } from '../../database/schemas/user.schema';

export interface PublicUser {
  id: string;
  anonymousId: string;
  displayName?: string;
  authProvider: User['authProvider'];
  isBanned: boolean;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  toPublic(user: UserDocument): PublicUser {
    return {
      id: user.id,
      anonymousId: user.anonymousId,
      displayName: user.displayName,
      authProvider: user.authProvider,
      isBanned: user.isBanned,
    };
  }

  async findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  async findByIdOrThrow(id: string): Promise<UserDocument> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'User not found',
      });
    }
    return user;
  }

  /**
   * Guest bootstrap: reuse the same Mongo user for a stable anonymousId.
   */
  async findOrCreateGuest(anonymousId: string): Promise<UserDocument> {
    const existing = await this.userModel.findOne({ anonymousId }).exec();
    if (existing) {
      existing.lastSeenAt = new Date();
      await existing.save();
      return existing;
    }

    return this.userModel.create({
      anonymousId,
      authProvider: 'guest',
      preferences: {},
      isBanned: false,
      lastSeenAt: new Date(),
    });
  }

  async touchLastSeen(id: string): Promise<void> {
    await this.userModel
      .updateOne({ _id: id }, { $set: { lastSeenAt: new Date() } })
      .exec();
  }
}

