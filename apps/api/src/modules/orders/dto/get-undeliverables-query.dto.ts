import { IsIn, IsOptional, IsString } from 'class-validator';

export class GetUndeliverablesQueryDto {
  @IsOptional()
  @IsString()
  start_date?: string;

  @IsOptional()
  @IsString()
  end_date?: string;

  @IsOptional()
  store_id?: string | string[];

  @IsOptional()
  status?: string | string[];

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  @IsIn(['needs_remarks', 'with_remarks', 'unattended'])
  view?: string;

  @IsOptional()
  @IsString()
  @IsIn(['asc', 'desc'])
  failed_at_order?: string;

  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  limit?: string;
}
