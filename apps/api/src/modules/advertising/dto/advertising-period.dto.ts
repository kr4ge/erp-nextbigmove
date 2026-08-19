import { IsDateString, IsOptional, IsString } from 'class-validator';

export class AdvertisingPeriodDto {
  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  /** Meta ad account id, without the act_ prefix. Omit for every account. */
  @IsOptional()
  @IsString()
  accountId?: string;
}
