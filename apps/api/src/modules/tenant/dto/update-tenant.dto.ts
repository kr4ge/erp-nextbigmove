import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
  Max,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BillingAddressDto } from '../../../common/dto/billing-address.dto';

export class UpdateTenantDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(50)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Tenant slug must be lowercase alphanumeric with hyphens',
  })
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  companyName?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => BillingAddressDto)
  billingAddress?: BillingAddressDto;

  @IsOptional()
  @IsUUID()
  partnerTypeId?: string;

  @IsOptional()
  @IsEnum(['trial', 'starter', 'professional', 'enterprise'])
  planType?: string;

  @IsOptional()
  @IsEnum(['TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED'])
  status?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10000)
  maxUsers?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  maxIntegrations?: number;
}
