import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { User, UserDocument, UserRole } from './schemas/user.schema';
import { hashPassword } from '../common/utils/password.util';

export interface ListUsersQuery {
  page?: number;
  limit?: number;
  search?: string;
  isBanned?: boolean;
  isSubscribed?: boolean;
  isVip?: boolean;
  gender?: string;
  role?: UserRole;
}

export interface PaginatedUsers {
  items: UserDocument[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async findById(id: string): Promise<UserDocument | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return this.userModel.findById(id).exec();
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: email.toLowerCase().trim() }).exec();
  }

  async create(data: {
    firstName: string;
    email: string;
    password: string;
    gender: string;
    interestedIn: string;
    isVip?: boolean;
    creatorInviteId?: string | null;
    role?: UserRole;
    registrationIp?: string | null;
    userAgent?: string | null;
  }): Promise<UserDocument> {
    const passwordHash = await hashPassword(data.password);
    return this.userModel.create({
      firstName: data.firstName.trim(),
      email: data.email.toLowerCase().trim(),
      password: passwordHash,
      gender: data.gender,
      interestedIn: data.interestedIn,
      isVip: Boolean(data.isVip),
      creatorInviteId: data.creatorInviteId ?? null,
      role: data.role ?? 'user',
      registrationIp: data.registrationIp ?? null,
      userAgent: data.userAgent ?? null,
    });
  }

  async createAdmin(data: {
    firstName: string;
    email: string;
    password: string;
  }): Promise<UserDocument> {
    const passwordHash = await hashPassword(data.password);
    return this.userModel.create({
      firstName: data.firstName.trim(),
      email: data.email.toLowerCase().trim(),
      password: passwordHash,
      role: 'admin',
      gender: null,
      interestedIn: null,
    });
  }

  async updatePassword(
    userId: string,
    password: string,
  ): Promise<UserDocument> {
    const passwordHash = await hashPassword(password);
    const user = await this.userModel
      .findByIdAndUpdate(userId, { password: passwordHash }, { new: true })
      .exec();
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateGender(userId: string, gender: string): Promise<UserDocument> {
    const user = await this.userModel
      .findByIdAndUpdate(userId, { gender }, { new: true })
      .exec();
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updatePreference(
    userId: string,
    interestedIn: string,
  ): Promise<UserDocument> {
    const user = await this.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    user.interestedIn = interestedIn;
    await user.save();
    return user;
  }

  async markSubscribed(
    userId: string,
    plan: string,
  ): Promise<UserDocument> {
    const user = await this.userModel
      .findByIdAndUpdate(
        userId,
        {
          isSubscribed: true,
          subscriptionPlan: plan,
          subscribedAt: new Date(),
        },
        { new: true },
      )
      .exec();
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateMatchCountry(
    userId: string,
    matchCountry: string | null,
  ): Promise<UserDocument> {
    const user = await this.userModel
      .findByIdAndUpdate(userId, { matchCountry }, { new: true })
      .exec();
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async banUser(userId: string, reason: string): Promise<UserDocument> {
    const user = await this.userModel
      .findByIdAndUpdate(
        userId,
        {
          isBanned: true,
          banReason: reason,
          bannedAt: new Date(),
        },
        { new: true },
      )
      .exec();
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  /** Ban after gender verification mismatch and align profile gender with detection. */
  async banUserForGenderMismatch(
    userId: string,
    reason: string,
    detectedGender: 'male' | 'female',
  ): Promise<UserDocument> {
    const user = await this.userModel
      .findByIdAndUpdate(
        userId,
        {
          isBanned: true,
          banReason: reason,
          bannedAt: new Date(),
          gender: detectedGender,
        },
        { new: true },
      )
      .exec();
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async unbanUser(userId: string): Promise<UserDocument> {
    const user = await this.userModel
      .findByIdAndUpdate(
        userId,
        {
          isBanned: false,
          banReason: null,
          bannedAt: null,
          // Require a fresh Go.cam check after unban.
          ageVerified: false,
          ageVerifiedAt: null,
          ageVerificationSessionId: null,
        },
        { new: true },
      )
      .exec();
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async markAgeVerified(
    userId: string,
    sessionId?: number | null,
  ): Promise<UserDocument> {
    const user = await this.userModel
      .findByIdAndUpdate(
        userId,
        {
          ageVerified: true,
          ageVerifiedAt: new Date(),
          ...(typeof sessionId === 'number'
            ? { ageVerificationSessionId: sessionId }
            : {}),
        },
        { new: true },
      )
      .exec();
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  /**
   * Adult Go.cam success: persist ageVerified and clear an under-18 age ban
   * from a previous attempt (does not clear gender/other bans).
   */
  async markAgeVerifiedClearingAgeBan(
    userId: string,
    sessionId?: number | null,
  ): Promise<UserDocument> {
    const user = await this.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    const ageBan =
      user.isBanned &&
      typeof user.banReason === 'string' &&
      /age verification|18 or older|under.?18/i.test(user.banReason);

    const userUpdated = await this.userModel
      .findByIdAndUpdate(
        userId,
        {
          ageVerified: true,
          ageVerifiedAt: new Date(),
          ...(typeof sessionId === 'number'
            ? { ageVerificationSessionId: sessionId }
            : {}),
          ...(ageBan
            ? { isBanned: false, banReason: null, bannedAt: null }
            : {}),
        },
        { new: true },
      )
      .exec();
    if (!userUpdated) throw new NotFoundException('User not found');
    return userUpdated;
  }

  async listUsers(query: ListUsersQuery): Promise<PaginatedUsers> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 10));
    const filter: FilterQuery<UserDocument> = {};

    if (query.role) {
      filter.role = query.role;
    } else {
      // Include legacy users that predate the role field.
      filter.role = { $ne: 'admin' };
    }

    if (typeof query.isBanned === 'boolean') {
      filter.isBanned = query.isBanned;
    }
    if (typeof query.isSubscribed === 'boolean') {
      filter.isSubscribed = query.isSubscribed;
    }

    const conditions: FilterQuery<UserDocument>[] = [filter];

    if (typeof query.isVip === 'boolean') {
      if (query.isVip) {
        conditions.push({
          $or: [{ isVip: true }, { creatorInviteId: { $ne: null } }],
        });
      } else {
        conditions.push({ isVip: { $ne: true }, creatorInviteId: null });
      }
    }

    if (query.gender) {
      conditions.push({ gender: query.gender });
    }

    const search = query.search?.trim();
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      conditions.push({
        $or: [
          { firstName: regex },
          { email: regex },
          { country: regex },
          { registrationIp: regex },
        ],
      });
    }

    const finalFilter = conditions.length > 1 ? { $and: conditions } : conditions[0];

    const [items, total] = await Promise.all([
      this.userModel
        .find(finalFilter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.userModel.countDocuments(finalFilter).exec(),
    ]);

    return {
      items,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit) || 1),
    };
  }
}
