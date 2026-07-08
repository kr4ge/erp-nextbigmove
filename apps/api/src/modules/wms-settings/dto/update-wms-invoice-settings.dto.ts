import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

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
