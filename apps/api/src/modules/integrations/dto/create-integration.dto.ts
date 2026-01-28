import { IsString, IsNotEmpty, IsOptional, IsObject, IsEnum, IsUUID, IsArray, ArrayNotEmpty, IsUUID as IsUUIDEach } from 'class-validator';

export enum IntegrationProvider {
  META_ADS = 'META_ADS',
  PANCAKE_POS = 'PANCAKE_POS',
}

export class CreateIntegrationDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(IntegrationProvider)
  @IsNotEmpty()
  provider: IntegrationProvider;

  @IsString()
  @IsOptional()
  description?: string;

  @IsObject()
  @IsNotEmpty()
  credentials: Record<string, any>;

  @IsObject()
  @IsOptional()
  config?: Record<string, any>;

  @IsUUID()
  @IsOptional()
  teamId?: string;

  @IsArray()
  @IsUUID('all', { each: true })
  @IsOptional()
  sharedTeamIds?: string[];
}
