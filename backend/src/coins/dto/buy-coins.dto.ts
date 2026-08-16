import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class BuyCoinsDto {
  @IsNotEmpty()
  @IsString()
  packId: string;

  @IsOptional()
  @IsString()
  packLabel?: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  amount: number;

  @IsNotEmpty()
  @IsString()
  nameOnCard: string;

  @IsNotEmpty()
  @IsString()
  cardNumber: string;

  @IsNotEmpty()
  @IsString()
  expiry: string;

  @IsNotEmpty()
  @IsString()
  cvc: string;
}
