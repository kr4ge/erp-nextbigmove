import { WmsProductProfileStatus } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class GetWmsProductsOverviewDto {
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
  posWarehouseId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsEnum(WmsProductProfileStatus)
  status?: WmsProductProfileStatus;
}
