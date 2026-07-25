import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserRole = 'user' | 'admin';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true, collection: 'users' })
export class User {
  @Prop({ required: true, trim: true })
  firstName: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop({ type: String, enum: ['user', 'admin'], default: 'user', index: true })
  role: UserRole;

  @Prop({ type: String, enum: ['male', 'female'], default: null })
  gender: string | null;

  @Prop({
    type: String,
    enum: ['male', 'female', 'everyone', 'couple', 'other'],
    default: null,
  })
  interestedIn: string | null;

  @Prop({ type: String, default: null })
  country: string | null;

  @Prop({ type: String, default: null })
  matchCountry: string | null;

  @Prop({ type: String, default: null })
  photo: string | null;

  /** Set true after mock subscribe (no Stripe). */
  @Prop({ type: Boolean, default: false })
  isSubscribed: boolean;

  @Prop({ type: String, default: null })
  subscriptionPlan: string | null;

  @Prop({ type: Date, default: null })
  subscribedAt: Date | null;

  /** Granted when signing up via a one-time creator invite. */
  @Prop({ type: Boolean, default: false })
  isVip: boolean;

  @Prop({ type: String, default: null })
  creatorInviteId: string | null;

  /** Captured at registration time. */
  @Prop({ type: String, default: null })
  registrationIp: string | null;

  /** Captured at registration time. */
  @Prop({ type: String, default: null })
  userAgent: string | null;

  /** Set after repeated confident gender-verification mismatches. */
  @Prop({ type: Boolean, default: false, index: true })
  isBanned: boolean;

  @Prop({ type: String, default: null })
  banReason: string | null;

  @Prop({ type: Date, default: null })
  bannedAt: Date | null;
}

export const UserSchema = SchemaFactory.createForClass(User);

