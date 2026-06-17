import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { GetWmsDispatchSummaryDto } from './get-wms-dispatch-summary.dto';

export class GetWmsDispatchReportsDto extends GetWmsDispatchSummaryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(7)
  @Max(30)
  days?: number;
}
