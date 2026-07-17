import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { hashPassword } from '../common/utils/password.util';

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
    });
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
}

