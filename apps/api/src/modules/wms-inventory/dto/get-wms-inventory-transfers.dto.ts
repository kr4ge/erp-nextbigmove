import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class GetWmsInventoryTransfersDto {
  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
