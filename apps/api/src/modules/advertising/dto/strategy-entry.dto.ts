import { AdStrategyTag } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateStrategyEntryDto {
  /** The day the change took effect, not the day it was typed up. */
  @IsDateString()
  date!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsEnum(AdStrategyTag)
  tag?: AdStrategyTag;
}

export class RecordStrategyResultDto {
  @IsString()
  @MinLength(2)
  @MaxLength(2000)
  result!: string;
}
