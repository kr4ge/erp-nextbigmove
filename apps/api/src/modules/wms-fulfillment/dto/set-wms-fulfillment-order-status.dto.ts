import { IsIn } from "class-validator";

const MANUAL_FULFILLMENT_STATUSES = [
  "PENDING",
  "WAITING_FOR_STOCK",
  "HOLD",
  "CANCELED",
] as const;

export class SetWmsFulfillmentOrderStatusDto {
  @IsIn(MANUAL_FULFILLMENT_STATUSES)
  status!: (typeof MANUAL_FULFILLMENT_STATUSES)[number];
}

