import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type Redis from 'ioredis';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { RedisService } from '../redis/redis.service';
import { RedisKeys } from '../redis/redis.keys';
import {
  ChatMessage,
  ChatMessageDocument,
} from './schemas/chat-message.schema';
import { buildParticipantPairKey } from './chat.util';

export type ChatArchiveJob = {
  roomName: string;
  senderUserId: string | null;
  senderIdentity: string;
  recipientUserId: string | null;
  recipientIdentity: string;
  text: string;
  sentAt: number;
};

/**
 * Fire-and-forget chat archival — RPUSH on send, BLPOP worker writes Mongo.
 * The live chat relay never waits on persistence.
 */
@Injectable()
export class ChatArchiveService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ChatArchiveService.name);
  private running = false;
  private worker!: Redis;

  constructor(
    private readonly redis: RedisService,
    @InjectModel(ChatMessage.name)
    private readonly messageModel: Model<ChatMessageDocument>,
  ) {}

  onModuleInit() {
    this.worker = this.redis.createClient('chat-archive');
    this.running = true;
    void this.drainLoop();
  }

  async onModuleDestroy() {
    this.running = false;
    if (this.worker) {
      await this.worker.quit();
    }
  }

  /** Non-blocking — safe to call from the hot send_chat path. */
  enqueue(job: ChatArchiveJob): void {
    const payload = JSON.stringify({
      ...job,
      participantPairKey: buildParticipantPairKey(
        job.senderUserId,
        job.recipientUserId,
      ),
    });
    void this.redis
      .getClient()
      .rpush(this.redis.key(RedisKeys.chatArchiveQueue()), payload)
      .catch((error) => {
        this.logger.warn(
          `Chat archive enqueue failed room=${job.roomName}: ${(error as Error).message}`,
        );
      });
  }

  private async drainLoop() {
    const key = this.redis.key(RedisKeys.chatArchiveQueue());

    while (this.running) {
      try {
        const result = await this.worker.blpop(key, 1);
        if (!result) continue;

        const [, payload] = result;
        const job = JSON.parse(payload) as ChatArchiveJob & {
          participantPairKey?: string | null;
        };

        await this.messageModel.create({
          roomName: job.roomName,
          senderUserId: job.senderUserId
            ? new Types.ObjectId(job.senderUserId)
            : null,
          senderIdentity: job.senderIdentity,
          recipientUserId: job.recipientUserId
            ? new Types.ObjectId(job.recipientUserId)
            : null,
          recipientIdentity: job.recipientIdentity,
          participantPairKey:
            job.participantPairKey ??
            buildParticipantPairKey(job.senderUserId, job.recipientUserId),
          text: job.text,
          sentAt: job.sentAt,
        });
      } catch (error) {
        if (!this.running) break;
        this.logger.error(
          `Chat archive worker error: ${(error as Error).message}`,
        );
        await new Promise((r) => setTimeout(r, 500));
      }
    }
  }
}
