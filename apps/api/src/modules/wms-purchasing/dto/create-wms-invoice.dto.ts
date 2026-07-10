import { WmsInvoiceLineType, WmsInvoiceStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
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

class CreateWmsInvoiceLineDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  lineNo?: number;

  @IsOptional()
  @IsUUID()
  storeId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  productId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  variationId?: string;

  @IsString()
  @MaxLength(280)
  description!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitRate!: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  rateSource?: string;

  @IsOptional()
  @IsEnum(WmsInvoiceLineType)
  lineType?: WmsInvoiceLineType;
}

export class CreateWmsInvoiceDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  invoiceNumber?: string;

  @IsOptional()
  @IsEnum(WmsInvoiceStatus)
  status?: WmsInvoiceStatus;

  @IsOptional()
  @IsDateString()
  issueDate?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1200)
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateWmsInvoiceLineDto)
  lines!: CreateWmsInvoiceLineDto[];
}

export type CreateWmsInvoiceLineInput = CreateWmsInvoiceLineDto;
