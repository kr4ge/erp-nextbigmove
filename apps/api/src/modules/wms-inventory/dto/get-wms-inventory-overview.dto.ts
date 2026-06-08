import { WmsInventoryUnitStatus } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class GetWmsInventoryOverviewDto {
  @IsOptional()
  @IsBoolean()
  allTenants?: boolean;

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
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsEnum(WmsInventoryUnitStatus)
  status?: WmsInventoryUnitStatus;
}
