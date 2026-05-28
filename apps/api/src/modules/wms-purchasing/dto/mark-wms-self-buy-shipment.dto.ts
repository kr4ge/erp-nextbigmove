import { IsOptional, IsString, MaxLength } from 'class-validator';

export class MarkWmsSelfBuyShipmentDto {
  @IsOptional()
  @IsString()
  @MaxLength(400)
  message?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  shipmentReference?: string;
}
