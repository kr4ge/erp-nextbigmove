import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class ListWmsInventoryBalancesDto {
  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @IsOptional()
  @IsUUID()
  locationId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}
