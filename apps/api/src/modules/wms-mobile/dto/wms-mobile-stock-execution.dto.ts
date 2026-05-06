import { Type } from 'class-transformer';
import { IsISO8601, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class GetWmsMobileStockScanDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  code!: string;

  @IsOptional()
  @IsUUID()
  tenantId?: string;
}

export class GetWmsMobileStockScopedDto {
  @IsOptional()
  @IsUUID()
  tenantId?: string;
}

export class WmsMobileStockMoveDto {
  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  clientRequestId?: string;

  @IsUUID()
  unitId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  targetCode!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  expectedStatus?: string;

  @IsOptional()
  @IsUUID()
  expectedCurrentLocationId?: string | null;

  @IsOptional()
  @IsISO8601()
  expectedUpdatedAt?: string;

  @IsOptional()
  @Type(() => String)
  @IsString()
  @MaxLength(400)
  notes?: string;
}
