import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class ListWmsInvoicesDto {
  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @IsOptional()
  @IsIn(['UNPAID', 'PAYMENT_SUBMITTED', 'PAID', 'CANCELED'])
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

export class ListWmsPaymentsDto {
  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @IsOptional()
  @IsIn(['SUBMITTED', 'VERIFIED', 'REJECTED'])
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

export class CreateWmsStockRequestPaymentDto {
  @IsString()
  @MaxLength(1000)
  proofUrl!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  proofNote?: string;
}

export class VerifyWmsStockRequestPaymentDto {
  @IsBoolean()
  approve!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  remarks?: string;
}
