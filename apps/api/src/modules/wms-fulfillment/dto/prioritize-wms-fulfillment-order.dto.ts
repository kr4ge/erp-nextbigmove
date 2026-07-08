import { Type } from 'class-transformer';
import { ArrayNotEmpty, ArrayUnique, IsArray, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class PrioritizeWmsFulfillmentOrderDto {
  @IsUUID()
  orderId!: string;

  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @Type(() => String)
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  donorOrderIds!: string[];

  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}
