import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { UsersService } from '../users/users.service';
import {
  CoinTransaction,
  CoinTransactionDocument,
  CoinTxType,
} from './schemas/coin-transaction.schema';

type RecordTxInput = {
  type: CoinTxType;
  userId: string;
  amount: number;
  creatorId?: string | null;
  creatorAmount?: number;
  platformAmount?: number;
  balanceAfter?: number | null;
  note?: string | null;
  counterpartyName?: string | null;
};

@Injectable()
export class CoinTransactionsService {
  constructor(
    @InjectModel(CoinTransaction.name)
    private readonly txModel: Model<CoinTransactionDocument>,
    private readonly usersService: UsersService,
  ) {}

  async record(input: RecordTxInput) {
    return this.txModel.create({
      type: input.type,
      userId: new Types.ObjectId(input.userId),
      creatorId: input.creatorId
        ? new Types.ObjectId(input.creatorId)
        : null,
      amount: input.amount,
      creatorAmount: input.creatorAmount ?? 0,
      platformAmount: input.platformAmount ?? 0,
      balanceAfter: input.balanceAfter ?? null,
      note: input.note ?? null,
      counterpartyName: input.counterpartyName ?? null,
    });
  }

  private async hydrateUsers(
    items: CoinTransactionDocument[],
  ) {
    const ids = new Set<string>();
    for (const tx of items) {
      ids.add(String(tx.userId));
      if (tx.creatorId) ids.add(String(tx.creatorId));
    }

    const users = await Promise.all(
      [...ids].map((id) => this.usersService.findById(id)),
    );
    const byId = new Map(
      users.filter(Boolean).map((u) => [String(u!._id), u!]),
    );

    return items.map((tx) => this.toView(tx, byId));
  }

  private toView(
    tx: CoinTransactionDocument,
    users: Map<string, Awaited<ReturnType<UsersService['findById']>>>,
  ) {
    const timestamps = tx as CoinTransactionDocument & {
      createdAt?: Date;
      updatedAt?: Date;
    };
    const fan = users.get(String(tx.userId));
    const creator = tx.creatorId
      ? users.get(String(tx.creatorId))
      : null;

    return {
      id: String(tx._id),
      type: tx.type,
      userId: String(tx.userId),
      creatorId: tx.creatorId ? String(tx.creatorId) : null,
      amount: tx.amount,
      creatorAmount: tx.creatorAmount,
      platformAmount: tx.platformAmount,
      balanceAfter: tx.balanceAfter,
      note: tx.note,
      counterpartyName: tx.counterpartyName,
      createdAt: timestamps.createdAt ?? null,
      user: fan
        ? {
            id: String(fan._id),
            firstName: fan.firstName,
            email: fan.email,
            isVip: Boolean(fan.isVip),
          }
        : null,
      creator: creator
        ? {
            id: String(creator._id),
            firstName: creator.firstName,
            email: creator.email,
            isVip: Boolean(creator.isVip),
          }
        : null,
    };
  }

  async listForUser(userId: string, page = 1, limit = 20) {
    const filter: FilterQuery<CoinTransactionDocument> = {
      userId: new Types.ObjectId(userId),
    };
    return this.paginate(filter, page, limit);
  }

  async listForCreator(creatorId: string, page = 1, limit = 20) {
    const filter: FilterQuery<CoinTransactionDocument> = {
      creatorId: new Types.ObjectId(creatorId),
      creatorAmount: { $gt: 0 },
    };
    return this.paginate(filter, page, limit);
  }

  async listAdmin(query: {
    page?: number;
    limit?: number;
    type?: CoinTxType;
    category?: 'purchases' | 'creator_earnings';
    creatorId?: string;
    userId?: string;
    search?: string;
  }) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const filter: FilterQuery<CoinTransactionDocument> = {};

    if (query.category === 'purchases') {
      filter.type = 'purchase';
    } else if (query.category === 'creator_earnings') {
      filter.type = { $in: ['tip', 'entry_fee'] };
    } else if (query.type) {
      filter.type = query.type;
    }
    if (query.creatorId) {
      filter.creatorId = new Types.ObjectId(query.creatorId);
    }
    if (query.userId) {
      filter.userId = new Types.ObjectId(query.userId);
    }

    if (query.search?.trim()) {
      const term = query.search.trim();
      const usersResult = await this.usersService.listUsers({
        search: term,
        page: 1,
        limit: 20,
      });
      const userIds = usersResult.items.map((u) => u._id);
      if (userIds.length === 0) {
        return { items: [], page, limit, total: 0, totalPages: 0 };
      }
      filter.$or = [
        { userId: { $in: userIds } },
        { creatorId: { $in: userIds } },
      ];
    }

    return this.paginate(filter, page, limit);
  }

  private async paginate(
    filter: FilterQuery<CoinTransactionDocument>,
    page: number,
    limit: number,
  ) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.txModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.txModel.countDocuments(filter),
    ]);

    const views = await this.hydrateUsers(items);
    return {
      items: views,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 0,
    };
  }

  async getCreatorEarningsSummary(creatorId: string) {
    const [agg, recent] = await Promise.all([
      this.txModel.aggregate([
        {
          $match: {
            creatorId: new Types.ObjectId(creatorId),
            creatorAmount: { $gt: 0 },
          },
        },
        {
          $group: {
            _id: '$type',
            total: { $sum: '$creatorAmount' },
            count: { $sum: 1 },
          },
        },
      ]),
      this.txModel
        .find({
          creatorId: new Types.ObjectId(creatorId),
          creatorAmount: { $gt: 0 },
        })
        .sort({ createdAt: -1 })
        .limit(10)
        .exec(),
    ]);

    const byType = Object.fromEntries(
      agg.map((row) => [row._id as string, row.total as number]),
    );
    const tipsTotal = (byType.tip as number) || 0;
    const entryTotal = (byType.entry_fee as number) || 0;
    const totalEarnings = tipsTotal + entryTotal;

    const recentViews = await this.hydrateUsers(recent);

    return {
      totalEarnings,
      tipsTotal,
      entryTotal,
      transactionCount: agg.reduce(
        (sum, row) => sum + (row.count as number),
        0,
      ),
      recent: recentViews,
    };
  }

  async getPlatformSummary() {
    const agg = await this.txModel.aggregate([
      {
        $group: {
          _id: '$type',
          gross: { $sum: '$amount' },
          platform: { $sum: '$platformAmount' },
          creator: { $sum: '$creatorAmount' },
          count: { $sum: 1 },
        },
      },
    ]);

    return {
      byType: agg.map((row) => ({
        type: row._id as string,
        gross: row.gross as number,
        platform: row.platform as number,
        creator: row.creator as number,
        count: row.count as number,
      })),
    };
  }
}
