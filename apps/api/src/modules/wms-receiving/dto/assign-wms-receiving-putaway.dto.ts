import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsUUID,
  ValidateNested,
} from 'class-validator';

class AssignWmsReceivingPutawayUnitDto {
  @IsUUID()
  unitId!: string;

  @IsUUID()
  sectionId!: string;

  @IsUUID()
  rackId!: string;

  @IsUUID()
  binId!: string;
}

export class AssignWmsReceivingPutawayDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => AssignWmsReceivingPutawayUnitDto)
  assignments!: AssignWmsReceivingPutawayUnitDto[];
}
