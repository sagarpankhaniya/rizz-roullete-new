import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CreatorInviteDocument = HydratedDocument<CreatorInvite>;

export type CreatorInviteStatus = 'pending' | 'used';

@Schema({ timestamps: true, collection: 'creator_invites' })
export class CreatorInvite {
  @Prop({ required: true, unique: true, index: true })
  inviteId: string;

  @Prop({ required: true, lowercase: true, trim: true })
  email: string;

  @Prop({
    type: String,
    enum: ['pending', 'used'],
    default: 'pending',
    index: true,
  })
  status: CreatorInviteStatus;

  @Prop({ type: String, default: null })
  usedByUserId: string | null;

  @Prop({ type: Date, default: null })
  usedAt: Date | null;
}

export const CreatorInviteSchema = SchemaFactory.createForClass(CreatorInvite);
