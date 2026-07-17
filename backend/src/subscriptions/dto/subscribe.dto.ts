import { IsIn, IsNotEmpty, IsString, Matches } from 'class-validator';

export class SubscribeDto {
  @IsString()
  @IsIn(['weekly', 'monthly', 'six', 'yearly'])
  plan: 'weekly' | 'monthly' | 'six' | 'yearly';

  @IsString()
  @IsNotEmpty()
  nameOnCard: string;

  @IsString()
  @Matches(/^\d{13,19}$/)
  cardNumber: string;

  @IsString()
  @Matches(/^\d{2}\/\d{2}$/)
  expiry: string;
}
