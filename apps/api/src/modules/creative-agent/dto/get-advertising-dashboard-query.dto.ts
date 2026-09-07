import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsDateString, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class GetAdvertisingDashboardQueryDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsUUID()
  storeId?: string;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsString()
  @MaxLength(100)
  accountId?: string;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsUUID()
  creatorId?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value !== 'string' || !value.trim()) return undefined;
    const ids = value.split(',').map((id) => id.trim()).filter(Boolean);
    return ids.length ? ids : undefined;
  })
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(200)
  storeIds?: string[];

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value !== 'string' || !value.trim()) return undefined;
    const ids = value.split(',').map((id) => id.trim()).filter(Boolean);
    return ids.length ? ids : undefined;
  })
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(200)
  creatorIds?: string[];
}
