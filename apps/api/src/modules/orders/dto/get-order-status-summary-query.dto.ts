import { IsOptional, IsString } from 'class-validator';

export class GetOrderStatusSummaryQueryDto {
  @IsOptional()
  @IsString()
  date_local?: string;

  @IsOptional()
  shop_id?: string | string[];
}
