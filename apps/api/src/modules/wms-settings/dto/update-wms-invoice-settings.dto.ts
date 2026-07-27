import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class WmsInvoicePaymentProfileDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  bankName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  bankAccountName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  bankAccountNumber?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  bankAccountType?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  bankBranch?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1200)
  paymentInstructions?: string | null;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateWmsInvoiceSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  companyName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(600)
  companyAddress?: string;

  @IsOptional()
  @IsUUID()
  logoAssetId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  invoicePrefix?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  bankName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  bankAccountName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  bankAccountNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  bankAccountType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  bankBranch?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1200)
  paymentInstructions?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1200)
  footerNotes?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => WmsInvoicePaymentProfileDto)
  paymentProfiles?: WmsInvoicePaymentProfileDto[];
}

export class UpdateWmsInvoiceTenantBillingDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  billingCompanyName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(600)
  billingAddress?: string | null;
}
