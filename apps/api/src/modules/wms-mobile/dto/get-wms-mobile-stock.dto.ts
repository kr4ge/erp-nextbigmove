import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

const WMS_MOBILE_STOCK_MODES = ['putaway', 'move', 'bins', 'recent'] as const;

export type WmsMobileStockMode = (typeof WMS_MOBILE_STOCK_MODES)[number];

export class GetWmsMobileStockDto {
  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @IsOptional()
  @IsUUID()
  storeId?: string;

  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @IsOptional()
  @IsIn(WMS_MOBILE_STOCK_MODES)
  mode?: WmsMobileStockMode;

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(50)
  pageSize?: number;
}
