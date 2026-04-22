import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SubmitWmsPurchasingPaymentProofDto {
  @IsString()
  @MaxLength(1024)
  paymentProofImageUrl!: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  message?: string;
}
