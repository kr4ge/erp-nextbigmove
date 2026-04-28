import { IsOptional, IsUUID } from 'class-validator';

export class ManualMetaUploadFileDto {
  @IsUUID()
  @IsOptional()
  integrationId?: string;
}

