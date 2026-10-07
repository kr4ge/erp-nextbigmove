import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/** Ad copy for one creative in the batch. Anything left blank falls back to the creative's own words. */
export class DraftCopyDto {
  @IsUUID()
  creativeId!: string;

  @IsOptional() @IsString() @MaxLength(2000)
  primaryText?: string | null;

  @IsOptional() @IsString() @MaxLength(255)
  headline?: string | null;
}

/**
 * What a person sends to Meta: which creatives, and the few things the SOP
 * leaves to them. One to three creatives, one store, one product; the service
 * checks all of that and says which rule was broken.
 */
export class PreflightMetaDraftDto {
  @IsUUID()
  storeConfigId!: string;

  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(3) @IsUUID('4', { each: true })
  creativeIds!: string[];

  @IsOptional() @IsString() @MaxLength(255) @Matches(/^[^\s].*$/, { message: 'campaignName must not start with whitespace' })
  campaignName?: string;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(1)
  dailyBudget?: number;

  /** YYYY-MM-DD in the store's timezone; defaults to tomorrow. */
  @IsOptional() @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'startDate must be YYYY-MM-DD' })
  startDate?: string;

  @IsOptional() @IsArray() @ArrayMaxSize(3) @ValidateNested({ each: true }) @Type(() => DraftCopyDto)
  copy?: DraftCopyDto[];
}

export class SendMetaDraftDto extends PreflightMetaDraftDto {}

export class ListDraftBatchesQueryDto {
  @IsOptional() @IsUUID()
  storeId?: string;

  @IsOptional() @IsIn(['QUEUED', 'RUNNING', 'COMPLETED', 'FAILED'])
  status?: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  take?: number;
}

/** Filters for the handoff queue. */
export class HandoffQueryDto {
  @IsOptional() @IsUUID()
  storeId?: string;

  @IsOptional() @IsIn(['APPROVE', 'REVISE', 'REJECT', 'UNREVIEWED'])
  tag?: 'APPROVE' | 'REVISE' | 'REJECT' | 'UNREVIEWED';

  @IsOptional() @IsIn(['PENDING', 'SENT', 'ALL'])
  sent?: 'PENDING' | 'SENT' | 'ALL';

  @IsOptional() @IsString() @MaxLength(120)
  query?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  pageSize?: number;
}
