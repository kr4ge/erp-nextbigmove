import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdatePancakeWebhookRelayDto {
  @IsBoolean()
  enabled: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  webhookUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  headerKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  apiKey?: string;
}
