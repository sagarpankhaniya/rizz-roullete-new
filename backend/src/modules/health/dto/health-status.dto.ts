import { ApiProperty } from '@nestjs/swagger';

export class HealthStatusDto {
  @ApiProperty({ example: 'ok' })
  status!: 'ok' | 'degraded';

  @ApiProperty({ example: '0.1.0' })
  version!: string;

  @ApiProperty({
    example: { mongodb: true, redis: true },
  })
  checks!: {
    mongodb: boolean;
    redis: boolean;
  };

  @ApiProperty()
  timestamp!: string;
}

