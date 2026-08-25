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

  @IsNumber()
  @IsOptional()
  videoPlays3s?: number | null;

  @IsNumber()
  @IsOptional()
  thruPlays?: number | null;

  @IsNumber()
  @IsOptional()
  frequency?: number | null;

  @IsNumber()
  @IsOptional()
  videoAveragePlayTime?: number | null;

  @IsNumber()
  @IsOptional()
  videoPlays25?: number | null;

  @IsNumber()
  @IsOptional()
  videoPlays50?: number | null;

  @IsNumber()
  @IsOptional()
  videoPlays75?: number | null;

  @IsNumber()
  @IsOptional()
  videoPlays95?: number | null;

  @IsNumber()
  @IsOptional()
  videoPlays100?: number | null;

  @IsString()
  @IsOptional()
  spendCurrency?: string;

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
