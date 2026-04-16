import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export class ManualMetaUploadRowDto {
  @IsString()
  @IsNotEmpty()
  accountId: string;

  @IsString()
  @IsNotEmpty()
  campaignId: string;

  @IsString()
  @IsNotEmpty()
  campaignName: string;

  @IsString()
  @IsNotEmpty()
  adsetId: string;

  @IsString()
  @IsOptional()
  adsetName?: string;

  @IsString()
  @IsNotEmpty()
  adId: string;

  @IsString()
  @IsNotEmpty()
  adName: string;

  @IsString()
  @IsOptional()
  dateCreated?: string;

  @IsNumber()
  amountSpent: number;

  @IsNumber()
  linkClicks: number;

  @IsNumber()
  clicks: number;

  @IsNumber()
  impressions: number;

  @IsNumber()
  websitePurchases: number;

  @IsString()
  @IsNotEmpty()
  reportingStarts: string;

  @IsString()
  @IsNotEmpty()
  reportingEnds: string;
}

export class ManualMetaUploadDto {
  @IsUUID()
  @IsOptional()
  integrationId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ManualMetaUploadRowDto)
  rows: ManualMetaUploadRowDto[];
}
