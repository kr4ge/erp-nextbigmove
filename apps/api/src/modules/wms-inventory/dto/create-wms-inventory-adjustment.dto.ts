import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { WmsInventoryUnitStatus } from '@prisma/client';

const ADJUSTABLE_WMS_INVENTORY_STATUSES = [
  WmsInventoryUnitStatus.STAGED,
  WmsInventoryUnitStatus.PUTAWAY,
  WmsInventoryUnitStatus.RTS,
  WmsInventoryUnitStatus.DAMAGED,
  WmsInventoryUnitStatus.ARCHIVED,
] as const;

export class CreateWmsInventoryAdjustmentDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID(undefined, { each: true })
  unitIds!: string[];

  @IsEnum(ADJUSTABLE_WMS_INVENTORY_STATUSES)
  targetStatus!: (typeof ADJUSTABLE_WMS_INVENTORY_STATUSES)[number];

  @IsOptional()
  @IsUUID()
  targetLocationId?: string;

  @IsOptional()
  @Type(() => String)
  @IsString()
  @MaxLength(400)
  notes?: string;
}
