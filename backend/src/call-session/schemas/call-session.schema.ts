import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CallSessionDocument = HydratedDocument<CallSession>;

export type CallSessionStatus = 'active' | 'ended';

/**
 * Persists matched call sessions for observability / future features.
 * Matching queue itself stays in-memory for this PoC.
 */
@Schema({ timestamps: true, collection: 'call_sessions' })
export class CallSession {
  @Prop({ required: true, unique: true, index: true })
  roomName!: string;

  @Prop({ required: true })
  participantA!: string;

  @Prop({ required: true })
  participantB!: string;

  @Prop({ required: true, enum: ['active', 'ended'], default: 'active' })
  status!: CallSessionStatus;

  @Prop()
  endedAt?: Date;

  @Prop()
  endReason?: string;
}

export const CallSessionSchema = SchemaFactory.createForClass(CallSession);

