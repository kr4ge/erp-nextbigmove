import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateWmsStockReceiptItemDto {
  @IsOptional()
  @IsUUID()
  sourceProductId?: string;

  @IsOptional()
  @IsUUID()
  requestLineId?: string;

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

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  unitCost!: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  lotCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  supplierBatchNo?: string;
}

export class CreateWmsStockReceiptDto {
  @IsOptional()
  @IsUUID()
  requestId?: string;

  @IsUUID()
  warehouseId!: string;

  @IsUUID()
  locationId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  supplierName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  supplierReference?: string;

  @IsOptional()
  @IsDateString()
  receivedAt?: string;

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
  @Type(() => CreateWmsStockReceiptItemDto)
  items!: CreateWmsStockReceiptItemDto[];
}
