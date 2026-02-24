import { IsBoolean } from 'class-validator';

export class UpdatePancakeWebhookDto {
  @IsBoolean()
  enabled: boolean;
}

