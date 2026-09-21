import { Transform, Type } from 'class-transformer';
import { CreativeRevisionState } from '@prisma/client';
import { ArrayMaxSize, IsArray, IsDateString, IsEnum, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

/** "a,b,c" from the query string into a list; blank means no filter. */
const commaList = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const ids = value.split(',').map((id) => id.trim()).filter(Boolean);
  return ids.length ? ids : undefined;
};

export class ListCreativeAssetsQueryDto {
  /** The window the per-creative performance figures are summed over. */
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

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

  /** Several stores at once, comma-separated. Wins over storeId when both are sent. */
  @IsOptional()
  @Transform(commaList)
  @IsArray()
  @IsUUID('all', { each: true })
  @ArrayMaxSize(200)
  storeIds?: string[];

  /** Several creators at once, comma-separated. Wins over creatorId when both are sent. */
  @IsOptional()
  @Transform(commaList)
  @IsArray()
  @IsUUID('all', { each: true })
  @ArrayMaxSize(200)
  creatorIds?: string[];

  /** Meta link states to show, comma-separated. Both or none means no filter. */
  @IsOptional()
  @Transform(commaList)
  @IsArray()
  @IsIn(['LINKED', 'UNLINKED'], { each: true })
  linked?: Array<'LINKED' | 'UNLINKED'>;

  /** AI analysis states to show, comma-separated. Both or none means no filter. */
  @IsOptional()
  @Transform(commaList)
  @IsArray()
  @IsIn(['ANALYZED', 'NOT_ANALYZED'], { each: true })
  analyzed?: Array<'ANALYZED' | 'NOT_ANALYZED'>;

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
