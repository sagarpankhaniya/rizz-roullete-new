import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PageVisit, PageVisitDocument } from './schemas/page-visit.schema';

const DEDUP_WINDOW_MS = 30 * 60 * 1000;

export type RecordVisitInput = {
  sessionId: string;
  path: string;
  referrer?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  userId?: string | null;
};

@Injectable()
export class VisitsService {
  constructor(
    @InjectModel(PageVisit.name)
    private readonly visitModel: Model<PageVisitDocument>,
  ) {}

  async recordVisit(input: RecordVisitInput) {
    const since = new Date(Date.now() - DEDUP_WINDOW_MS);
    const existing = await this.visitModel
      .findOne({
        sessionId: input.sessionId,
        path: input.path,
        createdAt: { $gte: since },
      })
      .select('_id')
      .lean()
      .exec();

    if (existing) {
      return { recorded: false };
    }

    await this.visitModel.create({
      sessionId: input.sessionId,
      path: input.path,
      referrer: input.referrer ?? null,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
      userId: input.userId ?? null,
      source: 'frontend',
    });

    return { recorded: true };
  }

  async countPageViewsSince(since: Date) {
    return this.visitModel.countDocuments({ createdAt: { $gte: since } }).exec();
  }

  private createdAtMatch(since: Date, until?: Date) {
    const range: { $gte: Date; $lte?: Date } = { $gte: since };
    if (until) {
      range.$lte = until;
    }
    return { createdAt: range };
  }

  async countUniqueVisitorsSince(since: Date, until?: Date) {
    const rows = await this.visitModel
      .aggregate<{ count: number }>([
        { $match: this.createdAtMatch(since, until) },
        { $group: { _id: '$sessionId' } },
        { $count: 'count' },
      ])
      .exec();

    return rows[0]?.count ?? 0;
  }

  async aggregateDailyPageViews(since: Date) {
    const rows = await this.visitModel
      .aggregate<{ _id: string; count: number }>([
        { $match: { createdAt: { $gte: since } } },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ])
      .exec();

    return new Map(rows.map((row) => [row._id, row.count]));
  }

  async aggregateDailyUniqueVisitors(since: Date, until?: Date) {
    const rows = await this.visitModel
      .aggregate<{ _id: string; count: number }>([
        { $match: this.createdAtMatch(since, until) },
        {
          $group: {
            _id: {
              day: {
                $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
              },
              sessionId: '$sessionId',
            },
          },
        },
        {
          $group: {
            _id: '$_id.day',
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ])
      .exec();

    return new Map(rows.map((row) => [row._id, row.count]));
  }
}
