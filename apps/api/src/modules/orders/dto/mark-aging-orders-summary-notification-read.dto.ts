import { IsNotEmpty, IsString } from 'class-validator';

export class MarkAgingOrdersSummaryNotificationReadDto {
  @IsString()
  @IsNotEmpty()
  shop_id!: string;
}
