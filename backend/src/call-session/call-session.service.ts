import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  CallSession,
  CallSessionDocument,
} from './schemas/call-session.schema';

@Injectable()
export class CallSessionService {
  private readonly logger = new Logger(CallSessionService.name);

  constructor(
    @InjectModel(CallSession.name)
    private readonly callSessionModel: Model<CallSessionDocument>,
  ) {}

  async createSession(
    roomName: string,
    participantA: string,
    participantB: string,
  ): Promise<CallSessionDocument> {
    const session = await this.callSessionModel.create({
      roomName,
      participantA,
      participantB,
      status: 'active',
    });

    this.logger.log(`Persisted call session ${roomName}`);
    return session;
  }

  async endSession(roomName: string, reason: string): Promise<void> {
    await this.callSessionModel.findOneAndUpdate(
      { roomName, status: 'active' },
      {
        status: 'ended',
        endedAt: new Date(),
        endReason: reason,
      },
    );

    this.logger.log(`Ended call session ${roomName} (${reason})`);
  }
}

