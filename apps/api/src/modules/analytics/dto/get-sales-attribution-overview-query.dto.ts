import { Transform } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

function parseBoolean(value: unknown, defaultValue: boolean) {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  if (typeof value === 'string') {
    return !['false', '0', 'no', 'off'].includes(value.toLowerCase());
  }

  return defaultValue;
}

function parseStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .flatMap((entry) => String(entry).split(','))
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }

  return [];
}

export class GetSalesAttributionOverviewQueryDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'start_date must be in YYYY-MM-DD format',
  })
  start_date?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'end_date must be in YYYY-MM-DD format',
  })
  end_date?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  team_code?: string;

  @Transform(({ value }) => parseStringArray(value))
  @IsArray()
  @IsString({ each: true })
  mapping: string[] = [];

  @Transform(({ value }) => parseBoolean(value, true))
  @IsBoolean()
  exclude_cancel = true;

  @Transform(({ value }) => parseBoolean(value, true))
  @IsBoolean()
  exclude_restocking = true;

  @Transform(({ value }) => parseBoolean(value, true))
  @IsBoolean()
  exclude_abandoned = true;

  @Transform(({ value }) => parseBoolean(value, true))
  @IsBoolean()
  exclude_rts = true;

  @Transform(({ value }) => parseBoolean(value, false))
  @IsBoolean()
  include_tax_12 = false;

  @Transform(({ value }) => parseBoolean(value, false))
  @IsBoolean()
  include_tax_1 = false;
}
