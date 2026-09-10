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

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(100)
  maxBudgetUsd!: number;

  @IsBoolean()
  allowRunOverrides!: boolean;
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
