import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDateString, IsOptional, IsString, ValidateNested } from 'class-validator';
import { UserMarketingKpiMetricDto } from './marketing-kpi-metric.dto';

export class CreateMarketingUserTargetDto {
  @IsString()
  userId!: string;

  @IsString()
  teamCode!: string;

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
