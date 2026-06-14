import { ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';

export class ResetWmsReceivingPutawayDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  unitIds!: string[];
}
