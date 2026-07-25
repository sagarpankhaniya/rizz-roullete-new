import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class BanUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class UnbanUserDto {
  @IsOptional()
  @IsString()
  note?: string;
}

/** Shared path param validation helper — used via ParseUUID or ObjectId check in service. */
export class UserIdParamDto {
  @IsString()
  @IsNotEmpty()
  id: string;
}
