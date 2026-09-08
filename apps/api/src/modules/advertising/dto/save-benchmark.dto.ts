import { IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/**
 * Rates are fractions (0.55 = 55%), money is in pesos as the operator types it.
 * Bounds are wide on purpose — a benchmark is a business judgement, not a
 * validation problem — but they do rule out impossible values.
 */
export class SaveBenchmarkDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  label?: string;

  @IsNumber()
  @Min(0)
  cpp!: number;

  @IsNumber()
  @Min(0)
  cpm!: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  ctrPct!: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  deliveryRate!: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  cancelRate!: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  rtsRate!: number;

  @IsNumber()
  @Min(0)
  targetMer!: number;
}
