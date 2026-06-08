import { Type } from 'class-transformer';
import {
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class VoidWmsInventoryUnitDto {
  @Type(() => String)
  @IsString()
  @MinLength(3)
  @MaxLength(400)
  reason!: string;

  @IsOptional()
  @Type(() => String)
  @IsString()
  @MaxLength(800)
  notes?: string;
}
