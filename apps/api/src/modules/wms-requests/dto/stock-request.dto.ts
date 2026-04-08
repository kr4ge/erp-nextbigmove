import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class WmsStockRequestLineInputDto {
  @IsUUID()
  posProductId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  remainingQuantity?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  pendingQuantity?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  pastTwoDaysQuantity?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  returningQuantity?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  recommendedQuantity?: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  requestedQuantity!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  declaredUnitCost?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  partnerNotes?: string;
}

export class CreateWmsStockRequestDto {
  @IsUUID()
  tenantId!: string;

  @IsOptional()
  @IsIn(['WMS_PROCUREMENT', 'PARTNER_SELF_BUY'])
  requestType?: 'WMS_PROCUREMENT' | 'PARTNER_SELF_BUY';

  @IsOptional()
  @IsUUID()
  storeId?: string;

  @IsOptional()
  @IsDateString()
  forecastRunDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  orderingWindow?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  internalNotes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  adjustmentAmount?: number;

  @IsOptional()
  @IsBoolean()
  submit?: boolean;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => WmsStockRequestLineInputDto)
  items!: WmsStockRequestLineInputDto[];
}

export class UpdateWmsStockRequestDto {
  @IsOptional()
  @IsDateString()
  forecastRunDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  orderingWindow?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  internalNotes?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  adjustmentAmount?: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => WmsStockRequestLineInputDto)
  items?: WmsStockRequestLineInputDto[];
}

export class ReviewWmsStockRequestLineDto {
  @IsUUID()
  id!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  requestedQuantity?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  supplierCost?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  wmsUnitPrice?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reviewRemarks?: string;
}

export class ReviewWmsStockRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reviewRemarks?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  adjustmentAmount?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReviewWmsStockRequestLineDto)
  items!: ReviewWmsStockRequestLineDto[];
}

export class AuditWmsStockRequestLineDto {
  @IsUUID()
  id!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  deliveredQuantity!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  acceptedQuantity!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  confirmedUnitCost!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  auditRemarks?: string;
}

export class AuditWmsStockRequestDto {
  @IsIn(['ACCEPT', 'FEEDBACK'])
  action!: 'ACCEPT' | 'FEEDBACK';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  auditRemarks?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AuditWmsStockRequestLineDto)
  items!: AuditWmsStockRequestLineDto[];
}

export class RespondWmsStockRequestDto {
  @IsIn(['CONFIRM', 'REJECT'])
  action!: 'CONFIRM' | 'REJECT';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class ListWmsStockRequestsDto {
  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @IsOptional()
  @IsUUID()
  storeId?: string;

  @IsOptional()
  @IsIn([
    'DRAFT',
    'SUBMITTED',
    'WMS_REVIEWED',
    'PARTNER_CONFIRMED',
    'PARTNER_REJECTED',
    'UNDER_AUDIT',
    'FEEDBACK_REQUIRED',
    'AUDIT_ACCEPTED',
    'INVOICED',
    'PAYMENT_SUBMITTED',
    'PAYMENT_VERIFIED',
    'IN_PROCUREMENT',
    'PARTIALLY_RECEIVED',
    'RECEIVED',
    'CANCELED',
  ])
  status?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @Min(1)
  @Max(200)
  limit?: number;
}
