import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class SubmitWmsPurchasingPaymentProofDto {
  @IsOptional()
  @IsString()
  @MaxLength(1024)
  paymentProofImageUrl?: string;

  @IsOptional()
  @IsUUID('4')
  paymentProofAssetId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  message?: string;
}
