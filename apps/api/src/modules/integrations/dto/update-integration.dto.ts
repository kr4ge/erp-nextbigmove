import { IsString, IsOptional, IsObject, IsBoolean, IsUUID, IsArray } from 'class-validator';

export class UpdateIntegrationDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsObject()
  @IsOptional()
  credentials?: Record<string, any>;

  @IsObject()
  @IsOptional()
  config?: Record<string, any>;

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @IsUUID()
  @IsOptional()
  teamId?: string;

  @IsArray()
  @IsUUID('all', { each: true })
  @IsOptional()
  sharedTeamIds?: string[];
}
