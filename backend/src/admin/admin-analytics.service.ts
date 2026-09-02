import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../users/schemas/user.schema';
import {
  CreatorInvite,
  CreatorInviteDocument,
} from '../invites/schemas/creator-invite.schema';
import { VisitsService } from '../visits/visits.service';

type DayCount = { label: string; count: number };
type DayVisitorCount = { label: string; visitors: number };
type NamedCount = { label: string; count: number };

@Injectable()
export class AdminAnalyticsService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(CreatorInvite.name)
    private readonly inviteModel: Model<CreatorInviteDocument>,
    private readonly visitsService: VisitsService,
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

  private buildVisitorDaySeries(
    days: number,
    visitors: Map<string, number>,
  ): DayVisitorCount[] {
    const series: DayVisitorCount[] = [];
    const today = this.startOfDay(new Date());

    for (let i = days - 1; i >= 0; i -= 1) {
      const day = new Date(today);
      day.setDate(today.getDate() - i);
      const label = this.formatDay(day);
      series.push({
        label,
        visitors: visitors.get(label) ?? 0,
      });
    }

    return series;
  }

  private buildVisitorRangeSeries(
    from: Date,
    to: Date,
    visitors: Map<string, number>,
  ): DayVisitorCount[] {
    const series: DayVisitorCount[] = [];
    const end = this.startOfDay(to);
    const cursor = this.startOfDay(from);

    while (cursor <= end) {
      const label = this.formatDay(cursor);
      series.push({
        label,
        visitors: visitors.get(label) ?? 0,
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    return series;
  }

  private endOfDay(date: Date) {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
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
    const todayStart = this.startOfDay(now);

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
      visitorsToday,
      visitorsThisWeek,
      dailyVisitorsMap,
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
      this.visitsService.countUniqueVisitorsSince(todayStart),
      this.visitsService.countUniqueVisitorsSince(weekAgo),
      this.visitsService.aggregateDailyUniqueVisitors(fourteenDaysAgo),
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
        visitorsToday,
        visitorsThisWeek,
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
        dailyVisitors: this.buildVisitorDaySeries(14, dailyVisitorsMap),
      },
    };
  }

  async getVisitorAnalytics(input: { from?: Date; to?: Date } = {}) {
    const toDay = input.to ? this.startOfDay(input.to) : this.startOfDay(new Date());
    const fromDay = input.from
      ? this.startOfDay(input.from)
      : (() => {
          const d = new Date(toDay);
          d.setDate(d.getDate() - 29);
          return d;
        })();

    const maxFrom = new Date(toDay);
    maxFrom.setDate(maxFrom.getDate() - 89);
    const safeFrom = fromDay < maxFrom ? maxFrom : fromDay;
    const until = this.endOfDay(toDay);

    const [dailyVisitorsMap, totalUniqueVisitors] = await Promise.all([
      this.visitsService.aggregateDailyUniqueVisitors(safeFrom, until),
      this.visitsService.countUniqueVisitorsSince(safeFrom, until),
    ]);

    return {
      from: this.formatDay(safeFrom),
      to: this.formatDay(toDay),
      totalUniqueVisitors,
      series: this.buildVisitorRangeSeries(safeFrom, toDay, dailyVisitorsMap),
    };
  }
}
