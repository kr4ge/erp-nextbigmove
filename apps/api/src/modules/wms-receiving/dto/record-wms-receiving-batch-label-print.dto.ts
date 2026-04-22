import { IsIn, IsOptional } from 'class-validator';

const LABEL_PRINT_ACTIONS = ['PRINT', 'REPRINT'] as const;

export type WmsLabelPrintAction = (typeof LABEL_PRINT_ACTIONS)[number];

export class RecordWmsReceivingBatchLabelPrintDto {
  @IsOptional()
  @IsIn(LABEL_PRINT_ACTIONS)
  action?: WmsLabelPrintAction;
}
