import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PaymentMethodDocument = HydratedDocument<PaymentMethod>;

@Schema({ timestamps: true, collection: 'payment_methods' })
export class PaymentMethod {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  nameOnCard: string;

  /** Stored for demo only — not PCI-safe for production. */
  @Prop({ required: true })
  cardNumber: string;

  @Prop({ required: true })
  cardExpiry: string;

  @Prop({ default: true })
  isDefault: boolean;
}

export const PaymentMethodSchema = SchemaFactory.createForClass(PaymentMethod);
PaymentMethodSchema.index({ userId: 1, isDefault: 1 });
