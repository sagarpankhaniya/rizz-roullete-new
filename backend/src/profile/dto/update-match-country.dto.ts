import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateMatchCountryDto {
  /** ISO 3166-1 alpha-2 code, or null / empty to clear the filter. */
  @IsOptional()
  @IsString()
  @MaxLength(8)
  matchCountry?: string | null;
}
