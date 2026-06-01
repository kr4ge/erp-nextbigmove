import { Type } from 'class-transformer';
import { IsISO8601, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';

export class GetWmsMobileStockScanDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  code!: string;

  @IsOptional()
  @IsUUID()
  tenantId?: string;
}

export class GetWmsMobileStockScopedDto {
  @IsOptional()
  @IsUUID()
  tenantId?: string;
}

export class GetWmsMobileHomeInventorySummaryDto extends GetWmsMobileStockScopedDto {
  @IsOptional()
  @IsUUID()
  storeId?: string;

  @IsOptional()
  @IsUUID()
  warehouseId?: string;
}

export class GetWmsMobileHomeTaskSummaryDto extends GetWmsMobileStockScopedDto {
  @IsOptional()
  @IsUUID()
  storeId?: string;
}

export class GetWmsMobileTrackingLookupDto extends GetWmsMobileStockScopedDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  code!: string;
}

export class WmsMobileTrackingReturnUnitDto extends GetWmsMobileStockScopedDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  code!: string;
}

export class GetWmsMobileRtsTasksDto extends GetWmsMobileStockScopedDto {
  @IsOptional()
  @IsUUID()
  storeId?: string;

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

export class WmsMobileStockMoveDto {
  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  clientRequestId?: string;

  @IsUUID()
  unitId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  targetCode!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  expectedStatus?: string;

  @IsOptional()
  @IsUUID()
  expectedCurrentLocationId?: string | null;

  @IsOptional()
  @IsISO8601()
  expectedUpdatedAt?: string;

  @IsOptional()
  @Type(() => String)
  @IsString()
  @MaxLength(400)
  notes?: string;
}
