import { Transform, Type } from 'class-transformer';
import { CreativeKind } from '@prisma/client';
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

export const CREATIVE_OVERVIEW_SORT_KEYS = [
  'creativeScore',
  'spend',
  'mar',
  'orders',
  'deliveredOrders',
  'netMargin',
  'deliveryRate',
  'costPerOrder',
  'deliveredCostPerOrder',
  'cancellationRate',
  'rtsRate',
  'frequency',
  'hookRate',
  'holdRate',
  'ctr',
  'lpRate',
  'conversionRate',
  'code',
] as const;

export type CreativeOverviewSortKey = (typeof CREATIVE_OVERVIEW_SORT_KEYS)[number];

export class GetCreativeOverviewQueryDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(200)
  query?: string;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsUUID()
  storeId?: string;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsEnum(CreativeKind)
  kind?: CreativeKind;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsUUID()
  creatorId?: string;

  @IsOptional()
  @IsIn(['CREATIVE', 'BUSINESS'])
  lens: 'CREATIVE' | 'BUSINESS' = 'CREATIVE';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize: number = 10;

  @IsOptional()
  @IsIn(CREATIVE_OVERVIEW_SORT_KEYS)
  sortKey: CreativeOverviewSortKey = 'creativeScore';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDirection: 'asc' | 'desc' = 'desc';
}
