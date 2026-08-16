import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListAdminChatConversationsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  /** Any participant in the conversation */
  @IsOptional()
  @IsString()
  userId?: string;

  /** Both participants — all calls between this pair */
  @IsOptional()
  @IsString()
  userIdA?: string;

  @IsOptional()
  @IsString()
  userIdB?: string;

  @IsOptional()
  @IsString()
  roomName?: string;

  @IsOptional()
  @IsString()
  search?: string;

  /** ISO date string — filter messages sent on or after */
  @IsOptional()
  @IsString()
  from?: string;

  /** ISO date string — filter messages sent on or before */
  @IsOptional()
  @IsString()
  to?: string;
}
