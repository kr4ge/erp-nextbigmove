import { IsOptional, IsUUID } from 'class-validator';

export class GetWmsDispatchSummaryDto {
  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @IsOptional()
  @IsUUID()
  storeId?: string;
}
