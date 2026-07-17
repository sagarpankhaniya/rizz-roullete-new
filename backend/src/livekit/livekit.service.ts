import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AccessToken,
  RoomServiceClient,
  type VideoGrant,
} from 'livekit-server-sdk';

/**
 * LivekitService is responsible only for room creation and token generation
 * against the self-hosted LiveKit server.
 *
 * - LIVEKIT_HOST — HTTP(S) API for RoomServiceClient
 * - LIVEKIT_URL  — WebSocket URL handed to browser clients
 */
@Injectable()
export class LivekitService implements OnModuleInit {
  private readonly logger = new Logger(LivekitService.name);
  private roomService!: RoomServiceClient;
  private apiKey!: string;
  private apiSecret!: string;
  private livekitUrl!: string;
  private livekitHost!: string;
  private roomEmptyTimeout!: number;
  private maxParticipants!: number;
  private tokenTtl!: string;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    this.apiKey = this.config.getOrThrow<string>('livekit.apiKey');
    this.apiSecret = this.config.getOrThrow<string>('livekit.apiSecret');
    this.livekitUrl = this.config.getOrThrow<string>('livekit.url');
    this.livekitHost = this.config.getOrThrow<string>('livekit.host');
    this.roomEmptyTimeout =
      this.config.get<number>('livekit.roomEmptyTimeout') ?? 300;
    this.maxParticipants =
      this.config.get<number>('livekit.maxParticipants') ?? 2;
    this.tokenTtl = this.config.get<string>('livekit.tokenTtl') ?? '2h';

    this.roomService = new RoomServiceClient(
      this.livekitHost,
      this.apiKey,
      this.apiSecret,
    );

    this.logger.log(
      `LiveKit configured — host=${this.livekitHost} url=${this.livekitUrl}`,
    );
  }

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
