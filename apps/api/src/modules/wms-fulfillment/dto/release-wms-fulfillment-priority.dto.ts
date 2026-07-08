import { IsOptional, IsUUID } from 'class-validator';

export class ReleaseWmsFulfillmentPriorityDto {
  @IsUUID()
  orderId!: string;

  @IsOptional()
  @IsUUID()
  tenantId?: string;
}
