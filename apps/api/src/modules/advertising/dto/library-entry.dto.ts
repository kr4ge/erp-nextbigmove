import { AdLibraryFormat } from '@prisma/client';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateLibraryEntryDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  pageName!: string;

  @IsOptional()
  @IsUrl({ require_protocol: true }, { message: 'Source must be a full URL' })
  @MaxLength(600)
  sourceUrl?: string;

  @IsOptional()
  @IsEnum(AdLibraryFormat)
  format?: AdLibraryFormat;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  headline?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  bodyCopy?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  ctaText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  tags?: string[];
}
