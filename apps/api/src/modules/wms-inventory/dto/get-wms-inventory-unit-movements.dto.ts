import { IsOptional, IsUUID } from 'class-validator';

export class GetWmsInventoryUnitMovementsDto {
  @IsOptional()
  @IsUUID()
  tenantId?: string;
}
