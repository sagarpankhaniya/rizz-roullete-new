import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export const COIN_TX_TYPES = ['purchase', 'entry_fee', 'tip'] as const;
export type CoinTxType = (typeof COIN_TX_TYPES)[number];

export type CoinTransactionDocument = HydratedDocument<CoinTransaction>;

@Schema({ timestamps: true, collection: 'coin_transactions' })
export class CoinTransaction {
  @Prop({ type: String, enum: COIN_TX_TYPES, required: true, index: true })
  type: CoinTxType;

  /** Fan who bought or spent coins */
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  /** Creator who earned from this event, if any */
  @Prop({ type: Types.ObjectId, ref: 'User', default: null, index: true })
  creatorId: Types.ObjectId | null;

  /** Gross coins moved from the fan wallet */
  @Prop({ type: Number, required: true })
  amount: number;

  @Prop({ type: Number, default: 0 })
  creatorAmount: number;

  @Prop({ type: Number, default: 0 })
  platformAmount: number;

  @Prop({ type: Number, default: null })
  balanceAfter: number | null;

  @Prop({ type: String, default: null, maxlength: 200 })
  note: string | null;

  @Prop({ type: String, default: null, maxlength: 120 })
  counterpartyName: string | null;
}

export const CoinTransactionSchema =
  SchemaFactory.createForClass(CoinTransaction);

CoinTransactionSchema.index({ creatorId: 1, createdAt: -1 });
CoinTransactionSchema.index({ userId: 1, createdAt: -1 });
CoinTransactionSchema.index({ type: 1, createdAt: -1 });
