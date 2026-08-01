import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { FilterQuery, Model, Types } from 'mongoose';
import { MailService } from '../mail/mail.service';
import { RedisService } from '../redis/redis.service';
import { RedisKeys } from '../redis/redis.keys';
import { UsersService } from '../users/users.service';
import { UserDocument } from '../users/schemas/user.schema';
import {
  Report,
  ReportDocument,
  ReportReason,
  ReportStatus,
} from './schemas/report.schema';

const REASON_LABELS: Record<ReportReason, string> = {
  harassment: 'Harassment / bullying',
  inappropriate_content: 'Inappropriate content',
  spam_scam: 'Spam / scam',
  underage: 'Underage concern',
  other: 'Other',
};

@Injectable()
export class ReportsService {
  constructor(
    @InjectModel(Report.name)
    private readonly reportModel: Model<ReportDocument>,
    private readonly usersService: UsersService,
    private readonly mailService: MailService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  private toUserSummary(user: UserDocument | null) {
    if (!user) return null;
    return {
      id: String(user._id),
      firstName: user.firstName,
      email: user.email,
      isVip: Boolean(user.isVip),
      isBanned: Boolean(user.isBanned),
      banReason: user.banReason ?? null,
      photo: user.photo ?? null,
    };
  }

  private toReportView(
    report: ReportDocument,
    reporter?: UserDocument | null,
    reported?: UserDocument | null,
  ) {
    const timestamps = report as ReportDocument & {
      createdAt?: Date;
      updatedAt?: Date;
    };
    return {
      id: String(report._id),
      reporterId: String(report.reporterId),
      reportedUserId: String(report.reportedUserId),
      reporterIdentity: report.reporterIdentity,
      reportedIdentity: report.reportedIdentity,
      roomName: report.roomName,
      reason: report.reason,
      reasonLabel: REASON_LABELS[report.reason] ?? report.reason,
      details: report.details,
      status: report.status,
      adminNotes: report.adminNotes,
      reviewedBy: report.reviewedBy ? String(report.reviewedBy) : null,
      reviewedAt: report.reviewedAt ?? null,
      createdAt: timestamps.createdAt ?? null,
      updatedAt: timestamps.updatedAt ?? null,
      reporter: this.toUserSummary(reporter ?? null),
      reportedUser: this.toUserSummary(reported ?? null),
    };
  }

  async createReport(input: {
    reporterId: string;
    reportedUserId: string;
    reason: ReportReason;
    details?: string;
    roomName?: string;
    reportedIdentity?: string;
  }) {
    if (input.reporterId === input.reportedUserId) {
      throw new BadRequestException({
        error: 'You cannot report yourself.',
        code: 'REPORT_SELF',
      });
    }

    const [reporter, reported] = await Promise.all([
      this.usersService.findById(input.reporterId),
      this.usersService.findById(input.reportedUserId),
    ]);

    if (!reporter) {
      throw new NotFoundException('Reporter not found');
    }
    if (!reported) {
      throw new NotFoundException({
        error: 'Reported user not found.',
        code: 'REPORTED_USER_NOT_FOUND',
      });
    }
    if (reported.role === 'admin') {
      throw new BadRequestException({
        error: 'This account cannot be reported.',
        code: 'REPORT_NOT_ALLOWED',
      });
    }

    const cooldownKey = this.redis.key(
      `report:${input.reporterId}:${input.reportedUserId}`,
    );
    const alreadyReported = await this.redis.getClient().get(cooldownKey);
    if (alreadyReported) {
      await this.blockPair(input.reporterId, input.reportedUserId);
      return {
        success: true,
        alreadySent: true,
        message:
          'You already reported this user recently. An admin will review it.',
      };
    }

    const report = await this.reportModel.create({
      reporterId: new Types.ObjectId(input.reporterId),
      reportedUserId: new Types.ObjectId(input.reportedUserId),
      reporterIdentity: reporter.firstName,
      reportedIdentity:
        input.reportedIdentity?.trim() || reported.firstName || null,
      roomName: input.roomName?.trim() || null,
      reason: input.reason,
      details: input.details?.trim() || null,
      status: 'pending',
    });

    await this.blockPair(input.reporterId, input.reportedUserId);
    await this.redis.getClient().set(cooldownKey, '1', 'EX', 60 * 60);

    const adminEmail = (
      this.config.get<string>('mail.adminEmail') ?? 'u8jknkhkh@yopmail.com'
    ).trim();

    try {
      await this.mailService.sendUserReport({
        adminEmail,
        reportId: String(report._id),
        reason: REASON_LABELS[input.reason] ?? input.reason,
        details: input.details?.trim() || null,
        roomName: input.roomName?.trim() || null,
        reporter: {
          id: String(reporter._id),
          firstName: reporter.firstName,
          email: reporter.email,
        },
        reported: {
          id: String(reported._id),
          firstName: reported.firstName,
          email: reported.email,
          isVip: Boolean(reported.isVip),
        },
      });
    } catch {
      // Report is already stored for admin review; email is best-effort.
    }

    return {
      success: true,
      alreadySent: false,
      message: 'Report sent to admin. Thank you for helping keep Rizz safe.',
      report: this.toReportView(report, reporter, reported),
    };
  }

  /** Permanently prevent these two users from matching again (both directions). */
  async blockPair(userIdA: string, userIdB: string): Promise<void> {
    if (!userIdA || !userIdB || userIdA === userIdB) return;
    const client = this.redis.getClient();
    await client
      .multi()
      .sadd(this.redis.key(RedisKeys.matchBlock(userIdA)), userIdB)
      .sadd(this.redis.key(RedisKeys.matchBlock(userIdB)), userIdA)
      .exec();
  }

  /**
   * True if either user reported the other (Redis set, then Mongo fallback).
   */
  async isPairBlocked(userIdA: string, userIdB: string): Promise<boolean> {
    if (!userIdA || !userIdB || userIdA === userIdB) return false;

    const client = this.redis.getClient();
    const blocked = await client.sismember(
      this.redis.key(RedisKeys.matchBlock(userIdA)),
      userIdB,
    );
    if (blocked === 1) return true;

    const existing = await this.reportModel
      .exists({
        $or: [
          {
            reporterId: new Types.ObjectId(userIdA),
            reportedUserId: new Types.ObjectId(userIdB),
          },
          {
            reporterId: new Types.ObjectId(userIdB),
            reportedUserId: new Types.ObjectId(userIdA),
          },
        ],
      })
      .exec();

    if (existing) {
      await this.blockPair(userIdA, userIdB);
      return true;
    }
    return false;
  }

  async listReports(query: {
    page?: number;
    limit?: number;
    status?: ReportStatus;
    search?: string;
  }) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 10));
    const filter: FilterQuery<ReportDocument> = {};

    if (query.status) {
      filter.status = query.status;
    }

    if (query.search?.trim()) {
      const search = query.search.trim();
      filter.$or = [
        { reporterIdentity: { $regex: search, $options: 'i' } },
        { reportedIdentity: { $regex: search, $options: 'i' } },
        { roomName: { $regex: search, $options: 'i' } },
        { details: { $regex: search, $options: 'i' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.reportModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.reportModel.countDocuments(filter).exec(),
    ]);

    const userIds = new Set<string>();
    for (const item of items) {
      userIds.add(String(item.reporterId));
      userIds.add(String(item.reportedUserId));
    }

    const users = await Promise.all(
      [...userIds].map((id) => this.usersService.findById(id)),
    );
    const userMap = new Map(
      users
        .filter((u): u is UserDocument => Boolean(u))
        .map((u) => [String(u._id), u]),
    );

    return {
      items: items.map((item) =>
        this.toReportView(
          item,
          userMap.get(String(item.reporterId)) ?? null,
          userMap.get(String(item.reportedUserId)) ?? null,
        ),
      ),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async getReport(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Report not found');
    }
    const report = await this.reportModel.findById(id).exec();
    if (!report) throw new NotFoundException('Report not found');

    const [reporter, reported] = await Promise.all([
      this.usersService.findById(String(report.reporterId)),
      this.usersService.findById(String(report.reportedUserId)),
    ]);

    return this.toReportView(report, reporter, reported);
  }

  async dismissReport(
    id: string,
    adminId: string,
    notes?: string,
  ) {
    const report = await this.requirePendingReport(id);
    report.status = 'dismissed';
    report.adminNotes = notes?.trim() || null;
    report.reviewedBy = new Types.ObjectId(adminId);
    report.reviewedAt = new Date();
    await report.save();

    const [reporter, reported] = await Promise.all([
      this.usersService.findById(String(report.reporterId)),
      this.usersService.findById(String(report.reportedUserId)),
    ]);

    return this.toReportView(report, reporter, reported);
  }

  async banFromReport(
    id: string,
    adminId: string,
    options?: { notes?: string; banReason?: string },
  ) {
    const report = await this.requirePendingReport(id);
    const reported = await this.usersService.findById(
      String(report.reportedUserId),
    );
    if (!reported) {
      throw new NotFoundException('Reported user not found');
    }
    if (reported.role === 'admin') {
      throw new ForbiddenException('Cannot ban an admin account');
    }

    const banReason =
      options?.banReason?.trim() ||
      `Banned after user report (${REASON_LABELS[report.reason]})`;

    if (!reported.isBanned) {
      await this.usersService.banUser(String(reported._id), banReason);
    }

    report.status = 'banned';
    report.adminNotes = options?.notes?.trim() || null;
    report.reviewedBy = new Types.ObjectId(adminId);
    report.reviewedAt = new Date();
    await report.save();

    const reporter = await this.usersService.findById(
      String(report.reporterId),
    );
    const refreshedReported = await this.usersService.findById(
      String(report.reportedUserId),
    );

    return this.toReportView(report, reporter, refreshedReported);
  }

  private async requirePendingReport(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Report not found');
    }
    const report = await this.reportModel.findById(id).exec();
    if (!report) throw new NotFoundException('Report not found');
    if (report.status !== 'pending') {
      throw new BadRequestException('Report has already been reviewed');
    }
    return report;
  }
}
