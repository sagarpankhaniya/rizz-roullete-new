import {
  IsIn,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { REPORT_REASONS } from '../schemas/report.schema';

export class CreateReportDto {
  @IsMongoId()
  reportedUserId!: string;

  @IsIn([...REPORT_REASONS])
  reason!: (typeof REPORT_REASONS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  details?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  roomName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  reportedIdentity?: string;
}
