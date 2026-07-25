import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CreatorInviteDocument = HydratedDocument<CreatorInvite>;

/** Public/admin-facing status. Legacy DB values: pending → invited, used → accepted. */
export type CreatorInviteStatus = 'invited' | 'accepted';

@Schema({ timestamps: true, collection: 'creator_invites' })
export class CreatorInvite {
  @Prop({ required: true, unique: true, index: true })
  inviteId: string;

  @Prop({ required: true, lowercase: true, trim: true, index: true })
  email: string;

  @Prop({
    type: String,
    enum: ['invited', 'accepted', 'pending', 'used'],
    default: 'invited',
    index: true,
  })
  status: CreatorInviteStatus | 'pending' | 'used';

  @Prop({ type: String, default: null })
  usedByUserId: string | null;

  @Prop({ type: Date, default: null })
  usedAt: Date | null;
}

export const CreatorInviteSchema = SchemaFactory.createForClass(CreatorInvite);

export function normalizeCreatorStatus(
  status: string | null | undefined,
): CreatorInviteStatus {
  if (status === 'accepted' || status === 'used') return 'accepted';
  return 'invited';
}
