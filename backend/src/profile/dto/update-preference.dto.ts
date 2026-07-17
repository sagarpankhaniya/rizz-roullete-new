import { IsString } from 'class-validator';

export class UpdatePreferenceDto {
  @IsString()
  interestedIn: string;
}
