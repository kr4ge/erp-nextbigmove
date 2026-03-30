import { Type } from 'class-transformer';
import { IsEnum, IsNumber } from 'class-validator';

export enum TeamMarketingKpiMetricKey {
  TEAM_AD_SPEND = 'TEAM_AD_SPEND',
  TEAM_AR_PCT = 'TEAM_AR_PCT',
}

export enum UserMarketingKpiMetricKey {
  USER_CREATIVES_CREATED = 'USER_CREATIVES_CREATED',
  USER_AR_PCT = 'USER_AR_PCT',
}

export enum MarketingKpiCategoryDto {
  SCALING = 'SCALING',
  TESTING = 'TESTING',
}

export class TeamMarketingKpiMetricDto {
  @IsEnum(TeamMarketingKpiMetricKey)
  metricKey!: TeamMarketingKpiMetricKey;

  @Type(() => Number)
  @IsNumber()
  targetValue!: number;
}

export class UserMarketingKpiMetricDto {
  @IsEnum(UserMarketingKpiMetricKey)
  metricKey!: UserMarketingKpiMetricKey;

  @Type(() => Number)
  @IsNumber()
  targetValue!: number;
}
