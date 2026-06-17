import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsOptional, IsUUID } from 'class-validator';
import { GetWmsDispatchSummaryDto } from './get-wms-dispatch-summary.dto';

export class ReconcileWmsDispatchOutboundDto extends GetWmsDispatchSummaryDto {
  @IsOptional()
  @Type(() => String)
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('4', { each: true })
  taskIds?: string[];
}
