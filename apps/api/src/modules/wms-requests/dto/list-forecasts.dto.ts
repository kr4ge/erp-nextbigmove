import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class ListWmsForecastsDto {
  @IsUUID()
  tenantId!: string;

  @IsOptional()
  @IsUUID()
  storeId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(['WMS_PROCUREMENT', 'PARTNER_SELF_BUY'])
  requestType?: 'WMS_PROCUREMENT' | 'PARTNER_SELF_BUY';

  @IsOptional()
  @IsDateString()
  runDate?: string;

  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null || value === ''
      ? undefined
      : value === true || value === 'true'
        ? true
        : value === false || value === 'false'
          ? false
          : value,
  )
  @IsBoolean()
  requestableOnly?: boolean;

  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null || value === ''
      ? undefined
      : value === true || value === 'true'
        ? true
        : value === false || value === 'false'
          ? false
          : value,
  )
  @IsBoolean()
  profileOnly?: boolean;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @Min(1)
  @Max(1000)
  limit?: number;
}
