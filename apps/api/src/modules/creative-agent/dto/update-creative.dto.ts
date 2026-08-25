import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUrl, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator';

export class UpdateCreativeDto {
  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
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
  @IsString()
  @MaxLength(20000)
  script?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;
}
