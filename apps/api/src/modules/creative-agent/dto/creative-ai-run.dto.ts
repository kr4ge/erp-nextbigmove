import { Type } from 'class-transformer';
import {
  IsDateString,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { CreativeAiEffort, CreativeAiProvider } from '@prisma/client';

export class StartCreativeAiRunDto {
  @IsUUID()
  creativeId!: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  question?: string;

  @IsOptional()
  @IsEnum(CreativeAiProvider)
  provider?: CreativeAiProvider;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Matches(/^[a-zA-Z0-9._-]+$/)
  model?: string;

  @IsOptional()
  @IsEnum(CreativeAiEffort)
  effort?: CreativeAiEffort;
}

export class UpdateCreativeAiPolicyDto {
  @IsEnum(CreativeAiProvider)
  defaultProvider!: CreativeAiProvider;

  @IsString()
  @MaxLength(100)
  @Matches(/^[a-zA-Z0-9._-]+$/)
  claudeModel!: string;

  @IsString()
  @MaxLength(100)
  @Matches(/^[a-zA-Z0-9._-]+$/)
  codexModel!: string;

  @IsEnum(CreativeAiEffort)
  defaultEffort!: CreativeAiEffort;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  maxTurns!: number;

  /** Wall-clock ceiling for one analysis. Runs are limited by time, not cost:
   *  the provider account is a flat-fee subscription. */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(60)
  maxRunMinutes!: number;

  @IsBoolean()
  allowRunOverrides!: boolean;
}

/** Per-store analysis context: which niche pack applies and any store-only rules. */
export class UpdateCreativeAiStoreContextDto {
  @IsString()
  @MaxLength(64)
  @Matches(/^[A-Z_]+$/)
  niche!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  storeRules?: string;
}

/** Advertiser-managed rules appended to every analysis prompt. Empty clears them. */
export class UpdateCreativeAiHouseRulesDto {
  @IsString()
  @MaxLength(6000)
  houseRules!: string;
}

export class SubmitCreativeAiProviderCodeDto {
  @IsString()
  @MaxLength(4096)
  @Matches(/^[^\r\n]+$/)
  code!: string;
}

export class ListCreativeAiRunsQueryDto {
  @IsOptional()
  @IsUUID()
  creativeId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize = 10;
}
