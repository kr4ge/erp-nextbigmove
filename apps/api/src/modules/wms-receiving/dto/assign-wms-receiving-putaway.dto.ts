import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsOptional,
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

  @IsOptional()
  @IsDateString({ strict: true })
  expirationDate?: string | null;
}

export class AssignWmsReceivingPutawayDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => AssignWmsReceivingPutawayUnitDto)
  assignments!: AssignWmsReceivingPutawayUnitDto[];
}
