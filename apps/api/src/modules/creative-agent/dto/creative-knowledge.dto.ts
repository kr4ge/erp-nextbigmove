import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { CreativeKnowledgeLabel } from '@prisma/client';

export class PromoteKnowledgeEntryDto {
  /**
   * Which analysis to capture. Omitted means the creative's most recent
   * completed one.
   */
  @IsOptional()
  @IsUUID()
  runId?: string;

  /**
   * Override the computed label. Leave unset to let reconciled economics
   * decide, which is the auditable path.
   */
  @IsOptional()
  @IsEnum(CreativeKnowledgeLabel)
  label?: CreativeKnowledgeLabel;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  labelRationale?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  digest?: string;
}

export class ListKnowledgeEntriesQueryDto {
  @IsOptional()
  @IsUUID()
  storeId?: string;

  @IsOptional()
  @IsEnum(CreativeKnowledgeLabel)
  label?: CreativeKnowledgeLabel;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeRetired?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  take?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number;
}

export class RequestEnrollmentReviewDto {
  @IsUUID()
  creativeId!: string;

  @IsOptional()
  @IsUUID()
  runId?: string;

  /**
   * Shadow mode records what the gate would decide without it authorizing
   * anything. It defaults to true and should stay true until the calibration
   * endpoint says the gate agrees with people often enough.
   */
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  shadow?: boolean;
}

export class DecideEnrollmentReviewDto {
  @IsIn(['ACCEPTED', 'OVERRIDDEN'])
  outcome!: 'ACCEPTED' | 'OVERRIDDEN';

  /** Required when overriding: the disagreement is what calibrates the gate. */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class ListEnrollmentReviewsQueryDto {
  @IsOptional()
  @IsUUID()
  storeId?: string;

  @IsOptional()
  @IsUUID()
  creativeId?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  pendingOnly?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  take?: number;
}
