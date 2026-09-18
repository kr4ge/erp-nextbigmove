import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/**
 * A store's target KPIs. Every field is optional: a store that has not decided
 * a target leaves it blank and the analysis is told so, rather than being
 * handed a made-up number. Rates are percentages, so 25 means 25%.
 */
export class UpsertCreativeStoreTargetDto {
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100)
  hookRatePct?: number | null;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100)
  holdRatePct?: number | null;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100)
  ctrPct?: number | null;

  /** Cost per purchase ceiling, in the store's currency. */
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  cpp?: number | null;

  /** Spend as a share of collected revenue. Lower is better, so this is a ceiling. */
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(1000)
  arPct?: number | null;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100)
  maxCancellationPct?: number | null;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100)
  maxRtsPct?: number | null;

  @IsOptional() @IsString() @MaxLength(500)
  note?: string | null;
}
