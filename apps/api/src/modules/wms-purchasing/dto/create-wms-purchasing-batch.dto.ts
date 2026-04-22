import {
  WmsPurchasingBatchStatus,
  WmsPurchasingRequestType,
  WmsPurchasingSourceType,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

class CreateWmsPurchasingBatchLineDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  lineNo?: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  sourceItemId?: string;

  @IsOptional()
  @IsObject()
  sourceSnapshot?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  productId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  variationId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(220)
  requestedProductName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  uom?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  requestedQuantity!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  approvedQuantity?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  partnerUnitCost?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  supplierUnitCost?: number;

  @IsOptional()
  @IsBoolean()
  needsProfiling?: boolean;

  @IsOptional()
  @IsUUID()
  resolvedPosProductId?: string;

  @IsOptional()
  @IsUUID()
  resolvedProfileId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  notes?: string;
}

export class CreateWmsPurchasingBatchDto {
  @IsUUID()
  storeId!: string;

  @IsOptional()
  @IsUUID()
  teamId?: string;

  @IsEnum(WmsPurchasingRequestType)
  requestType!: WmsPurchasingRequestType;

  @IsOptional()
  @IsEnum(WmsPurchasingBatchStatus)
  status?: WmsPurchasingBatchStatus;

  @IsOptional()
  @IsEnum(WmsPurchasingSourceType)
  sourceType?: WmsPurchasingSourceType;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  sourceRequestId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sourceRequestType?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  sourceStatus?: string;

  @IsOptional()
  @IsObject()
  sourceSnapshot?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  requestTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  partnerNotes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  wmsNotes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  invoiceNumber?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  invoiceAmount?: number;

  @IsOptional()
  @IsDateString()
  paymentSubmittedAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1024)
  paymentProofImageUrl?: string;

  @IsOptional()
  @IsDateString()
  paymentVerifiedAt?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateWmsPurchasingBatchLineDto)
  lines!: CreateWmsPurchasingBatchLineDto[];
}

export type CreateWmsPurchasingBatchLineInput = CreateWmsPurchasingBatchLineDto;
