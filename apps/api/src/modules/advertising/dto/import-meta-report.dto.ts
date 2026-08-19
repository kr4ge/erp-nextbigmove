import { IsOptional, IsString } from 'class-validator';

export class ImportMetaReportDto {
  /**
   * Which Meta integration the report belongs to. Optional — when omitted the
   * upload resolves it the same way the workflows path does.
   */
  @IsOptional()
  @IsString()
  integrationId?: string;
}
