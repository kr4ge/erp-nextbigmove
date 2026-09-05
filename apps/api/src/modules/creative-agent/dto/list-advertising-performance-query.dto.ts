import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const ADVERTISING_PERFORMANCE_GROUPS = ['ADS', 'CAMPAIGNS', 'CREATIVES'] as const;
export type AdvertisingPerformanceGroup = (typeof ADVERTISING_PERFORMANCE_GROUPS)[number];

export const ADVERTISING_VERDICT_FILTERS = ['ALL', 'NEEDS_ACTION', 'SCALE', 'WATCH', 'KILL'] as const;
export type AdvertisingVerdictFilter = (typeof ADVERTISING_VERDICT_FILTERS)[number];

export const ADVERTISING_LINK_FILTERS = ['ALL', 'LINKED', 'UNLINKED'] as const;
export type AdvertisingLinkFilter = (typeof ADVERTISING_LINK_FILTERS)[number];

/**
 * Whitelisted sort keys. The service maps each key to a fixed SQL fragment;
 * nothing outside this list ever reaches the query builder.
 */
export const ADVERTISING_PERFORMANCE_SORT_KEYS = [
  'name', 'spend', 'ordersToday', 'spendToday', 'spendYesterday', 'orders',
  'cpp', 'cpc', 'deliveredCpp', 'grossSales', 'deliveredSales', 'netContribution',
  'adSpendRatio', 'trueRoas', 'impressions', 'linkClicks', 'landingPageViews',
  'hookRate', 'holdRate', 'completionRate', 'ctr', 'cvr',
  'delivered', 'cancelled', 'rts', 'deliveryRate', 'cancellationRate', 'rtsRate',
  'firstSpendDate', 'lastSpendDate',
] as const;
export type AdvertisingPerformanceSortKey = (typeof ADVERTISING_PERFORMANCE_SORT_KEYS)[number];

const toOptionalBoolean = ({ value }: { value: unknown }) => {
  if (value === '' || value === undefined || value === null) return undefined;
  if (typeof value === 'boolean') return value;
  return value === 'true' || value === '1';
};

export class ListAdvertisingPerformanceQueryDto {
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
  @IsString()
  @MaxLength(100)
  accountId?: string;

  /** Deep-link focus: narrow to one Meta ad. */
  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsString()
  @MaxLength(100)
  adId?: string;

  /** Deep-link focus: narrow to one campaign. */
  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsString()
  @MaxLength(100)
  campaignId?: string;

  /** Deep-link focus: narrow to one linked creative. */
  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsUUID()
  creativeId?: string;

  /** Scope to ads linked to one creator's creatives. */
  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsUUID()
  creatorId?: string;

  @IsOptional()
  @IsIn(ADVERTISING_PERFORMANCE_GROUPS)
  group: AdvertisingPerformanceGroup = 'CREATIVES';

  @IsOptional()
  @IsIn(ADVERTISING_VERDICT_FILTERS)
  verdict: AdvertisingVerdictFilter = 'ALL';

  @IsOptional()
  @IsIn(ADVERTISING_LINK_FILTERS)
  linkStatus: AdvertisingLinkFilter = 'ALL';

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  hideNoOrders?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minSpend?: number;

  /** Reveal paused/inactive ads. Default false: only active/unknown status rows. */
  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  showInactive?: boolean;

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
  pageSize: number = 25;

  @IsOptional()
  @IsIn(ADVERTISING_PERFORMANCE_SORT_KEYS)
  sortKey: AdvertisingPerformanceSortKey = 'ordersToday';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDirection: 'asc' | 'desc' = 'desc';
}
