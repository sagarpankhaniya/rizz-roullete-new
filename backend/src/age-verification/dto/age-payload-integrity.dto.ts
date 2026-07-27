import { IsString, MinLength } from 'class-validator';

export class AgePayloadIntegrityDto {
  @IsString()
  @MinLength(1)
  verificationResultPayload!: string;
}
