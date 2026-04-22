import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateWmsInventoryTransferDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID(undefined, { each: true })
  unitIds!: string[];

  @IsUUID()
  targetLocationId!: string;

  @IsOptional()
  @Type(() => String)
  @IsString()
  @MaxLength(400)
  notes?: string;
}
