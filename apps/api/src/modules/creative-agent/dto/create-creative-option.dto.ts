import { Transform } from 'class-transformer';
import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

export const CREATIVE_OPTION_FIELDS = ['HOOK_TYPE', 'VIDEO_FORMAT', 'STATIC_FORMAT'] as const;
export type CreativeOptionFieldName = (typeof CREATIVE_OPTION_FIELDS)[number];

export class CreateCreativeOptionDto {
  @IsIn(CREATIVE_OPTION_FIELDS)
  field!: CreativeOptionFieldName;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  label!: string;
}
