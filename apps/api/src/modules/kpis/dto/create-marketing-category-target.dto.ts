import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDateString, IsEnum, IsOptional, IsString, MinLength, ValidateNested } from 'class-validator';
import { MarketingKpiCategoryDto, UserMarketingKpiMetricDto } from './marketing-kpi-metric.dto';

export class CreateMarketingCategoryTargetDto {
  @IsString()
  @MinLength(1)
  teamCode!: string;

  @IsEnum(MarketingKpiCategoryDto)
  category!: MarketingKpiCategoryDto;

  @IsDateString()
  startDate!: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UserMarketingKpiMetricDto)
  metrics!: UserMarketingKpiMetricDto[];
}
