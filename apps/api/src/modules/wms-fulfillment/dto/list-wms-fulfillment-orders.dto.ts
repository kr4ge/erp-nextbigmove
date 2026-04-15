import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from "class-validator";
import { Type } from "class-transformer";

const WMS_FULFILLMENT_VIEWS = ["PICKING", "PACKING", "DISPATCH"] as const;
const WMS_FULFILLMENT_ORDER_STATUSES = [
  "PENDING",
  "WAITING_FOR_STOCK",
  "PICKING",
  "PICKED",
  "PACKING_PENDING",
  "PACKING_ASSIGNED",
  "PACKING",
  "PACKED",
  "DISPATCHED",
  "HOLD",
  "CANCELED",
] as const;

export class ListWmsFulfillmentOrdersDto {
  @IsOptional()
  @IsIn(WMS_FULFILLMENT_VIEWS)
  view?: (typeof WMS_FULFILLMENT_VIEWS)[number];

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
  @IsIn(WMS_FULFILLMENT_ORDER_STATUSES)
  status?: (typeof WMS_FULFILLMENT_ORDER_STATUSES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(300)
  limit?: number;
}
