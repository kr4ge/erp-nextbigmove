import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsIn,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export const WMS_MOBILE_PACKING_STATUSES = [
  'PICKED',
  'PACKING',
  'AWAITING_TRACKING',
  'PACKED',
] as const;

export type WmsMobilePackingStatusFilter = (typeof WMS_MOBILE_PACKING_STATUSES)[number];

export class GetWmsMobilePackingTasksDto {
  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @IsOptional()
  @IsUUID()
  storeId?: string;

  @IsOptional()
  @IsIn(WMS_MOBILE_PACKING_STATUSES)
  status?: WmsMobilePackingStatusFilter;

  @IsOptional()
  @IsString()
  @MinLength(1)
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
  @Min(5)
  @Max(50)
  pageSize?: number;
}

export class WmsMobilePackScopedDto {
  @IsOptional()
  @IsUUID()
  tenantId?: string;
}

export class WmsMobilePackScanDto extends WmsMobilePackScopedDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  code!: string;
}

export class WmsMobilePackBasketOrderCompleteDto extends WmsMobilePackScopedDto {}

export class WmsWebPackBasketOrderCompleteDto {}

export const WMS_WEB_PACKING_PROOF_SOURCES = ['CAMERA', 'FILE', 'CLIPBOARD'] as const;

export class WmsWebPackingProofUploadDto {
  @IsOptional()
  @IsIn(WMS_WEB_PACKING_PROOF_SOURCES)
  source?: (typeof WMS_WEB_PACKING_PROOF_SOURCES)[number];
}

export class WmsMobilePackCompleteDto extends WmsMobilePackScopedDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  trackingCode!: string;
}

export class WmsWebPackCompleteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  trackingCode!: string;
}

export class WmsMobilePackVoidDto extends WmsMobilePackScopedDto {
  @IsString()
  @MinLength(3)
  @MaxLength(240)
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  supervisorIdentifier?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  supervisorPassword?: string;
}

export class WmsMobilePackBasketVoidDto extends WmsMobilePackVoidDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  orderIds!: string[];
}
