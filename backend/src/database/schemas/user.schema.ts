import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AuthProvider = 'guest' | 'google';

export type UserDocument = HydratedDocument<User>;

@Schema({
  timestamps: true,
  collection: 'users',
})
export class User {
  @Prop({ required: true, unique: true, index: true })
  anonymousId!: string;

  @Prop()
  displayName?: string;

  @Prop({ required: true, enum: ['guest', 'google'], default: 'guest' })
  authProvider!: AuthProvider;

  @Prop({ sparse: true, unique: true })
  googleId?: string;

  @Prop({ type: Object, default: {} })
  preferences!: Record<string, unknown>;

  @Prop({ default: false })
  isBanned!: boolean;

  @Prop()
  banReason?: string;

  @Prop({ type: Date, default: () => new Date() })
  lastSeenAt!: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

