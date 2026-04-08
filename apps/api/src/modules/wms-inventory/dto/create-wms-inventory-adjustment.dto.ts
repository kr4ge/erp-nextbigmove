import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export const WMS_INVENTORY_ADJUSTMENT_TYPES = [
  'OPENING',
  'INCREASE',
  'DECREASE',
  'WRITE_OFF',
] as const;

export class CreateWmsInventoryAdjustmentItemDto {
  @IsOptional()
  @IsUUID()
  sourceProductId?: string;

  @IsString()
  @MaxLength(120)
  sku!: string;

  @IsString()
  @MaxLength(200)
  productName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  variationId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  variationName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  barcode?: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  quantity!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitCost?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  lotCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class CreateWmsInventoryAdjustmentDto {
  @IsUUID()
  warehouseId!: string;

  @IsUUID()
  locationId!: string;

  @IsString()
  @IsIn(WMS_INVENTORY_ADJUSTMENT_TYPES)
  adjustmentType!: (typeof WMS_INVENTORY_ADJUSTMENT_TYPES)[number];

  @IsString()
  @MaxLength(200)
  reason!: string;

  @IsOptional()
  @IsDateString()
  happenedAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateWmsInventoryAdjustmentItemDto)
  items!: CreateWmsInventoryAdjustmentItemDto[];
}
