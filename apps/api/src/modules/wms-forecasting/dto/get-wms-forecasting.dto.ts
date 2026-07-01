import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';

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

export class GetWmsForecastingDto {
  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @Transform(({ value }) => parseStringArray(value))
  @IsArray()
  @IsUUID('4', { each: true })
  storeIds: string[] = [];

  @IsOptional()
  @IsIn(['CYCLE', 'CUSTOM'])
  mode?: 'CYCLE' | 'CUSTOM';

  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'cycleDate must be in YYYY-MM-DD format',
  })
  cycleDate!: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'forecastStartDate must be in YYYY-MM-DD format',
  })
  forecastStartDate?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'forecastEndDate must be in YYYY-MM-DD format',
  })
  forecastEndDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1000)
  safetyStockPct?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(365)
  reorderTriggerDays?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(30)
  pastSalesWindowDays?: number;
}
