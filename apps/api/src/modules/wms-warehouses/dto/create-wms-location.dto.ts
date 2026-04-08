import { WmsLocationStatus, WmsLocationType } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateWmsLocationDto {
  @IsString()
  @MaxLength(120)
  code!: string;

  @IsString()
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsEnum(WmsLocationType)
  type?: WmsLocationType;

  @IsOptional()
  @IsEnum(WmsLocationStatus)
  status?: WmsLocationStatus;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsUUID()
  parentId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  barcode?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  capacityUnits?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
