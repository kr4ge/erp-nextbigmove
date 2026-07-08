import { WmsInvoiceStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateWmsInvoiceStatusDto {
  @IsEnum(WmsInvoiceStatus)
  status!: WmsInvoiceStatus;

  @IsOptional()
  @IsDateString()
  issueDate?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1200)
  notes?: string;
}
