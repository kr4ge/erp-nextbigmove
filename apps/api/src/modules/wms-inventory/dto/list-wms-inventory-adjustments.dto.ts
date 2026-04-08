import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { WMS_INVENTORY_ADJUSTMENT_TYPES } from './create-wms-inventory-adjustment.dto';

export class ListWmsInventoryAdjustmentsDto {
  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @IsOptional()
  @IsIn(WMS_INVENTORY_ADJUSTMENT_TYPES)
  adjustmentType?: (typeof WMS_INVENTORY_ADJUSTMENT_TYPES)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
