import { IsString, IsNotEmpty, IsOptional, IsObject, IsEnum, IsUUID, IsArray, ArrayNotEmpty, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

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

export class BulkPosEntry {
  @IsString()
  @IsNotEmpty()
  apiKey: string;
}

export class BulkCreatePosIntegrationDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => BulkPosEntry)
  integrations: BulkPosEntry[];

  @IsUUID()
  @IsOptional()
  teamId?: string;

  @IsArray()
  @IsUUID('all', { each: true })
  @IsOptional()
  sharedTeamIds?: string[];
}
