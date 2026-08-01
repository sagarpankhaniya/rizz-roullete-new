import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListReportsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @IsOptional()
  @IsIn(['pending', 'reviewed', 'dismissed', 'banned'])
  status?: 'pending' | 'reviewed' | 'dismissed' | 'banned';

  @IsOptional()
  @IsString()
  search?: string;
}
