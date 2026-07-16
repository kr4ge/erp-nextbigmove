import { IsUUID } from 'class-validator';

export class UpdateUndeliverableOrderRemarkDto {
  @IsUUID()
  remarkOptionId!: string;
}
