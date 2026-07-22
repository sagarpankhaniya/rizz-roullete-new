import { IsString, MaxLength, MinLength } from 'class-validator';

export class VerifyGenderDto {
  @IsString()
  @MinLength(1)
  @MaxLength(3_000_000)
  image!: string;
}
