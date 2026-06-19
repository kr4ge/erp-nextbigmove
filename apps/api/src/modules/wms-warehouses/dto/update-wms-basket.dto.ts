import { WmsBasketStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Matches, MaxLength, Min, MinLength } from 'class-validator';

export class UpdateWmsBasketDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  @Matches(/^[A-Za-z0-9-_]+$/, {
    message: 'Basket barcode must use letters, numbers, hyphens, or underscores',
  })
  barcode?: string;

  @IsOptional()
  @IsEnum(WmsBasketStatus)
  status?: WmsBasketStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxFulfillmentOrders?: number;
}
