import { BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { createAdapter } from '@socket.io/redis-adapter';
import { Server, Socket } from 'socket.io';
import { MatchmakingService } from '../matchmaking/matchmaking.service';
import { parseMatchPrefs } from '../matchmaking/compatibility.util';
import { PresenceService } from '../presence/presence.service';
import { RedisService } from '../redis/redis.service';
import { UsersService } from '../users/users.service';
import { PreferenceQueueService } from '../profile/preference-queue.service';
import { GenderVerificationService } from '../gender-verification/gender-verification.service';
import { AgeVerificationService } from '../age-verification/age-verification.service';
import { CoinsService } from '../coins/coins.service';
import { ChatArchiveService } from '../chat/chat-archive.service';
import { TranslationService } from '../translation/translation.service';
import {
  ChatMessagePayload,
  PartnerLeftPayload,
  SOCKET_EVENTS,
  SendChatPayload,
  SendTipPayload,
  SetChatTranslatePayload,
  StartCallPayload,
  TipReceivedPayload,
} from '../common/types/matching.types';

type SocketUser = {
  userId: string;
  identity: string;
  gender: 'male' | 'female';
  interestedIn: 'male' | 'female' | 'everyone';
  isVip: boolean;
};

/**
 * Thin Socket.IO gateway — connection lifecycle + emit only.
 * Business logic lives in PresenceService / MatchmakingService / LivekitService.
 *
 * Redis adapter enables `server.to(socketId).emit(...)` across NestJS instances.
 * JWT handshake loads gender / interestedIn from Mongo for preference matching.
 */
@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',').map((o) => o.trim()) ?? [
      'http://localhost:5173',
    ],
    credentials: true,
  },
  pingTimeout: parseInt(process.env.SOCKET_PING_TIMEOUT_MS ?? '60000', 10),
  pingInterval: parseInt(process.env.SOCKET_PING_INTERVAL_MS ?? '25000', 10),
})
export class MatchingGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(MatchingGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly matchmaking: MatchmakingService,
    private readonly presence: PresenceService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
    private readonly preferenceQueue: PreferenceQueueService,
    private readonly genderVerification: GenderVerificationService,
    private readonly ageVerification: AgeVerificationService,
    private readonly coinsService: CoinsService,
    private readonly chatArchive: ChatArchiveService,
    private readonly translation: TranslationService,
  ) {}

  afterInit(server: Server) {
    this.matchmaking.setServer(server);

    try {
      const pubClient = this.redis.createClient('socket.io-pub');
      const subClient = pubClient.duplicate();
      server.adapter(createAdapter(pubClient, subClient));
      this.logger.log('Socket.IO Redis adapter attached');
    } catch (error) {
      this.logger.error(
        'Failed to attach Socket.IO Redis adapter',
        (error as Error).stack,
      );
    }

    const origins = this.config.get<string>('corsOrigin') ?? '';
    this.logger.log(`Socket.IO CORS origins: ${origins}`);
  }

  /** Direct socket emit — more reliable than server.to() for the waiting partner on mobile. */
  private emitToSocket(
    socketId: string,
    event: string,
    payload: unknown,
  ): boolean {
    const sock = this.server.sockets.sockets.get(socketId);
    if (sock?.connected) {
      sock.emit(event, payload);
      return true;
    }
    this.server.to(socketId).emit(event, payload);
    return false;
  }

  private deliverMatched(socketId: string, payload: unknown): void {
    this.emitToSocket(socketId, SOCKET_EVENTS.MATCHED, payload);
    // One delayed retry for clients that miss the first emit — no burst (causes UI flicker).
    setTimeout(() => {
      this.emitToSocket(socketId, SOCKET_EVENTS.MATCHED, payload);
    }, 800);
  }

  async handleConnection(client: Socket) {
    try {
      await this.presence.setOnline(client.id);
      const user = await this.resolveSocketUser(client);
      if (user) {
        client.data.user = user;
        await this.presence.updateIdentity(client.id, user.identity);
        await this.presence.setUserSocket(user.userId, client.id);

        const resumed = await this.matchmaking.syncUserToActiveCall(
          user.userId,
          client.id,
        );
        if (resumed) {
          this.emitToSocket(client.id, SOCKET_EVENTS.CALL_RESUMED, resumed);
          this.logger.log(
            `Socket synced into active call: ${client.id} user=${user.userId}`,
          );
          return;
        }

        this.logger.log(
          `Socket connected: ${client.id} user=${user.userId} (${user.gender}→${user.interestedIn})`,
        );
      } else {
        this.logger.log(`Socket connected: ${client.id} (anonymous)`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to mark online ${client.id}`,
        (error as Error).stack,
      );
    }
  }

  async handleDisconnect(client: Socket) {
    this.logger.log(`Socket disconnected: ${client.id}`);
    try {
      const user = client.data.user as SocketUser | undefined;
      if (user?.userId) {
        await this.presence.clearUserSocket(user.userId);
        const graced = await this.matchmaking.beginDisconnectGrace(
          user.userId,
          client.id,
        );
        if (graced) {
          await this.presence.setOffline(client.id);
          this.logger.log(
            `Socket ${client.id} in call grace — deferring partner_left`,
          );
          return;
        }
      }
      await this.notifyPartnerLeft(client.id, 'partner_disconnected');
      await this.presence.setOffline(client.id);
    } catch (error) {
      this.logger.error(
        `Disconnect cleanup failed for ${client.id}`,
        (error as Error).stack,
      );
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.START_CALL)
  async onStartCall(
    @ConnectedSocket() client: Socket,
    @MessageBody() body?: StartCallPayload,
  ) {
    try {
      let socketUser = client.data.user as SocketUser | undefined;
      if (!socketUser?.userId) {
        socketUser = (await this.resolveSocketUser(client)) ?? undefined;
        if (socketUser) {
          client.data.user = socketUser;
        }
      }
      if (!socketUser?.userId) {
        client.emit(SOCKET_EVENTS.ERROR, {
          message: 'Complete camera gender verification before matching.',
        });
        return;
      }

      const dbUser = await this.usersService.findById(socketUser.userId);
      if (!dbUser || dbUser.isBanned) {
        client.emit(SOCKET_EVENTS.ERROR, {
          message: dbUser?.banReason ?? 'You are banned.',
        });
        return;
      }

      if (!(await this.genderVerification.isVerified(socketUser.userId))) {
        client.emit(SOCKET_EVENTS.ERROR, {
          message: 'Complete camera gender verification before matching.',
        });
        return;
      }

      if (!(await this.ageVerification.isVerified(socketUser.userId))) {
        client.emit(SOCKET_EVENTS.ERROR, {
          message: 'Complete age verification (18+) before matching.',
        });
        return;
      }

      const prefs = await this.resolveMatchPrefs(client, body);
      if (!prefs) {
        client.emit(SOCKET_EVENTS.ERROR, {
          message:
            'Gender and interested-in are required. Please register again.',
        });
        return;
      }

      const identity =
        body?.identity?.trim() ||
        (client.data.user as SocketUser | undefined)?.identity ||
        `user-${client.id.slice(0, 8)}`;

      const isVip = Boolean(
        (client.data.user as SocketUser | undefined)?.isVip,
      );
      const userId =
        (client.data.user as SocketUser | undefined)?.userId || '';

      const targetCreatorUserId =
        typeof body?.targetCreatorUserId === 'string'
          ? body.targetCreatorUserId.trim()
          : '';

      const result = await this.matchmaking.enqueueOrMatch({
        socketId: client.id,
        identity,
        gender: prefs.gender,
        interestedIn: prefs.interestedIn,
        isVip,
        userId,
        targetCreatorUserId: targetCreatorUserId || undefined,
      });

      if (result.status === 'waiting') {
        const waitingPayload =
          result.waiting ??
          ({
            message: targetCreatorUserId
              ? 'Waiting for the creator to join their room…'
              : 'Waiting for a matching user…',
          } as const);
        client.emit(SOCKET_EVENTS.WAITING, waitingPayload);

        if (targetCreatorUserId) {
          const creatorSocketId =
            await this.presence.getSocketForUser(targetCreatorUserId);
          if (creatorSocketId) {
            this.server.to(creatorSocketId).emit(
              SOCKET_EVENTS.CREATOR_FAN_WAITING,
              {
                fanIdentity: identity,
                message: `${identity} paid to enter your room — open Match and go live to connect.`,
              },
            );
          }
        }
        return { status: 'waiting' as const, ...waitingPayload };
      }

      const ownMatch = result.matches?.find((m) => m.socketId === client.id);

      for (const match of result.matches ?? []) {
        this.deliverMatched(match.socketId, match.payload);
      }

      return {
        status: 'matched' as const,
        match: ownMatch?.payload ?? null,
      };
    } catch (error) {
      this.logger.error(
        `start_call failed for ${client.id}`,
        (error as Error).stack,
      );
      client.emit(SOCKET_EVENTS.ERROR, {
        message: 'Failed to start call. Please try again.',
      });
      try {
        await this.matchmaking.removeFromQueue(client.id);
        await this.presence.setStatus(client.id, 'online');
      } catch (cleanupError) {
        this.logger.error(
          `start_call cleanup failed for ${client.id}`,
          (cleanupError as Error).stack,
        );
      }
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.SYNC_CALL)
  async onSyncCall(@ConnectedSocket() client: Socket) {
    try {
      let user = client.data.user as SocketUser | undefined;
      if (!user?.userId) {
        user = (await this.resolveSocketUser(client)) ?? undefined;
        if (user) {
          client.data.user = user;
        }
      }
      if (!user?.userId) {
        return { ok: false };
      }

      const resumed = await this.matchmaking.syncUserToActiveCall(
        user.userId,
        client.id,
      );
      if (resumed) {
        this.emitToSocket(client.id, SOCKET_EVENTS.CALL_RESUMED, resumed);
        return { ok: true, synced: true, call: resumed };
      }
      return { ok: true, synced: false };
    } catch (error) {
      this.logger.error(
        `sync_call failed for ${client.id}`,
        (error as Error).stack,
      );
      return { ok: false };
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.LEAVE_CALL)
  async onLeaveCall(@ConnectedSocket() client: Socket) {
    try {
      await this.notifyPartnerLeft(client.id, 'partner_left');
      await this.matchmaking.removeFromQueue(client.id);
      await this.presence.setStatus(client.id, 'online');
      return { ok: true };
    } catch (error) {
      this.logger.error(
        `leave_call failed for ${client.id}`,
        (error as Error).stack,
      );
      client.emit(SOCKET_EVENTS.ERROR, {
        message: 'Failed to leave call cleanly.',
      });
      return { ok: false };
    }
  }

  /** Ephemeral in-call chat — relay to partner; archival is async via Redis queue. */
  @SubscribeMessage(SOCKET_EVENTS.SET_CHAT_TRANSLATE)
  onSetChatTranslate(
    @ConnectedSocket() client: Socket,
    @MessageBody() body?: SetChatTranslatePayload,
  ) {
    const raw = body?.language;
    if (raw === null || raw === undefined || raw === '') {
      client.data.chatTranslateTo = null;
      return { ok: true, enabled: false };
    }

    const normalized = this.translation.normalizeLanguageCode(raw);
    if (!normalized) {
      return { ok: false };
    }

    client.data.chatTranslateTo = normalized;
    return { ok: true, enabled: true, language: normalized };
  }

  /** Ephemeral in-call chat — relay to partner; archival is async via Redis queue. */
  @SubscribeMessage(SOCKET_EVENTS.SEND_CHAT)
  async onSendChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() body?: SendChatPayload,
  ) {
    const text = typeof body?.text === 'string' ? body.text.trim() : '';
    if (!text || text.length > 500) {
      return { ok: false };
    }

    try {
      const call = await this.matchmaking.getActiveCall(client.id);
      if (!call) {
        client.emit(SOCKET_EVENTS.ERROR, {
          message: 'Chat is only available during a match.',
        });
        return { ok: false };
      }

      const isSenderA = call.socketA === client.id;
      const partnerSocketId = isSenderA ? call.socketB : call.socketA;
      const fromIdentity = isSenderA ? call.identityA : call.identityB;
      const recipientIdentity = isSenderA ? call.identityB : call.identityA;
      const senderUserId = isSenderA ? call.userIdA : call.userIdB;
      const recipientUserId = isSenderA ? call.userIdB : call.userIdA;
      const sentAt = Date.now();

      const partnerSocket = this.server.sockets.sockets.get(partnerSocketId);
      const partnerLang = partnerSocket?.data?.chatTranslateTo as
        | string
        | undefined;

      let translatedText: string | undefined;
      let detectedLanguage: string | undefined;

      if (partnerLang) {
        const result = await this.translation.translate(text, partnerLang);
        if (result) {
          translatedText = result.translatedText;
          detectedLanguage = result.detectedLanguage;
        }
      }

      const payload: ChatMessagePayload = {
        text,
        fromIdentity,
        sentAt,
        ...(translatedText ? { translatedText, detectedLanguage } : {}),
      };

      this.server.to(partnerSocketId).emit(SOCKET_EVENTS.CHAT_MESSAGE, payload);

      this.chatArchive.enqueue({
        roomName: call.sessionId,
        senderUserId: senderUserId || null,
        senderIdentity: fromIdentity,
        recipientUserId: recipientUserId || null,
        recipientIdentity,
        text,
        sentAt,
      });

      return { ok: true };
    } catch (error) {
      this.logger.error(
        `send_chat failed for ${client.id}`,
        (error as Error).stack,
      );
      client.emit(SOCKET_EVENTS.ERROR, {
        message: 'Failed to send message.',
      });
      return { ok: false };
    }
  }

  /** Ephemeral in-call tip — relay to partner (no payment yet). */
  @SubscribeMessage(SOCKET_EVENTS.SEND_TIP)
  async onSendTip(
    @ConnectedSocket() client: Socket,
    @MessageBody() body?: SendTipPayload,
  ) {
    const amountRaw =
      typeof body?.amount === 'string' ? body.amount.trim().slice(0, 32) : '';
    const amount = Number.parseInt(amountRaw, 10);
    if (!Number.isFinite(amount) || amount < 1) {
      return { ok: false };
    }

    try {
      const socketUser = client.data.user as SocketUser | undefined;
      if (!socketUser?.userId) {
        client.emit(SOCKET_EVENTS.ERROR, {
          message: 'Sign in to send tips.',
        });
        return { ok: false };
      }

      const call = await this.matchmaking.getActiveCall(client.id);
      if (!call) {
        client.emit(SOCKET_EVENTS.ERROR, {
          message: 'Tips are only available during a match.',
        });
        return { ok: false };
      }

      const partnerUserId =
        call.userIdA === socketUser.userId ? call.userIdB : call.userIdA;
      if (!partnerUserId) {
        client.emit(SOCKET_EVENTS.ERROR, {
          message: 'Cannot tip this partner.',
        });
        return { ok: false };
      }

      const menuItem =
        typeof body?.menuItem === 'string'
          ? body.menuItem.trim().slice(0, 120)
          : '';

      const spendResult = await this.coinsService.sendTip(
        socketUser.userId,
        partnerUserId,
        amount,
        menuItem || undefined,
      );

      const partnerSocketId =
        call.socketA === client.id ? call.socketB : call.socketA;
      const fromIdentity =
        call.socketA === client.id ? call.identityA : call.identityB;

      const payload: TipReceivedPayload = {
        amount: String(amount),
        creatorReceived: String(spendResult.creatorReceived),
        fromIdentity,
        sentAt: Date.now(),
      };

      this.server.to(partnerSocketId).emit(SOCKET_EVENTS.TIP_RECEIVED, payload);
      return { ok: true, newBalance: spendResult.newBalance };
    } catch (error) {
      if (error instanceof BadRequestException) {
        const resp = error.getResponse();
        const message =
          typeof resp === 'object' &&
          resp &&
          'message' in resp &&
          typeof (resp as { message?: string }).message === 'string'
            ? (resp as { message: string }).message
            : 'Insufficient coins';
        client.emit(SOCKET_EVENTS.ERROR, { message });
        return { ok: false };
      }
      this.logger.error(
        `send_tip failed for ${client.id}`,
        (error as Error).stack,
      );
      client.emit(SOCKET_EVENTS.ERROR, {
        message: 'Failed to send tip.',
      });
      return { ok: false };
    }
  }

  /**
   * Prefs priority for live preference changes:
   * 1) start_call body (client just updated)
   * 2) Redis cache (async Mongo may lag)
   * 3) socket JWT cache / Mongo
   */
  private async resolveMatchPrefs(
    client: Socket,
    body?: StartCallPayload,
  ) {
    const fromBody = parseMatchPrefs(body?.gender, body?.interestedIn);
    if (fromBody) {
      const existing = client.data.user as SocketUser | undefined;
      client.data.user = {
        userId: existing?.userId ?? '',
        identity: existing?.identity ?? `user-${client.id.slice(0, 8)}`,
        gender: fromBody.gender,
        interestedIn: fromBody.interestedIn,
        isVip: Boolean(existing?.isVip),
      };
      return fromBody;
    }

    const existing = client.data.user as SocketUser | undefined;
    if (existing?.userId) {
      const cached = await this.preferenceQueue.getCachedPrefs(existing.userId);
      const fromRedis = parseMatchPrefs(
        cached?.gender ?? existing.gender,
        cached?.interestedIn ?? existing.interestedIn,
      );
      if (fromRedis) {
        client.data.user = { ...existing, ...fromRedis };
        return fromRedis;
      }
    }

    if (existing?.gender && existing?.interestedIn) {
      return {
        gender: existing.gender,
        interestedIn: existing.interestedIn,
      };
    }

    const fromAuth = await this.resolveSocketUser(client);
    if (fromAuth) {
      client.data.user = fromAuth;
      return {
        gender: fromAuth.gender,
        interestedIn: fromAuth.interestedIn,
      };
    }

    return null;
  }

  private async resolveSocketUser(
    client: Socket,
  ): Promise<SocketUser | null> {
    const token = this.extractToken(client);
    if (!token) return null;

    try {
      const payload = this.jwtService.verify<{
        userId?: string;
        email?: string;
      }>(token);
      if (!payload.userId) return null;

      const redisPrefs = await this.preferenceQueue.getCachedPrefs(
        payload.userId,
      );
      const user = await this.usersService.findById(payload.userId);
      if (!user) return null;

      const prefs = parseMatchPrefs(
        redisPrefs?.gender ?? user.gender,
        redisPrefs?.interestedIn ?? user.interestedIn,
      );
      if (!prefs) return null;

      return {
        userId: String(user._id),
        identity: user.firstName?.trim() || `user-${String(user._id).slice(-6)}`,
        gender: prefs.gender,
        interestedIn: prefs.interestedIn,
        isVip: Boolean(user.isVip),
      };
    } catch (error) {
      this.logger.warn(
        `JWT resolve failed for ${client.id}: ${(error as Error).message}`,
      );
      return null;
    }
  }

  private extractToken(client: Socket): string | null {
    const auth = client.handshake.auth as { token?: string } | undefined;
    if (auth?.token && typeof auth.token === 'string') {
      return auth.token;
    }
    const header = client.handshake.headers.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      return header.slice(7).trim();
    }
    return null;
  }

  private async notifyPartnerLeft(socketId: string, reason: string) {
    const { partnerSocketId } = await this.matchmaking.handleDisconnect(
      socketId,
      reason,
    );

    if (partnerSocketId) {
      const payload: PartnerLeftPayload = {
        reason:
          reason === 'partner_disconnected'
            ? 'Your partner disconnected.'
            : 'Your partner left the call.',
      };
      this.server.to(partnerSocketId).emit(SOCKET_EVENTS.PARTNER_LEFT, payload);
    }
  }
}
