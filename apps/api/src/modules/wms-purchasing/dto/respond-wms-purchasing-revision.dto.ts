import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export const WMS_PURCHASING_REVISION_DECISIONS = ['ACCEPT', 'REJECT'] as const;

export class RespondWmsPurchasingRevisionDto {
  @IsEnum(WMS_PURCHASING_REVISION_DECISIONS)
  decision!: 'ACCEPT' | 'REJECT';

  @IsOptional()
  @IsString()
  @MaxLength(400)
  message?: string;
}
