import { IsUUID } from 'class-validator';

export class CreateUndeliverableOrderRemarkDto {
  @IsUUID('4')
  remarkOptionId!: string;
}
