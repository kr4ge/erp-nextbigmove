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
import { CREATIVE_CODE_EXACT_REGEX } from '../creative-agent.constants';

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
   * The POS variation this creative advertises, when there is one to name.
   *
   * Its customId leads the new-convention ad name and becomes the
   * reconciliation mapping, so supplying it is worth doing. It is not
   * required, though: a store whose Pancake products carry no custom IDs would
   * otherwise be unable to enroll anything at all, and the point of enrolment
   * is to mint a code and capture the Meta ad id. Without an item the ad name
   * falls back to the legacy `title_creator_CODE`, which the matcher still
   * links on its last segment.
   */
  @IsOptional()
  @Transform(({ value }) => value === '' ? undefined : value)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  variationId?: string;

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
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MaxLength(500)
  angle?: string;

  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toUpperCase() : value)
  @Matches(CREATIVE_CODE_EXACT_REGEX, { message: 'remixOfCode must be a registry code like TB-V0001 or TB-I0002' })
  remixOfCode?: string;

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
  @Matches(CREATIVE_CODE_EXACT_REGEX)
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
