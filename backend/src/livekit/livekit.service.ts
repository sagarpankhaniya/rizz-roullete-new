import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AccessToken,
  RoomServiceClient,
  type VideoGrant,
} from 'livekit-server-sdk';
import { livekitWsUrlToHttpHost } from './livekit-url.util';

/**
 * LivekitService — room lifecycle + participant JWT minting for the
 * self-hosted LiveKit server (no LiveKit Cloud).
 *
 * Configure on the Ubuntu VPS via backend/.env (see .env.example):
 *   LIVEKIT_URL              — WebSocket URL returned to browsers (ws:// or wss://)
 *   LIVEKIT_API_KEY          — must match keys in the LiveKit server config (livekit.yaml)
 *   LIVEKIT_API_SECRET       — must match secrets in the LiveKit server config
 *   LIVEKIT_ROOM_EMPTY_TIMEOUT
 *   LIVEKIT_MAX_PARTICIPANTS
 *   LIVEKIT_TOKEN_TTL
 *
 * RoomServiceClient talks to the same host over HTTP(S), derived from LIVEKIT_URL.
 */
@Injectable()
export class LivekitService implements OnModuleInit {
  private readonly logger = new Logger(LivekitService.name);
  private roomService!: RoomServiceClient;
  private apiKey!: string;
  private apiSecret!: string;
  /** WebSocket URL handed to the frontend (from LIVEKIT_URL). */
  private livekitUrl!: string;
  /** HTTP(S) API base for RoomServiceClient (derived from LIVEKIT_URL). */
  private apiHost!: string;
  private roomEmptyTimeout!: number;
  private maxParticipants!: number;
  private tokenTtl!: string;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    this.apiKey = this.config.getOrThrow<string>('livekit.apiKey');
    this.apiSecret = this.config.getOrThrow<string>('livekit.apiSecret');
    this.livekitUrl = this.config.getOrThrow<string>('livekit.url');
    this.apiHost = livekitWsUrlToHttpHost(this.livekitUrl);
    this.roomEmptyTimeout =
      this.config.get<number>('livekit.roomEmptyTimeout') ?? 300;
    this.maxParticipants =
      this.config.get<number>('livekit.maxParticipants') ?? 2;
    this.tokenTtl = this.config.get<string>('livekit.tokenTtl') ?? '2h';

    this.roomService = new RoomServiceClient(
      this.apiHost,
      this.apiKey,
      this.apiSecret,
    );

    this.logger.log(
      `Self-hosted LiveKit ready — clientUrl=${this.livekitUrl} apiHost=${this.apiHost}`,
    );
  }

  /** Client WebSocket URL — included in the `matched` Socket.IO payload. */
  getClientUrl(): string {
    return this.livekitUrl;
  }

  async createRoom(roomName: string): Promise<void> {
    try {
      await this.roomService.createRoom({
        name: roomName,
        emptyTimeout: this.roomEmptyTimeout,
        maxParticipants: this.maxParticipants,
      });
      this.logger.log(`Created LiveKit room: ${roomName}`);
    } catch (error) {
      this.logger.error(
        `Failed to create LiveKit room ${roomName}: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw error;
    }
  }

  /**
   * Mints a participant JWT signed with the self-hosted API key/secret.
   * Valid against any LiveKit server that shares those credentials.
   */
  async createAccessToken(
    identity: string,
    roomName: string,
  ): Promise<string> {
    try {
      const at = new AccessToken(this.apiKey, this.apiSecret, {
        identity,
        name: identity,
        ttl: this.tokenTtl,
      });

      const grant: VideoGrant = {
        roomJoin: true,
        room: roomName,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
      };
      at.addGrant(grant);

      const token = await at.toJwt();
      this.logger.debug(
        `Issued LiveKit token for identity=${identity} room=${roomName}`,
      );
      return token;
    } catch (error) {
      this.logger.error(
        `Failed to issue token for ${identity} / ${roomName}: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw error;
    }
  }

  async deleteRoom(roomName: string): Promise<void> {
    try {
      await this.roomService.deleteRoom(roomName);
      this.logger.log(`Deleted LiveKit room: ${roomName}`);
    } catch (error) {
      this.logger.warn(
        `Failed to delete room ${roomName}: ${(error as Error).message}`,
      );
    }
  }
}
