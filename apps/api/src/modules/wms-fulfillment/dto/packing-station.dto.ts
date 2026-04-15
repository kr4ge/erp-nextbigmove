import { PartialType } from "@nestjs/mapped-types";
import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";

const WMS_PACKING_STATION_STATUSES = ["ACTIVE", "INACTIVE"] as const;

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry) => entry.length > 0);
}

export class CreateWmsPackingStationDto {
  @IsUUID()
  warehouseId!: string;

  @IsString()
  @MaxLength(24)
  code!: string;

  @IsString()
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsIn(WMS_PACKING_STATION_STATUSES)
  status?: (typeof WMS_PACKING_STATION_STATUSES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(240)
  notes?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeStringArray(value))
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(20)
  @IsUUID("4", { each: true })
  assignedUserIds?: string[];
}

export class UpdateWmsPackingStationDto extends PartialType(
  CreateWmsPackingStationDto,
) {}

