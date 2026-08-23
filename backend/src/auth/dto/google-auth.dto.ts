import { IsOptional, IsString, MinLength } from 'class-validator';

export class GoogleAuthDto {
  @IsString()
  @MinLength(1)
  idToken!: string;

  /** Required for new users when gender is not available from Google. */
  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsString()
  interestedIn?: string;

  @IsOptional()
  @IsString()
  inviteId?: string;
}
