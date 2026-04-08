import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

const WMS_INVENTORY_UNIT_STATUSES = [
  "AVAILABLE",
  "RESERVED",
  "PICKED",
  "PACKED",
  "DISPATCHED",
  "RETURNED",
  "DAMAGED",
  "ADJUSTED_OUT",
] as const;

export class ListWmsInventoryUnitsDto {
  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @IsOptional()
  @IsUUID()
  locationId?: string;

  @IsOptional()
  @IsIn(WMS_INVENTORY_UNIT_STATUSES)
  status?: (typeof WMS_INVENTORY_UNIT_STATUSES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}
