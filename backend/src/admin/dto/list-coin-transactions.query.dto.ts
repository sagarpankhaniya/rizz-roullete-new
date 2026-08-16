import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { COIN_TX_TYPES } from '../../coins/schemas/coin-transaction.schema';

export const COIN_TX_CATEGORIES = ['purchases', 'creator_earnings'] as const;
export type CoinTxCategory = (typeof COIN_TX_CATEGORIES)[number];

export class ListAdminCoinTransactionsQueryDto {
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

  @IsOptional()
  @IsIn(COIN_TX_TYPES)
  type?: (typeof COIN_TX_TYPES)[number];

  /** purchases = fan wallet top-ups; creator_earnings = tips + room entry */
  @IsOptional()
  @IsIn(COIN_TX_CATEGORIES)
  category?: CoinTxCategory;

  @IsOptional()
  @IsString()
  creatorId?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  search?: string;
}
