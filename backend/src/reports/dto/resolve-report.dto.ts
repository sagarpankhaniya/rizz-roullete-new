import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ResolveReportDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  banReason?: string;
}
