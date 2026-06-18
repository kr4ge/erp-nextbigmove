import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { GetWmsDispatchSummaryDto } from './get-wms-dispatch-summary.dto';

const DISPATCH_RETURN_STATUSES = [
  'RETURNING',
  'RETURNED',
  'READY_TO_VERIFY',
  'AWAITING_PLACEMENT',
  'PARTIAL',
  'VERIFIED',
] as const;

export class GetWmsDispatchReturnsDto extends GetWmsDispatchSummaryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsIn(DISPATCH_RETURN_STATUSES)
  status?: (typeof DISPATCH_RETURN_STATUSES)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(50)
  pageSize?: number;
}
