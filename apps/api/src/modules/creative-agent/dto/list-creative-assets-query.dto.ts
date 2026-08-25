import { Transform, Type } from 'class-transformer';
import { CreativeRevisionState } from '@prisma/client';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class ListCreativeAssetsQueryDto {
  /**
   * REVIEW narrows the list to creatives with an open request for changes,
   * oldest request first. An explicit revisionState wins over the preset.
   */
  @IsOptional()
  @Transform(({ value }) => value === '' ? undefined : value)
  @IsIn(['REVIEW'])
  queue?: 'REVIEW';

  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MaxLength(200)
  query?: string;

  @IsOptional()
  @Transform(({ value }) => value === '' ? undefined : value)
  @IsUUID()
  storeId?: string;

  @IsOptional()
  @Transform(({ value }) => value === '' ? undefined : value)
  @IsUUID()
  creatorId?: string;

  /** Deep-link focus: narrow the list to one creative (e.g. /assets?creative=<uuid>). */
  @IsOptional()
  @Transform(({ value }) => value === '' ? undefined : value)
  @IsUUID()
  creativeId?: string;

  @IsOptional()
  @Transform(({ value }) => value === '' ? undefined : value)
  @IsEnum(CreativeRevisionState)
  revisionState?: CreativeRevisionState;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(48)
  pageSize: number = 12;
}
