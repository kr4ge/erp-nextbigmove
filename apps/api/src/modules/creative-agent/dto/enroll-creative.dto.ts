import { Transform } from 'class-transformer';
import { CreativeKind } from '@prisma/client';
import {
  IsEnum,
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * The paste-ready Meta ad name is `title_creator_CODE`, and auto-matching reads
 * the code from the LAST underscore-delimited segment. An underscore inside the
 * title adds a segment and silently breaks that match, so it is rejected here as
 * well as in the UI — the API is reachable without the form.
 */
export const NO_UNDERSCORE = {
  pattern: /^[^_]*$/,
  message: 'title must not contain underscores; they separate the parts of the Meta ad name',
} as const;

export class EnrollCreativeDto {
  @IsOptional()
  @IsBoolean()
  submitForApproval?: boolean;

  @IsUUID()
  storeId!: string;

  @IsEnum(CreativeKind)
  kind!: CreativeKind;

  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  @Matches(NO_UNDERSCORE.pattern, { message: NO_UNDERSCORE.message })
  title!: string;

  /**
   * The POS variation this creative advertises. Required: its customId is the
   * first segment of the generated ad name and becomes the reconciliation
   * mapping, so a creative without one cannot produce a new-convention name.
   */
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  variationId!: string;

  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @Matches(/^https:\/\/(?:[a-z0-9-]+\.)?(?:facebook\.com|fb\.com|fb\.watch)\//i, { message: 'mediaUrl must be a Facebook post URL' })
  @MaxLength(2048)
  mediaUrl?: string;

  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MaxLength(100)
  format?: string;

  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MaxLength(100)
  hookType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  script?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;
}

export class EnrollUnregisteredCreativeDto extends EnrollCreativeDto {
  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toUpperCase() : value)
  @Matches(/^[A-Z]{2,6}-V\d{3,6}$/)
  requestedCode?: string;

  @IsString()
  @MaxLength(255)
  adName!: string;

  @IsString()
  @MaxLength(100)
  accountId!: string;

  @IsString()
  @MaxLength(100)
  adId!: string;
}
