import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ChatMessageDocument = HydratedDocument<ChatMessage>;

@Schema({ timestamps: true, collection: 'chat_messages' })
export class ChatMessage {
  @Prop({ type: String, required: true, index: true })
  roomName: string;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null, index: true })
  senderUserId: Types.ObjectId | null;

  @Prop({ type: String, required: true })
  senderIdentity: string;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null, index: true })
  recipientUserId: Types.ObjectId | null;

  @Prop({ type: String, required: true })
  recipientIdentity: string;

  /** Sorted Mongo user ids — lookup all chats between the same pair. */
  @Prop({ type: String, default: null, index: true })
  participantPairKey: string | null;

  @Prop({ type: String, required: true, maxlength: 500 })
  text: string;

  @Prop({ type: Number, required: true, index: true })
  sentAt: number;
}

export const ChatMessageSchema = SchemaFactory.createForClass(ChatMessage);

ChatMessageSchema.index({ roomName: 1, sentAt: 1 });
ChatMessageSchema.index({ participantPairKey: 1, sentAt: -1 });
ChatMessageSchema.index({ senderUserId: 1, sentAt: -1 });
ChatMessageSchema.index({ recipientUserId: 1, sentAt: -1 });
