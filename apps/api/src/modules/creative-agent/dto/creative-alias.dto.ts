import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateCreativeAliasDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  alias!: string;
}

export class LinkUnregisteredCreativeDto {
  /**
   * Optional. Manual linking is an explicit identity connection
   * (tenant + accountId + adId -> creativeId). When an alias is supplied it is
   * additionally validated and recorded as a named alias, but the ad name is
   * never required to contain a code-shaped value for the link itself.
   */
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
  })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  alias?: string;

  @IsUUID()
  creativeId!: string;

  @IsString()
  @MaxLength(100)
  accountId!: string;

  @IsString()
  @MaxLength(100)
  adId!: string;
}

export class UnlinkMetaAdDto {
  @IsString()
  @MaxLength(100)
  accountId!: string;

  @IsString()
  @MaxLength(100)
  adId!: string;
}
