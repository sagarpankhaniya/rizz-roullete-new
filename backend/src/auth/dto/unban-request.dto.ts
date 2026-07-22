import { IsEmail, IsString, MinLength } from 'class-validator';

export class UnbanRequestDto {
  @IsEmail()
  @IsString()
  @MinLength(3)
  email!: string;
}
