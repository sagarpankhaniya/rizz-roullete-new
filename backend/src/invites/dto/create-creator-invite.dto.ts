import { IsEmail } from 'class-validator';

export class CreateCreatorInviteDto {
  @IsEmail()
  email: string;
}
