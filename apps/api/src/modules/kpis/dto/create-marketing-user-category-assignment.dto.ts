import { IsEnum, IsString } from 'class-validator';
import { MarketingKpiCategoryDto } from './marketing-kpi-metric.dto';

export class CreateMarketingUserCategoryAssignmentDto {
  @IsString()
  userId!: string;

  @IsString()
  teamCode!: string;

  @IsEnum(MarketingKpiCategoryDto)
  category!: MarketingKpiCategoryDto;
}
