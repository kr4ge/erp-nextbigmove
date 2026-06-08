import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateWmsBasketDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  @Matches(/^[A-Za-z0-9-_]+$/, {
    message: 'Basket barcode must use letters, numbers, hyphens, or underscores',
  })
  barcode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  notes?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  maxFulfillmentOrders?: number;
}
