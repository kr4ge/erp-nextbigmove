import { IsOptional, IsUUID } from "class-validator";

export class ListWmsPosProductFiltersDto {
  @IsOptional()
  @IsUUID()
  tenantId?: string;
}
