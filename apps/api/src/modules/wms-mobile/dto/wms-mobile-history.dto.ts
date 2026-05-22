import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export const WMS_MOBILE_HISTORY_TYPES = [
  'ALL',
  'PICK',
  'PACK',
  'DISPATCH',
  'SCAN',
  'VOID',
  'ISSUE',
] as const;

export type WmsMobileHistoryTypeFilter = (typeof WMS_MOBILE_HISTORY_TYPES)[number];

export class GetWmsMobileHistoryFeedDto {
  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @IsOptional()
  @IsUUID()
  actorId?: string;

  @IsOptional()
  @IsIn(WMS_MOBILE_HISTORY_TYPES)
  type?: WmsMobileHistoryTypeFilter;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(10)
  @Max(50)
  limit?: number;
}
