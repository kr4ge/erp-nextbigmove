import { WmsInvoiceLineType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

class UpdateWmsInvoiceLineDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  lineNo?: number;

  @IsOptional()
  @IsUUID()
  storeId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  productId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  variationId?: string | null;

  @IsString()
  @MaxLength(280)
  description!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  itemSubtext?: string | null;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitRate!: number;

  @IsOptional()
  @IsBoolean()
  vatEnabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  rateSource?: string | null;

  @IsOptional()
  @IsEnum(WmsInvoiceLineType)
  lineType?: WmsInvoiceLineType;
}

export class UpdateWmsInvoiceDto {
  @IsOptional()
  @IsUUID()
  paymentProfileId?: string | null;

  @IsOptional()
  @IsDateString()
  issueDate?: string | null;

  @IsOptional()
  @IsDateString()
  dueDate?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1200)
  notes?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateWmsInvoiceLineDto)
  lines?: UpdateWmsInvoiceLineDto[];
}

export type UpdateWmsInvoiceLineInput = UpdateWmsInvoiceLineDto;
