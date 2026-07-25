import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../users/schemas/user.schema';
import {
  CreatorInvite,
  CreatorInviteDocument,
} from '../invites/schemas/creator-invite.schema';

type DayCount = { label: string; count: number };
type NamedCount = { label: string; count: number };

@Injectable()
export class AdminAnalyticsService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(CreatorInvite.name)
    private readonly inviteModel: Model<CreatorInviteDocument>,
  ) {}

  private startOfDay(date: Date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private formatDay(date: Date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private buildDaySeries(days: number, counts: Map<string, number>): DayCount[] {
    const series: DayCount[] = [];
    const today = this.startOfDay(new Date());

    for (let i = days - 1; i >= 0; i -= 1) {
      const day = new Date(today);
      day.setDate(today.getDate() - i);
      const label = this.formatDay(day);
      series.push({ label, count: counts.get(label) ?? 0 });
    }

    return series;
  }

  private async aggregateDailyCounts(
    model: Model<any>,
    match: Record<string, unknown>,
    dateField: string,
    since: Date,
  ) {
    const rows = await model
      .aggregate<{ _id: string; count: number }>([
        { $match: { ...match, [dateField]: { $gte: since } } },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: `$${dateField}` },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ])
      .exec();

    return new Map(rows.map((row) => [row._id, row.count]));
  }

  async getDashboardAnalytics() {
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(now.getDate() - 7);
    const monthAgo = new Date(now);
    monthAgo.setDate(now.getDate() - 30);
    const fourteenDaysAgo = this.startOfDay(new Date(now));
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 13);

    const normalUserFilter = { role: { $ne: 'admin' }, isVip: { $ne: true } };
    const creatorUserFilter = { role: { $ne: 'admin' }, isVip: true };

    const [
      totalUsers,
      activeUsers,
      bannedUsers,
      subscribedUsers,
      newUsersThisWeek,
      newUsersThisMonth,
      totalCreatorInvites,
      invitedCreators,
      acceptedCreators,
      bannedCreators,
      maleUsers,
      femaleUsers,
      userSignupMap,
      creatorInviteMap,
    ] = await Promise.all([
      this.userModel.countDocuments(normalUserFilter).exec(),
      this.userModel
        .countDocuments({ ...normalUserFilter, isBanned: { $ne: true } })
        .exec(),
      this.userModel
        .countDocuments({ ...normalUserFilter, isBanned: true })
        .exec(),
      this.userModel
        .countDocuments({ ...normalUserFilter, isSubscribed: true })
        .exec(),
      this.userModel
        .countDocuments({
          ...normalUserFilter,
          createdAt: { $gte: weekAgo },
        })
        .exec(),
      this.userModel
        .countDocuments({
          ...normalUserFilter,
          createdAt: { $gte: monthAgo },
        })
        .exec(),
      this.inviteModel.countDocuments({}).exec(),
      this.inviteModel
        .countDocuments({ status: { $in: ['invited', 'pending'] } })
        .exec(),
      this.inviteModel
        .countDocuments({ status: { $in: ['accepted', 'used'] } })
        .exec(),
      this.userModel
        .countDocuments({ ...creatorUserFilter, isBanned: true })
        .exec(),
      this.userModel
        .countDocuments({ ...normalUserFilter, gender: 'male' })
        .exec(),
      this.userModel
        .countDocuments({ ...normalUserFilter, gender: 'female' })
        .exec(),
      this.aggregateDailyCounts(
        this.userModel,
        normalUserFilter,
        'createdAt',
        fourteenDaysAgo,
      ),
      this.aggregateDailyCounts(
        this.inviteModel,
        {},
        'createdAt',
        fourteenDaysAgo,
      ),
    ]);

    const unknownGender = Math.max(
      0,
      totalUsers - maleUsers - femaleUsers,
    );

    return {
      summary: {
        totalUsers,
        activeUsers,
        bannedUsers,
        subscribedUsers,
        newUsersThisWeek,
        newUsersThisMonth,
        totalCreators: totalCreatorInvites,
        invitedCreators,
        acceptedCreators,
        bannedCreators,
      },
      charts: {
        userSignups: this.buildDaySeries(14, userSignupMap),
        creatorInvites: this.buildDaySeries(14, creatorInviteMap),
        usersByGender: [
          { label: 'male', count: maleUsers },
          { label: 'female', count: femaleUsers },
          { label: 'unknown', count: unknownGender },
        ] satisfies NamedCount[],
        usersByStatus: [
          { label: 'active', count: activeUsers },
          { label: 'banned', count: bannedUsers },
        ] satisfies NamedCount[],
        creatorsByStatus: [
          { label: 'invited', count: invitedCreators },
          { label: 'accepted', count: acceptedCreators },
        ] satisfies NamedCount[],
      },
    };
  }
}
