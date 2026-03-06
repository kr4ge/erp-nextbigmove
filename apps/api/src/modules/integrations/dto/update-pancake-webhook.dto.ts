import { IsBoolean, IsOptional } from 'class-validator';

export class UpdatePancakeWebhookDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  reconcileEnabled?: boolean;
}
