import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(1)
  password: string;

  @IsString()
  @IsIn(['male', 'female'])
  gender: string;

  @IsString()
  @IsIn(['male', 'female', 'everyone', 'couple', 'other'])
  interestedIn: string;

  /** One-time creator invite UUID from `?invite_id=` */
  @IsOptional()
  @IsUUID()
  inviteId?: string;
}

