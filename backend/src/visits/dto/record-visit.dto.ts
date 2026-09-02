import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class RecordVisitDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  sessionId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  path: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  referrer?: string;
}
