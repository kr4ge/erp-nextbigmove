import { WmsWarehouseStatus } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateWmsWarehouseDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(24)
  @Matches(/^[A-Za-z0-9-]+$/, {
    message: 'Warehouse code must use letters, numbers, or hyphens',
  })
  code: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(80)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  billingCompanyName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  billingAddress?: string;

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
  @MaxLength(80)
  bankAccountNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  bankAccountType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  bankBranch?: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  paymentInstructions?: string;

  @IsOptional()
  @IsEnum(WmsWarehouseStatus)
  status?: WmsWarehouseStatus;

  @IsOptional()
  @IsBoolean()
  autoSeedOperationalLocations?: boolean;
}
