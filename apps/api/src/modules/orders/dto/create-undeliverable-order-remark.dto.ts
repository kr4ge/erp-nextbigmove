import { IsUUID } from 'class-validator';

export class CreateUndeliverableOrderRemarkDto {
  @IsUUID()
  remarkOptionId!: string;
}
