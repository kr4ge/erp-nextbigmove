import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsObject,
  ValidateNested,
  IsInt,
  Min,
  IsIn,
  ValidateIf,
  IsUUID,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';

// Date range configuration (shared for all sources)
export class WorkflowDateRangeDto {
  @IsString()
  @IsIn(['rolling', 'relative', 'absolute'])
  type: 'rolling' | 'relative' | 'absolute';

  @ValidateIf((o) => o.type === 'rolling')
  @IsInt()
  @Min(0)
  offsetDays?: number; // 0 = today, 1 = yesterday, etc.

  @ValidateIf((o) => o.type === 'relative')
  @IsInt()
  @Min(1)
  days?: number;

  @ValidateIf((o) => o.type === 'absolute')
  @IsString()
  @IsNotEmpty()
  since?: string; // YYYY-MM-DD

  @ValidateIf((o) => o.type === 'absolute')
  @IsString()
  @IsNotEmpty()
  until?: string; // YYYY-MM-DD
}

// Source configuration
export class SourceConfigDto {
  @IsBoolean()
  enabled: boolean;

  // Legacy per-source date range (optional; use workflow-level dateRange instead)
  @IsObject()
  @ValidateNested()
  @IsOptional()
  @Type(() => WorkflowDateRangeDto)
  dateRange?: WorkflowDateRangeDto;
}

export class SourcesConfigDto {
  @IsObject()
  @ValidateNested()
  @Type(() => SourceConfigDto)
  meta: SourceConfigDto;

  @IsObject()
  @ValidateNested()
  @Type(() => SourceConfigDto)
  pos: SourceConfigDto;
}

export class RateLimitConfigDto {
  @IsInt()
  @Min(0)
  metaDelayMs: number;

  @IsInt()
  @Min(0)
  posDelayMs: number;
}

export class WorkflowConfigDto {
  @IsObject()
  @ValidateNested()
  @Type(() => SourcesConfigDto)
  sources: SourcesConfigDto;

  @IsObject()
  @ValidateNested()
  @Type(() => WorkflowDateRangeDto)
  dateRange: WorkflowDateRangeDto;

  @IsObject()
  @ValidateNested()
  @Type(() => RateLimitConfigDto)
  @IsOptional()
  rateLimit?: RateLimitConfigDto;
}

export class CreateWorkflowDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  schedule?: string; // Cron expression

  @IsObject()
  @ValidateNested()
  @Type(() => WorkflowConfigDto)
  config: WorkflowConfigDto;

  @IsString()
  @IsUUID()
  @IsOptional()
  teamId?: string;

  @IsArray()
  @IsUUID('all', { each: true })
  @IsOptional()
  sharedTeamIds?: string[];
}
