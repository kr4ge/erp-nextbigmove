import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { CREATIVE_CODE_EXACT_REGEX } from '../creative-agent.constants';

export class CreateStrategyEntryDto {
  /**
   * The day the change took effect. Absent means today in Manila — the service
   * resolves it, because a server running in UTC would stamp an evening entry
   * with tomorrow's date.
   */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD' })
  date?: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(2000)
  description?: string;

  /**
   * Free text on purpose: the known list covers the usual moves, and a typed-in
   * type is stored as-is so the vocabulary can grow without a migration.
   */
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().slice(0, 32) : value))
  @IsString()
  @MaxLength(32)
  tag?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @Matches(CREATIVE_CODE_EXACT_REGEX, { message: 'creativeCode must be a registry code like TB-V0001 or TB-I0002' })
  creativeCode?: string;
}

export class UpdateStrategyResultDto {
  /**
   * Empty clears the result — an outcome recorded too early should be
   * retractable, not permanent.
   */
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(2000)
  result?: string;
}
