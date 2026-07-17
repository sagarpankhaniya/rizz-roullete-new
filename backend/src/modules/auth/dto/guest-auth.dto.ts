import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class GuestAuthDto {
  @ApiPropertyOptional({
    description:
      'Stable guest UUID from the client (localStorage). Generated server-side if omitted.',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID('4')
  anonymousId?: string;
}

export class PublicUserDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  anonymousId!: string;

  @ApiPropertyOptional()
  displayName?: string;

  @ApiProperty({ enum: ['guest', 'google'] })
  authProvider!: 'guest' | 'google';

  @ApiProperty()
  isBanned!: boolean;
}

export class GuestAuthResponseDto {
  @ApiProperty({ description: 'App JWT (not LiveKit media token)' })
  accessToken!: string;

  @ApiProperty({ type: PublicUserDto })
  user!: PublicUserDto;
}

