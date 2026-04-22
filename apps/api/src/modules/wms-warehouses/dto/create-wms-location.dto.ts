import { WmsLocationKind } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateWmsLocationDto {
  @IsOptional()
  @IsUUID()
  parentId?: string;

  @IsEnum(WmsLocationKind)
  kind: WmsLocationKind;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(24)
  @Matches(/^[A-Za-z0-9-]+$/, {
    message: 'Location code must use letters, numbers, or hyphens',
  })
  code?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  sortOrder?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000000)
  capacity?: number;
}
