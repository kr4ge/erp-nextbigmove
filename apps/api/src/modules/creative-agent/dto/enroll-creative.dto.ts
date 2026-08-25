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
  title!: string;

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
