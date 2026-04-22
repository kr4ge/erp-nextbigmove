import { WmsPurchasingBatchStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateWmsPurchasingStatusDto {
  @IsEnum(WmsPurchasingBatchStatus)
  status!: WmsPurchasingBatchStatus;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  message?: string;

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

  @IsOptional()
  @IsString()
  @MaxLength(120)
  sourceStatus?: string;
}
