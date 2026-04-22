import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateWmsPurchasingLineDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  approvedQuantity?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  receivedQuantity?: number;

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

