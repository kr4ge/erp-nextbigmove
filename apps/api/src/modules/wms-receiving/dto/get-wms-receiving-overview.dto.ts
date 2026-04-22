import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class GetWmsReceivingOverviewDto {
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
  @IsString()
  @MaxLength(120)
  search?: string;
}
