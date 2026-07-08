import { WmsInvoiceSourceType, WmsInvoiceStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class GetWmsInvoicesOverviewDto {
  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @IsOptional()
  @IsEnum(WmsInvoiceSourceType)
  sourceType?: WmsInvoiceSourceType;

  @IsOptional()
  @IsEnum(WmsInvoiceStatus)
  status?: WmsInvoiceStatus;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;
}
