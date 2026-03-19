import { IsIn, IsInt } from 'class-validator';

export class UpdateConfirmationOrderStatusDto {
  @IsInt()
  @IsIn([1, 6, 7, 11])
  status!: number;
}
