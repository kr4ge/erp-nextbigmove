import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class GetWmsFulfillmentOpsSnapshotDto {
  @IsOptional()
  @IsBoolean()
  allTenants?: boolean;

  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(10080)
  staleMinutes?: number;
}
