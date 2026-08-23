import { CreativeStatusDimension } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class TransitionCreativeStatusDto {
  @IsEnum(CreativeStatusDimension)
  dimension!: CreativeStatusDimension;

  @Transform(({ value }) => typeof value === 'string' ? value.trim().toUpperCase() : value)
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  toStatus!: string;

  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
