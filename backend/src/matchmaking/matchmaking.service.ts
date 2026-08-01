import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { LivekitService } from '../livekit/livekit.service';
import { CallSessionService } from '../call-session/call-session.service';
import { PresenceService } from '../presence/presence.service';
import { RedisService } from '../redis/redis.service';
import { RedisKeys } from '../redis/redis.keys';
import { ReportsService } from '../reports/reports.service';
import {
  MatchedPayload,
  WaitingUser,
} from '../common/types/matching.types';
import {
  MatchPrefs,
  candidateBuckets,
  ownBucket,
  usersAreCompatible,
} from './compatibility.util';

export interface ActiveCall {
  roomName: string;
  socketA: string;
  socketB: string;
  identityA: string;
  identityB: string;
}

export interface MatchResult {
  status: 'waiting' | 'matched';
  matches?: Array<{ socketId: string; payload: MatchedPayload }>;
}

export interface EnqueueInput {
  socketId: string;
  identity: string;
  gender: MatchPrefs['gender'];
  interestedIn: MatchPrefs['interestedIn'];
  isVip?: boolean;
  userId?: string;
}

/**
 * Atomically find a compatible partner across preference buckets, or enqueue.
 *
 * KEYS[1..N] = candidate bucket lists (ordered preference)
 * KEYS[N+1]  = own bucket list (enqueue target)
 * ARGV[1]    = my socketId
 * ARGV[2]    = my gender
 * ARGV[3]    = my interestedIn
 * ARGV[4]    = waiting-user key prefix (full Redis prefix + "matchmaking:waiting:")
 * ARGV[5]    = number of candidate bucket keys (N)
 * ARGV[6]    = my userId (may be empty)
 * ARGV[7]    = match-block key prefix (full Redis prefix + "matchmaking:block:")
 *
 * Returns partner socketId, or false if enqueued.
 *
 * For each candidate LPOP'd from a bucket, loads their hash and checks mutual
 * preference. Incompatible / stale entries are discarded (not re-queued) so a
 * later reconnect puts them back with fresh prefs.
 * Report-blocked pairs are skipped (re-queued for others).
 */
const TRY_MATCH_OR_ENQUEUE = `
local mySocketId = ARGV[1]
local myGender = ARGV[2]
local myInterested = ARGV[3]
local metaPrefix = ARGV[4]
local candidateCount = tonumber(ARGV[5])
local myUserId = ARGV[6]
local blockPrefix = ARGV[7]

local function wants(interested, gender)
  if interested == 'everyone' then
    return true
  end
  return interested == gender
end

local function is_blocked(partnerUserId)
  if myUserId == nil or myUserId == '' then
    return false
  end
  if partnerUserId == nil or partnerUserId == '' then
    return false
  end
  return redis.call('SISMEMBER', blockPrefix .. myUserId, partnerUserId) == 1
end

local function try_bucket(queueKey)
  local max = redis.call('LLEN', queueKey)
  local skipped = {}
  for _ = 1, max do
    local partner = redis.call('LPOP', queueKey)
    if not partner then
      break
    end
    if partner == mySocketId then
      -- Stale self-entry; do not re-queue here (we enqueue at the end)
    else
      local metaKey = metaPrefix .. partner
      local meta = redis.call('HMGET', metaKey, 'gender', 'interestedIn', 'userId')
      local pGender = meta[1]
      local pInterested = meta[2]
      local pUserId = meta[3]
      if not pGender or not pInterested then
        redis.call('DEL', metaKey)
      elseif is_blocked(pUserId) then
        table.insert(skipped, partner)
      elseif wants(myInterested, pGender) and wants(pInterested, myGender) then
        for __, sid in ipairs(skipped) do
          redis.call('RPUSH', queueKey, sid)
        end
        return partner
      else
        table.insert(skipped, partner)
      end
    end
  end
  for __, sid in ipairs(skipped) do
    redis.call('RPUSH', queueKey, sid)
  end
  return nil
end

for i = 1, candidateCount do
  local partner = try_bucket(KEYS[i])
  if partner then
    return partner
  end
end

local ownQueue = KEYS[candidateCount + 1]
redis.call('RPUSH', ownQueue, mySocketId)
return false
`;

/**
 * MatchmakingService owns Redis preference-bucket waiting queues + active-call
 * state, and orchestrates LiveKit room/token creation when two users match.
 *
 * Matching rules (from registration):
 * - interestedIn=female → only online females (who also want you / everyone)
 * - interestedIn=male   → only online males
 * - interestedIn=everyone → any gender (mutual)
 * Skip / next = leave_call + start_call → re-enters buckets for next match.
 */
@Injectable()
export class MatchmakingService {
  private readonly logger = new Logger(MatchmakingService.name);
  private io: Server | null = null;

  /** All gender×preference buckets used for queue length / cleanup. */
  private static readonly ALL_BUCKETS = [
    'male:male',
    'male:female',
    'male:everyone',
    'female:male',
    'female:female',
    'female:everyone',
  ] as const;

  constructor(
    private readonly redis: RedisService,
    private readonly presence: PresenceService,
    private readonly livekit: LivekitService,
    private readonly callSessions: CallSessionService,
    private readonly reports: ReportsService,
  ) {}

  /** Wired from MatchingGateway.afterInit so we can reject zombie Redis partners. */
  setServer(server: Server) {
    this.io = server;
  }

  private isSocketConnected(socketId: string): boolean {
    if (!this.io) return true; // fallback until gateway wires server
    return this.io.sockets.sockets.has(socketId);
  }

  async isWaiting(socketId: string): Promise<boolean> {
    const key = this.redis.key(RedisKeys.waitingUser(socketId));
    return (await this.redis.getClient().exists(key)) === 1;
  }

  async isInCall(socketId: string): Promise<boolean> {
    const call = await this.getActiveCall(socketId);
    return call !== null;
  }

  async getActiveCall(socketId: string): Promise<ActiveCall | null> {
    const key = this.redis.key(RedisKeys.activeCall(socketId));
    const raw = await this.redis.getClient().get(key);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as ActiveCall;
    } catch (error) {
      this.logger.error(
        `Corrupt active call data for ${socketId}`,
        (error as Error).stack,
      );
      return null;
    }
  }

  async removeFromQueue(socketId: string): Promise<void> {
    const client = this.redis.getClient();
    const userKey = this.redis.key(RedisKeys.waitingUser(socketId));
    const data = await client.hgetall(userKey);
    const bucket = data?.bucket;

    const pipeline = client.pipeline();
    if (bucket) {
      pipeline.lrem(this.redis.key(RedisKeys.waitingBucket(bucket)), 0, socketId);
    }
    // Legacy blind FIFO cleanup
    pipeline.lrem(this.redis.key(RedisKeys.waitingQueue()), 0, socketId);
    pipeline.del(userKey);
    await pipeline.exec();

    this.logger.log(`Removed ${socketId} from waiting queue`);
  }

  /**
   * Mark online + enqueue into a gender/preference bucket, or match immediately.
   */
  async enqueueOrMatch(input: EnqueueInput): Promise<MatchResult> {
    const {
      socketId,
      identity,
      gender,
      interestedIn,
      isVip = false,
      userId = '',
    } = input;
    const prefs: MatchPrefs = { gender, interestedIn };
    const bucket = ownBucket(prefs);

    if (await this.isWaiting(socketId)) {
      this.logger.warn(`Ignoring duplicate enqueue for ${socketId}`);
      return { status: 'waiting' };
    }

    // Allow rejoin after leave/skip even if active-call keys haven't cleared yet
    if (await this.isInCall(socketId)) {
      this.logger.warn(
        `Clearing stale active call before re-enqueue for ${socketId}`,
      );
      await this.handleDisconnect(socketId, 'requeue');
    }

    await this.presence.updateIdentity(socketId, identity);
    await this.presence.setStatus(socketId, 'waiting');

    const waitingKey = this.redis.key(RedisKeys.waitingUser(socketId));
    const joinedAt = new Date().toISOString();
    await this.redis.getClient().hset(waitingKey, {
      socketId,
      identity,
      gender,
      interestedIn,
      bucket,
      joinedAt,
      isVip: isVip ? '1' : '0',
      userId: userId || '',
    });

    const candidateBucketIds = candidateBuckets(prefs);
    const candidateKeys = candidateBucketIds.map((b) =>
      this.redis.key(RedisKeys.waitingBucket(b)),
    );
    const ownQueueKey = this.redis.key(RedisKeys.waitingBucket(bucket));
    const metaPrefix = this.redis.key('matchmaking:waiting:');
    const blockPrefix = this.redis.key('matchmaking:block:');

    const keys = [...candidateKeys, ownQueueKey];
    const partnerId = (await this.redis
      .getClient()
      .eval(
        TRY_MATCH_OR_ENQUEUE,
        keys.length,
        ...keys,
        socketId,
        gender,
        interestedIn,
        metaPrefix,
        String(candidateKeys.length),
        userId || '',
        blockPrefix,
      )) as string | null;

    if (!partnerId) {
      const size = await this.getQueueLength();
      this.logger.log(
        `User ${identity} (${gender}→${interestedIn}) waiting. Queue size=${size}`,
      );
      return { status: 'waiting' };
    }

    // Matched — clear our waiting metadata (partner hash cleared below)
    await this.redis.getClient().del(waitingKey);

    const partnerMeta = await this.loadWaitingUser(partnerId);
    await this.redis
      .getClient()
      .del(this.redis.key(RedisKeys.waitingUser(partnerId)));

    const partnerStillOnline = await this.presence.isOnline(partnerId);
    const partnerSocketAlive = this.isSocketConnected(partnerId);
    if (!partnerMeta || !partnerStillOnline || !partnerSocketAlive) {
      this.logger.warn(
        `Partner ${partnerId} gone after dequeue (presence=${partnerStillOnline} socket=${partnerSocketAlive}); re-enqueuing ${socketId}`,
      );
      if (partnerId) {
        await this.presence.setOffline(partnerId);
        await this.removeFromQueue(partnerId);
      }
      await this.requeueUser({
        socketId,
        identity,
        gender,
        interestedIn,
        bucket,
        joinedAt: new Date(),
        isVip,
        userId: userId || undefined,
      });
      return { status: 'waiting' };
    }

    // Defense in depth — should already be guaranteed by Lua
    if (
      !usersAreCompatible(prefs, {
        gender: partnerMeta.gender,
        interestedIn: partnerMeta.interestedIn,
      })
    ) {
      this.logger.warn(
        `Incompatible pair after dequeue (${identity} vs ${partnerMeta.identity}); re-queuing both`,
      );
      await this.requeueUser(partnerMeta);
      await this.requeueUser({
        socketId,
        identity,
        gender,
        interestedIn,
        bucket,
        joinedAt: new Date(joinedAt),
        isVip,
        userId: userId || undefined,
      });
      return { status: 'waiting' };
    }

    // Skip partners blocked by a prior misconduct report (either direction)
    if (
      userId &&
      partnerMeta.userId &&
      (await this.reports.isPairBlocked(userId, partnerMeta.userId))
    ) {
      this.logger.log(
        `Skipping reported pair ${identity} ↔ ${partnerMeta.identity}; finding another match`,
      );
      await this.requeueUser(partnerMeta);
      return this.enqueueOrMatch({
        socketId,
        identity,
        gender,
        interestedIn,
        isVip,
        userId,
      });
    }

    try {
      const matches = await this.createMatch(partnerMeta, {
        socketId,
        identity,
        gender,
        interestedIn,
        bucket,
        joinedAt: new Date(joinedAt),
        isVip,
        userId: userId || undefined,
      });
      return { status: 'matched', matches };
    } catch (error) {
      await this.requeueUser(partnerMeta);
      await this.requeueUser({
        socketId,
        identity,
        gender,
        interestedIn,
        bucket,
        joinedAt: new Date(joinedAt),
        isVip,
        userId: userId || undefined,
      });
      this.logger.error(
        `Match failed; re-queued ${partnerMeta.identity} and ${identity}`,
        (error as Error).stack,
      );
      throw error;
    }
  }

  private async loadWaitingUser(
    socketId: string,
  ): Promise<WaitingUser | null> {
    const key = this.redis.key(RedisKeys.waitingUser(socketId));
    const data = await this.redis.getClient().hgetall(key);
    if (!data?.socketId || !data.gender || !data.interestedIn) {
      return null;
    }
    const interestedIn = data.interestedIn as WaitingUser['interestedIn'];
    if (
      data.gender !== 'male' &&
      data.gender !== 'female'
    ) {
      return null;
    }
    if (
      interestedIn !== 'male' &&
      interestedIn !== 'female' &&
      interestedIn !== 'everyone'
    ) {
      return null;
    }
    return {
      socketId: data.socketId,
      identity: data.identity || `user-${socketId.slice(0, 8)}`,
      gender: data.gender,
      interestedIn,
      bucket:
        data.bucket ||
        ownBucket({ gender: data.gender, interestedIn }),
      joinedAt: data.joinedAt ? new Date(data.joinedAt) : new Date(),
      isVip: data.isVip === '1' || data.isVip === 'true',
      userId: data.userId || undefined,
    };
  }

  private async requeueUser(user: WaitingUser): Promise<void> {
    const client = this.redis.getClient();
    const bucket = user.bucket || ownBucket(user);
    const queueKey = this.redis.key(RedisKeys.waitingBucket(bucket));
    const userKey = this.redis.key(RedisKeys.waitingUser(user.socketId));

    await client.lrem(queueKey, 0, user.socketId);
    await client.hset(userKey, {
      socketId: user.socketId,
      identity: user.identity,
      gender: user.gender,
      interestedIn: user.interestedIn,
      bucket,
      joinedAt: user.joinedAt.toISOString(),
      isVip: user.isVip ? '1' : '0',
      userId: user.userId || '',
    });
    await client.rpush(queueKey, user.socketId);
    await this.presence.setStatus(user.socketId, 'waiting');
  }

  private async createMatch(
    userA: WaitingUser,
    userB: WaitingUser,
  ): Promise<Array<{ socketId: string; payload: MatchedPayload }>> {
    const roomName = `call-${uuidv4()}`;

    await this.livekit.createRoom(roomName);

    const [tokenA, tokenB] = await Promise.all([
      this.livekit.createAccessToken(userA.identity, roomName),
      this.livekit.createAccessToken(userB.identity, roomName),
    ]);

    const livekitUrl = this.livekit.getClientUrl();

    const call: ActiveCall = {
      roomName,
      socketA: userA.socketId,
      socketB: userB.socketId,
      identityA: userA.identity,
      identityB: userB.identity,
    };

    await this.storeActiveCall(call);
    await Promise.all([
      this.presence.setStatus(userA.socketId, 'in_call'),
      this.presence.setStatus(userB.socketId, 'in_call'),
    ]);

    void this.callSessions
      .createSession(roomName, userA.identity, userB.identity)
      .catch((err: Error) =>
        this.logger.error(
          `Failed to persist call session ${roomName}: ${err.message}`,
        ),
      );

    this.logger.log(
      `Matched ${userA.identity} (${userA.gender}→${userA.interestedIn}) ↔ ${userB.identity} (${userB.gender}→${userB.interestedIn}) → room ${roomName}`,
    );

    return [
      {
        socketId: userA.socketId,
        payload: {
          roomName,
          livekitUrl,
          token: tokenA,
          identity: userA.identity,
          partnerIdentity: userB.identity,
          partnerIsVip: Boolean(userB.isVip),
          partnerUserId: userB.userId || null,
        },
      },
      {
        socketId: userB.socketId,
        payload: {
          roomName,
          livekitUrl,
          token: tokenB,
          identity: userB.identity,
          partnerIdentity: userA.identity,
          partnerIsVip: Boolean(userA.isVip),
          partnerUserId: userA.userId || null,
        },
      },
    ];
  }

  private async storeActiveCall(call: ActiveCall): Promise<void> {
    const payload = JSON.stringify(call);
    const client = this.redis.getClient();
    const pipeline = client.pipeline();
    pipeline.set(
      this.redis.key(RedisKeys.activeCall(call.socketA)),
      payload,
    );
    pipeline.set(
      this.redis.key(RedisKeys.activeCall(call.socketB)),
      payload,
    );
    await pipeline.exec();
  }

  private async clearActiveCall(call: ActiveCall): Promise<void> {
    const client = this.redis.getClient();
    const pipeline = client.pipeline();
    pipeline.del(this.redis.key(RedisKeys.activeCall(call.socketA)));
    pipeline.del(this.redis.key(RedisKeys.activeCall(call.socketB)));
    await pipeline.exec();
  }

  /**
   * Leave queue and/or end active call.
   * Returns partner socket id when a live call was torn down.
   */
  async handleDisconnect(
    socketId: string,
    reason: string,
  ): Promise<{ partnerSocketId?: string; roomName?: string }> {
    await this.removeFromQueue(socketId);

    const call = await this.getActiveCall(socketId);
    if (!call) {
      return {};
    }

    const partnerSocketId =
      call.socketA === socketId ? call.socketB : call.socketA;

    await this.clearActiveCall(call);

    // Remaining partner goes back to online (can rejoin queue without refresh)
    await this.presence.setStatus(partnerSocketId, 'online');

    try {
      await this.callSessions.endSession(call.roomName, reason);
    } catch (error) {
      this.logger.error(
        `Failed to end call session ${call.roomName}: ${(error as Error).message}`,
      );
    }

    try {
      await this.livekit.deleteRoom(call.roomName);
    } catch (error) {
      this.logger.warn(
        `LiveKit room cleanup failed for ${call.roomName}: ${(error as Error).message}`,
      );
    }

    this.logger.log(
      `Call ${call.roomName} ended (${reason}). Partner=${partnerSocketId}`,
    );

    return { partnerSocketId, roomName: call.roomName };
  }

  async getQueueLength(): Promise<number> {
    const client = this.redis.getClient();
    const pipeline = client.pipeline();
    for (const bucket of MatchmakingService.ALL_BUCKETS) {
      pipeline.llen(this.redis.key(RedisKeys.waitingBucket(bucket)));
    }
    const results = await pipeline.exec();
    if (!results) return 0;
    return results.reduce((sum, [err, len]) => {
      if (err || typeof len !== 'number') return sum;
      return sum + len;
    }, 0);
  }
}
