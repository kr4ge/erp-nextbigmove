import { IsDateString, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { MarketingKpiCategoryDto } from './marketing-kpi-metric.dto';

export enum MarketingKpiTargetGroupScopeDto {
  TEAM = 'TEAM',
  CATEGORY = 'CATEGORY',
}

export class DeleteMarketingTargetGroupDto {
  @IsString()
  @MinLength(1)
  teamCode!: string;

  @IsEnum(MarketingKpiTargetGroupScopeDto)
  scopeType!: MarketingKpiTargetGroupScopeDto;

  @IsDateString()
  startDate!: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsEnum(MarketingKpiCategoryDto)
  category?: MarketingKpiCategoryDto;
}
