import { Type } from 'class-transformer';
import { IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { BillingAddressDto } from '../../../common/dto/billing-address.dto';

export class UpsertWmsCompanyBillingSettingsDto {
  @IsString()
  @MaxLength(160)
  companyName!: string;

  @ValidateNested()
  @Type(() => BillingAddressDto)
  billingAddress!: BillingAddressDto;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  bankName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  bankAccountName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  bankAccountNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  bankAccountType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
