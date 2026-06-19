import { MaxLength, MinLength, IsString } from 'class-validator';
import { GetWmsDispatchSummaryDto } from './get-wms-dispatch-summary.dto';

export class VoidWmsDispatchOutboundDto extends GetWmsDispatchSummaryDto {
  @IsString()
  @MinLength(3)
  @MaxLength(240)
  reason!: string;
}
