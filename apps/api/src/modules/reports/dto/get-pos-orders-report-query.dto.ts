import { IsOptional, Matches } from 'class-validator';

export class GetPosOrdersReportQueryDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'start_date must be in YYYY-MM-DD format',
  })
  start_date?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'end_date must be in YYYY-MM-DD format',
  })
  end_date?: string;
}
