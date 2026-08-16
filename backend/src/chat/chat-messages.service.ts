import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { UsersService } from '../users/users.service';
import {
  ChatMessage,
  ChatMessageDocument,
} from './schemas/chat-message.schema';
import { buildParticipantPairKey } from './chat.util';

@Injectable()
export class ChatMessagesService {
  constructor(
    @InjectModel(ChatMessage.name)
    private readonly messageModel: Model<ChatMessageDocument>,
    private readonly usersService: UsersService,
  ) {}

  async listConversations(query: {
    page?: number;
    limit?: number;
    userId?: string;
    userIdA?: string;
    userIdB?: string;
    roomName?: string;
    search?: string;
    from?: string;
    to?: string;
  }) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const skip = (page - 1) * limit;
    const match = await this.buildMatchFilter(query);

    const [rows, countAgg] = await Promise.all([
      this.messageModel.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$roomName',
            messageCount: { $sum: 1 },
            firstSentAt: { $min: '$sentAt' },
            lastSentAt: { $max: '$sentAt' },
            lastText: { $last: '$text' },
            lastSenderIdentity: { $last: '$senderIdentity' },
            participantPairKey: { $first: '$participantPairKey' },
            senderUserId: { $first: '$senderUserId' },
            recipientUserId: { $first: '$recipientUserId' },
            senderIdentity: { $first: '$senderIdentity' },
            recipientIdentity: { $first: '$recipientIdentity' },
          },
        },
        { $sort: { lastSentAt: -1 } },
        { $skip: skip },
        { $limit: limit },
      ]),
      this.messageModel.aggregate([
        { $match: match },
        { $group: { _id: '$roomName' } },
        { $count: 'total' },
      ]),
    ]);

    const total = countAgg[0]?.total ?? 0;
    const items = await this.hydrateConversations(rows);

    return {
      items,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 0,
    };
  }

  async listMessages(query: {
    page?: number;
    limit?: number;
    roomName?: string;
    userIdA?: string;
    userIdB?: string;
    userId?: string;
    from?: string;
    to?: string;
  }) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(200, Math.max(1, query.limit ?? 50));
    const filter = await this.buildMessageFilter(query);

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.messageModel
        .find(filter)
        .sort({ sentAt: 1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.messageModel.countDocuments(filter),
    ]);

    const views = await this.hydrateMessages(items);
    return {
      items: views,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 0,
    };
  }

  private async buildMatchFilter(query: {
    userId?: string;
    userIdA?: string;
    userIdB?: string;
    roomName?: string;
    search?: string;
    from?: string;
    to?: string;
  }) {
    const match: Record<string, unknown> = {};

    if (query.roomName?.trim()) {
      match.roomName = query.roomName.trim();
    }

    if (query.userIdA && query.userIdB) {
      const pairKey = buildParticipantPairKey(query.userIdA, query.userIdB);
      if (pairKey) match.participantPairKey = pairKey;
    } else if (query.userId) {
      const oid = new Types.ObjectId(query.userId);
      match.$or = [{ senderUserId: oid }, { recipientUserId: oid }];
    }

    if (query.search?.trim()) {
      const usersResult = await this.usersService.listUsers({
        search: query.search.trim(),
        page: 1,
        limit: 20,
      });
      const userIds = usersResult.items.map((u) => u._id);
      if (userIds.length === 0) {
        match._id = { $exists: false };
      } else {
        match.$or = [
          { senderUserId: { $in: userIds } },
          { recipientUserId: { $in: userIds } },
        ];
      }
    }

    const sentAt = this.sentAtRange(query.from, query.to);
    if (sentAt) match.sentAt = sentAt;

    return match;
  }

  private async buildMessageFilter(query: {
    roomName?: string;
    userIdA?: string;
    userIdB?: string;
    userId?: string;
    from?: string;
    to?: string;
  }) {
    const filter: FilterQuery<ChatMessageDocument> = {};

    if (query.roomName?.trim()) {
      filter.roomName = query.roomName.trim();
    } else if (query.userIdA && query.userIdB) {
      const pairKey = buildParticipantPairKey(query.userIdA, query.userIdB);
      if (pairKey) filter.participantPairKey = pairKey;
    } else if (query.userId) {
      const oid = new Types.ObjectId(query.userId);
      filter.$or = [{ senderUserId: oid }, { recipientUserId: oid }];
    }

    const sentAt = this.sentAtRange(query.from, query.to);
    if (sentAt) filter.sentAt = sentAt;

    return filter;
  }

  private sentAtRange(from?: string, to?: string) {
    const range: Record<string, number> = {};
    if (from) {
      const ms = Date.parse(from);
      if (!Number.isNaN(ms)) range.$gte = ms;
    }
    if (to) {
      const ms = Date.parse(to);
      if (!Number.isNaN(ms)) range.$lte = ms;
    }
    return Object.keys(range).length > 0 ? range : null;
  }

  private async hydrateConversations(
    rows: Array<{
      _id: string;
      messageCount: number;
      firstSentAt: number;
      lastSentAt: number;
      lastText: string;
      lastSenderIdentity: string;
      participantPairKey: string | null;
      senderUserId: Types.ObjectId | null;
      recipientUserId: Types.ObjectId | null;
      senderIdentity: string;
      recipientIdentity: string;
    }>,
  ) {
    const userIds = new Set<string>();
    for (const row of rows) {
      if (row.senderUserId) userIds.add(String(row.senderUserId));
      if (row.recipientUserId) userIds.add(String(row.recipientUserId));
    }

    const users = await Promise.all(
      [...userIds].map((id) => this.usersService.findById(id)),
    );
    const byId = new Map(
      users.filter(Boolean).map((u) => [String(u!._id), u!]),
    );

    return rows.map((row) => {
      const sender = row.senderUserId
        ? byId.get(String(row.senderUserId))
        : null;
      const recipient = row.recipientUserId
        ? byId.get(String(row.recipientUserId))
        : null;

      return {
        roomName: row._id,
        messageCount: row.messageCount,
        firstSentAt: row.firstSentAt,
        lastSentAt: row.lastSentAt,
        lastMessage: {
          text: row.lastText,
          senderIdentity: row.lastSenderIdentity,
        },
        participantPairKey: row.participantPairKey,
        senderIdentity: row.senderIdentity,
        recipientIdentity: row.recipientIdentity,
        sender: sender
          ? {
              id: String(sender._id),
              firstName: sender.firstName,
              email: sender.email,
              isVip: Boolean(sender.isVip),
            }
          : null,
        recipient: recipient
          ? {
              id: String(recipient._id),
              firstName: recipient.firstName,
              email: recipient.email,
              isVip: Boolean(recipient.isVip),
            }
          : null,
      };
    });
  }

  private async hydrateMessages(items: ChatMessageDocument[]) {
    const userIds = new Set<string>();
    for (const msg of items) {
      if (msg.senderUserId) userIds.add(String(msg.senderUserId));
      if (msg.recipientUserId) userIds.add(String(msg.recipientUserId));
    }

    const users = await Promise.all(
      [...userIds].map((id) => this.usersService.findById(id)),
    );
    const byId = new Map(
      users.filter(Boolean).map((u) => [String(u!._id), u!]),
    );

    return items.map((msg) => {
      const sender = msg.senderUserId
        ? byId.get(String(msg.senderUserId))
        : null;
      const recipient = msg.recipientUserId
        ? byId.get(String(msg.recipientUserId))
        : null;

      return {
        id: String(msg._id),
        roomName: msg.roomName,
        text: msg.text,
        sentAt: msg.sentAt,
        senderIdentity: msg.senderIdentity,
        recipientIdentity: msg.recipientIdentity,
        senderUserId: msg.senderUserId ? String(msg.senderUserId) : null,
        recipientUserId: msg.recipientUserId
          ? String(msg.recipientUserId)
          : null,
        sender: sender
          ? {
              id: String(sender._id),
              firstName: sender.firstName,
              email: sender.email,
              isVip: Boolean(sender.isVip),
            }
          : null,
        recipient: recipient
          ? {
              id: String(recipient._id),
              firstName: recipient.firstName,
              email: recipient.email,
              isVip: Boolean(recipient.isVip),
            }
          : null,
      };
    });
  }
}
