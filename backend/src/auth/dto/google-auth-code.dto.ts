import { IsOptional, IsString, MinLength } from 'class-validator';

export class GoogleAuthCodeDto {
  @IsString()
  @MinLength(1)
  code!: string;

  /** The redirect_uri used when initiating the auth-code flow on the frontend. */
  @IsString()
  @MinLength(1)
  redirectUri!: string;

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
