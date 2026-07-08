import { IsOptional, IsUUID } from 'class-validator';

export class GetWmsFulfillmentPriorityPreviewDto {
  @IsUUID()
  orderId!: string;

  @IsOptional()
  @IsUUID()
  tenantId?: string;
}
