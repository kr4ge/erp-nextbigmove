import { IsOptional, IsUUID } from 'class-validator';

export class GetWmsVariationIntegrityAuditDto {
  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @IsOptional()
  @IsUUID()
  storeId?: string;
}
