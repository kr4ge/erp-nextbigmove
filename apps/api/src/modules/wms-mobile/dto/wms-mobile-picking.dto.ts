import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export const WMS_MOBILE_PICKING_STATUSES = [
  'READY',
  'PARTIAL',
  'RESTOCKING',
  'ISSUE',
  'IN_PICKING',
  'READY_FOR_PACK',
  'PICKED',
] as const;

export type WmsMobilePickingStatusFilter = (typeof WMS_MOBILE_PICKING_STATUSES)[number];

export class GetWmsMobilePickingTasksDto {
  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @IsOptional()
  @IsUUID()
  storeId?: string;

  @IsOptional()
  @IsIn(WMS_MOBILE_PICKING_STATUSES)
  status?: WmsMobilePickingStatusFilter;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  ownedOnly?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(50)
  pageSize?: number;
}

export class WmsMobilePickScopedDto {
  @IsOptional()
  @IsUUID()
  tenantId?: string;
}

export class WmsMobilePickResyncDto extends WmsMobilePickScopedDto {
  @IsOptional()
  @IsUUID()
  storeId?: string;
}

export class WmsMobilePickReallocateDto extends WmsMobilePickScopedDto {
  @IsOptional()
  @IsUUID()
  storeId?: string;
}

export class WmsMobilePickScanDto extends WmsMobilePickScopedDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  code!: string;
}

export class WmsMobilePickBasketUnitScanDto extends WmsMobilePickScanDto {
  @IsUUID()
  binId!: string;
}

export class WmsMobilePickBasketBatchAssignDto extends WmsMobilePickScopedDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  basketCode!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsUUID('4', { each: true })
  taskIds!: string[];
}

export class WmsMobilePickHandoffDto extends WmsMobilePickScopedDto {
  @IsUUID()
  packerId!: string;
}

export class GetWmsMobilePickBasketLookupDto extends WmsMobilePickScopedDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  code!: string;
}
