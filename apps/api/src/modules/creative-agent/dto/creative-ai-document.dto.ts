import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

/**
 * Metadata sent beside an uploaded reference document. The file itself
 * arrives as multipart; everything here says who the document is for.
 */
export class UploadCreativeAiDocumentDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsIn(['TENANT', 'STORE', 'PRODUCT'])
  scope: 'TENANT' | 'STORE' | 'PRODUCT' = 'TENANT';

  /** Required for STORE and PRODUCT scope: the store the document belongs to. */
  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsUUID()
  storeConfigId?: string;

  /** Required for PRODUCT scope: the registered product name it applies to. */
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(200)
  productName?: string;

  /** Shown to the model and cited in results. Defaults to the file name. */
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(160)
  title?: string;
}
