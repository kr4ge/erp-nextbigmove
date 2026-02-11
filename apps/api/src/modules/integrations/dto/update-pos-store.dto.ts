import { IsNumber, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdatePosStoreDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  initialValueOffer?: number | null;
}
