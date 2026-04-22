import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

class CreateWmsReceivingLineDto {
  @IsOptional()
  @IsUUID()
  profileId?: string;

  @IsUUID()
  @IsOptional()
  purchasingBatchLineId?: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  receiveQuantity!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitCost?: number;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  notes?: string;
}

export class CreateWmsReceivingBatchDto {
  @IsOptional()
  @IsUUID()
  purchasingBatchId?: string;

  @IsOptional()
  @IsUUID()
  storeId?: string;

  @IsUUID()
  warehouseId!: string;

  @IsUUID()
  stagingLocationId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  notes?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateWmsReceivingLineDto)
  lines?: CreateWmsReceivingLineDto[];
}
