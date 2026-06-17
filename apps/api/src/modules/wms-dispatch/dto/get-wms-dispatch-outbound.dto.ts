import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { GetWmsDispatchSummaryDto } from './get-wms-dispatch-summary.dto';

const DISPATCH_OUTBOUND_STATUSES = ['PACKED', 'SHIPPED', 'DELIVERED'] as const;

export class GetWmsDispatchOutboundDto extends GetWmsDispatchSummaryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsIn(DISPATCH_OUTBOUND_STATUSES)
  status?: (typeof DISPATCH_OUTBOUND_STATUSES)[number];

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
