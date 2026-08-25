import { Transform, Type } from 'class-transformer';
import { CreativeQcStatus } from '@prisma/client';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class ListCreativeAssetsQueryDto {
  /**
   * REVIEW narrows the list to the advertising approval queue
   * (FOR_APPROVAL, REVISED, FOR_POSTING), oldest submission first.
   * An explicit qcStatus wins over the queue preset.
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
  @IsEnum(CreativeQcStatus)
  qcStatus?: CreativeQcStatus;

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
