import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/** One product's pixel and landing page. */
export class ProductDestinationDto {
  @IsString() @MaxLength(120)
  posCustomId!: string;

  @IsOptional() @IsString() @MaxLength(255)
  posProductName?: string | null;

  @IsString() @Matches(/^\d{6,32}$/, { message: 'pixelId must be the numeric Meta pixel (dataset) id' })
  pixelId!: string;

  @IsString() @IsUrl({ require_protocol: true, protocols: ['https'] }, { message: 'landingPageUrl must be a live https URL' }) @MaxLength(2048)
  landingPageUrl!: string;

  @IsOptional() @IsString() @MaxLength(255)
  displayLink?: string | null;
}

/**
 * Where a store launches. Every field is optional at save time so the panel
 * can be filled in over several visits; the draft worker is what refuses to
 * run while anything is missing, and it names the gap.
 */
export class UpsertCreativeStorePublishingDto {
  @IsOptional() @IsString() @Matches(/^\d{6,32}$/, { message: 'metaAdAccountId must be the numeric account id, without act_' })
  metaAdAccountId?: string | null;

  @IsOptional() @IsString() @Matches(/^\d{6,32}$/, { message: 'facebookPageId must be the numeric page id' })
  facebookPageId?: string | null;

  @IsOptional() @IsString() @MaxLength(255)
  facebookPageName?: string | null;

  @IsOptional() @IsString() @Matches(/^\d{6,32}$/, { message: 'instagramAccountId must be the numeric Instagram account id' })
  instagramAccountId?: string | null;

  @IsOptional() @IsString() @MaxLength(255)
  instagramUsername?: string | null;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(1)
  defaultDailyBudget?: number | null;

  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @Matches(/^[A-Za-z]{2}$/, { each: true, message: 'countries must be ISO-3166 two-letter codes' })
  countries?: string[];

  @IsOptional() @IsString() @MaxLength(64)
  timezone?: string;

  @IsOptional() @IsArray() @ArrayMaxSize(200) @ValidateNested({ each: true }) @Type(() => ProductDestinationDto)
  products?: ProductDestinationDto[];
}
