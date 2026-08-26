import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class GetCeoDashboardQueryDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsString()
  @MaxLength(100)
  accountId?: string;

  /**
   * Comma-separated Pancake shop ids. Empty means every store in range.
   * Scopes every reconciled figure to the selected stores.
   */
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value !== 'string' || !value.trim()) return undefined;
    const ids = value.split(',').map((id) => id.trim()).filter(Boolean);
    return ids.length ? ids : undefined;
  })
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(200)
  shopIds?: string[];
}
