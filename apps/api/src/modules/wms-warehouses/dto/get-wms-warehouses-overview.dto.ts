import { IsOptional, IsUUID } from 'class-validator';

export class GetWmsWarehousesOverviewDto {
  @IsOptional()
  @IsUUID()
  warehouseId?: string;
}
