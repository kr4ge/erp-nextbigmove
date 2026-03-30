import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDateString, IsOptional, IsString, MinLength, ValidateNested } from 'class-validator';
import { TeamMarketingKpiMetricDto } from './marketing-kpi-metric.dto';

export class CreateMarketingTeamTargetDto {
  @IsString()
  @MinLength(1)
  teamCode!: string;

  @IsDateString()
  startDate!: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TeamMarketingKpiMetricDto)
  metrics!: TeamMarketingKpiMetricDto[];
}
