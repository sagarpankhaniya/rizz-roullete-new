import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PageVisitDocument = HydratedDocument<PageVisit>;

@Schema({ timestamps: true, collection: 'page_visits' })
export class PageVisit {
  @Prop({ type: String, required: true, index: true })
  sessionId: string;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null, index: true })
  userId: Types.ObjectId | null;

  @Prop({ type: String, required: true, maxlength: 500 })
  path: string;

  @Prop({ type: String, default: null, maxlength: 1000 })
  referrer: string | null;

  @Prop({ type: String, default: null, maxlength: 45 })
  ip: string | null;

  @Prop({ type: String, default: null, maxlength: 512 })
  userAgent: string | null;

  @Prop({ type: String, default: 'frontend', maxlength: 32 })
  source: string;
}

export const PageVisitSchema = SchemaFactory.createForClass(PageVisit);

PageVisitSchema.index({ sessionId: 1, createdAt: -1 });
PageVisitSchema.index({ createdAt: -1 });
PageVisitSchema.index({ sessionId: 1, path: 1, createdAt: -1 });
