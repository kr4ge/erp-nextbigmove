import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';

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
   * (tenant + adId -> creativeId). accountId is retained as source metadata
   * for backward-compatible clients. When an alias is supplied it is
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

export class ListCreativeLinkTargetsQueryDto {
  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MaxLength(200)
  query?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 20;
}

export class UnlinkMetaAdDto {
  @IsString()
  @MaxLength(100)
  accountId!: string;

  @IsString()
  @MaxLength(100)
  adId!: string;
}
