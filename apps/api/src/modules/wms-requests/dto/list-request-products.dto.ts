import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

function toBoolean(value: unknown) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    return ['true', '1', 'yes'].includes(value.toLowerCase());
  }

  return false;
}

export class ListWmsRequestProductsDto {
  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @IsOptional()
  @IsUUID()
  storeId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  requestableOnly?: boolean;

  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  profileOnly?: boolean;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @Min(1)
  @Max(2000)
  limit?: number;
}
