import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsPositive, IsUUID } from 'class-validator';

export class ManualMetaUploadFileDto {
  @IsUUID()
  @IsOptional()
  integrationId?: string;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  @IsOptional()
  currencyMultiplier?: number;
}
