import { Transform } from 'class-transformer';
import { CreativeKind } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUrl, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { NO_UNDERSCORE } from './enroll-creative.dto';

export class UpdateCreativeDto {
  /**
   * A registration mistake (enrolled as Static when it was actually Video, or
   * the reverse). The code's V/I letter is minted once and never reissued —
   * changing kind here relabels the creative without touching its code, so an
   * already-pasted ad name keeps matching.
   */
  @IsOptional()
  @IsEnum(CreativeKind)
  kind?: CreativeKind;

  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  @Matches(NO_UNDERSCORE.pattern, { message: NO_UNDERSCORE.message })
  title?: string;

  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @ValidateIf((_, value) => value !== '')
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
  @IsString()
  @MaxLength(20000)
  script?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;
}
