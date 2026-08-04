import { IsBoolean, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class SendSmsMessageDto {
  @IsString()
  @MaxLength(32)
  recipientPhone!: string;

  @IsString()
  @MaxLength(160)
  body!: string;

  @IsOptional()
  @IsUUID()
  simId?: string;

  @IsOptional()
  @IsUUID()
  storeId?: string;

  @IsOptional()
  @IsUUID()
  posOrderId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  idempotencyKey?: string;

  @IsOptional()
  @IsBoolean()
  overrideSuppression?: boolean;
}
