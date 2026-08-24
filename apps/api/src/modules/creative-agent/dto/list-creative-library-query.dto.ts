import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { CreativeKind, CreativePerformanceStatus, CreativeQcStatus } from '@prisma/client';

export const CREATIVE_SORT_KEYS = ['code', 'title', 'createdAt', 'spend', 'impressions', 'hookRate', 'holdRate', 'ctr'] as const;
export type CreativeSortKey = (typeof CREATIVE_SORT_KEYS)[number];

export class ListCreativeLibraryQueryDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MaxLength(200)
  query?: string;

  @IsOptional()
  @Transform(({ value }) => value === '' ? undefined : value)
  @IsEnum(CreativeKind)
  kind?: CreativeKind;

  @IsOptional()
  @Transform(({ value }) => value === '' ? undefined : value)
  @IsUUID()
  storeId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  accountId?: string;

  @IsOptional()
  @Transform(({ value }) => value === '' ? undefined : value)
  @IsUUID()
  creatorId?: string;

  @IsOptional()
  @Transform(({ value }) => value === '' ? undefined : value)
  @IsEnum(CreativeQcStatus)
  qcStatus?: CreativeQcStatus;

  @IsOptional()
  @Transform(({ value }) => value === '' ? undefined : value)
  @IsEnum(CreativePerformanceStatus)
  performanceStatus?: CreativePerformanceStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 24;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  unregisteredPage: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  unregisteredPageSize: number = 5;

  @IsOptional()
  @IsIn(CREATIVE_SORT_KEYS)
  sortKey: CreativeSortKey = 'createdAt';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDirection: 'asc' | 'desc' = 'desc';
}
