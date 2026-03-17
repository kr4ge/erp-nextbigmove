import { IsBoolean, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpdatePancakeWebhookDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  autoCancelEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  reconcileEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(3600)
  reconcileIntervalSeconds?: number;

  @IsOptional()
  @IsIn(['incremental', 'full_reset'])
  reconcileMode?: 'incremental' | 'full_reset';
}
