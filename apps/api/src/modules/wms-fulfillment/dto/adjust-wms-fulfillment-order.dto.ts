import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export enum WmsFulfillmentAdjustmentActionDto {
  BYPASS = 'BYPASS',
  SUBSTITUTION = 'SUBSTITUTION',
}

export class AdjustWmsFulfillmentOrderDto {
  @IsUUID()
  orderId!: string;

  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @IsUUID()
  sourceLineId!: string;

  @IsEnum(WmsFulfillmentAdjustmentActionDto)
  action!: WmsFulfillmentAdjustmentActionDto;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  quantity!: number;

  @ValidateIf((value: AdjustWmsFulfillmentOrderDto) => (
    value.action === WmsFulfillmentAdjustmentActionDto.SUBSTITUTION
  ))
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  substituteVariationId?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedSourceRevision!: number;

  @IsString()
  @MinLength(10)
  @MaxLength(500)
  reason!: string;
}
