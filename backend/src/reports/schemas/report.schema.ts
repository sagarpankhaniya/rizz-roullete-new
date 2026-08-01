import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ReportStatus = 'pending' | 'reviewed' | 'dismissed' | 'banned';

export type ReportDocument = HydratedDocument<Report>;

export const REPORT_REASONS = [
  'harassment',
  'inappropriate_content',
  'spam_scam',
  'underage',
  'other',
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

@Schema({ timestamps: true, collection: 'reports' })
export class Report {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  reporterId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  reportedUserId: Types.ObjectId;

  @Prop({ type: String, default: null })
  reporterIdentity: string | null;

  @Prop({ type: String, default: null })
  reportedIdentity: string | null;

  @Prop({ type: String, default: null })
  roomName: string | null;

  @Prop({
    type: String,
    enum: REPORT_REASONS,
    required: true,
  })
  reason: ReportReason;

  @Prop({ type: String, default: null, maxlength: 1000 })
  details: string | null;

  @Prop({
    type: String,
    enum: ['pending', 'reviewed', 'dismissed', 'banned'],
    default: 'pending',
    index: true,
  })
  status: ReportStatus;

  @Prop({ type: String, default: null })
  adminNotes: string | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  reviewedBy: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  reviewedAt: Date | null;
}

export const ReportSchema = SchemaFactory.createForClass(Report);

ReportSchema.index({ reporterId: 1, reportedUserId: 1, createdAt: -1 });
ReportSchema.index({ status: 1, createdAt: -1 });
