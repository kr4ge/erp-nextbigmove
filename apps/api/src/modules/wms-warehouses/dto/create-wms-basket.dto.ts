import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

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
}

