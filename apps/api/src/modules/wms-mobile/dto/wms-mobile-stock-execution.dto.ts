import { Type } from 'class-transformer';
import { IsISO8601, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';

const WMS_MOBILE_STOCK_COUNT_SESSION_STATUSES = ['OPEN', 'SUBMITTED', 'CLOSED', 'CANCELED'] as const;
const WMS_MOBILE_RTS_DISPOSITION_ACTIONS = ['PUTAWAY', 'DEADSTOCK', 'DAMAGE'] as const;

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

export class WmsMobileTrackingReturnDispositionDto extends GetWmsMobileStockScopedDto {
  @IsUUID()
  unitId!: string;

  @IsIn(WMS_MOBILE_RTS_DISPOSITION_ACTIONS)
  disposition!: (typeof WMS_MOBILE_RTS_DISPOSITION_ACTIONS)[number];

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

export class GetWmsMobileRtsTasksDto extends GetWmsMobileStockScopedDto {
  @IsOptional()
  @IsUUID()
  storeId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

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

export class GetWmsMobileStockCountSessionsDto extends GetWmsMobileStockScopedDto {
  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @IsOptional()
  @IsIn(WMS_MOBILE_STOCK_COUNT_SESSION_STATUSES)
  status?: (typeof WMS_MOBILE_STOCK_COUNT_SESSION_STATUSES)[number];
}

export class WmsMobileStartStockCountDto extends GetWmsMobileStockScopedDto {
  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  targetCode!: string;

  @IsOptional()
  @Type(() => String)
  @IsString()
  @MaxLength(400)
  notes?: string;
}

export class WmsMobileScanStockCountUnitDto extends GetWmsMobileStockScopedDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  code!: string;
}

export class WmsMobileSubmitStockCountDto extends GetWmsMobileStockScopedDto {
  @IsOptional()
  @Type(() => String)
  @IsString()
  @MaxLength(400)
  notes?: string;
}

export class WmsMobileReopenStockCountDto extends GetWmsMobileStockScopedDto {
  @IsOptional()
  @Type(() => String)
  @IsString()
  @MaxLength(400)
  notes?: string;
}

export class WmsMobileCloseoutStockCountDto extends GetWmsMobileStockScopedDto {
  @IsOptional()
  @Type(() => String)
  @IsString()
  @MaxLength(400)
  notes?: string;
}
