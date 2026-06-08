import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

function parseBoolean(value: unknown, fallback: boolean) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  const normalized = String(value).trim().toLowerCase();
  if (normalized === 'true') {
    return true;
  }

  if (normalized === 'false') {
    return false;
  }

  return fallback;
}

export class CreateWmsStoxReleaseDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  @Matches(/^[0-9A-Za-z][0-9A-Za-z._-]*$/, {
    message: 'Version can only contain letters, numbers, dots, underscores, and hyphens',
  })
  version: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  buildNumber: number;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  releaseNotes?: string | null;

  @Transform(({ value }) => parseBoolean(value, true))
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class ImportWmsStoxReleaseDto extends CreateWmsStoxReleaseDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  sourceUrl: string;
}
