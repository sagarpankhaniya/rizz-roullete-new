import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class SpendCoinsDto {
  @IsNumber()
  @Min(1)
  amount: number;

  @IsOptional()
  @IsString()
  creatorId?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
