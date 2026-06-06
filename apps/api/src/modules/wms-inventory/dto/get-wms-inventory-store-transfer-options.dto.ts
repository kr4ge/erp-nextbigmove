import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class GetWmsInventoryStoreTransferOptionsDto {
  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @IsOptional()
  @IsUUID()
  targetStoreId?: string;

  @IsOptional()
  @IsUUID()
  sourceProfileId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
