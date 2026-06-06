import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateWmsInventoryStoreTransferDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID(undefined, { each: true })
  unitIds!: string[];

  @IsUUID()
  targetStoreId!: string;

  @IsUUID()
  targetProfileId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  notes?: string;
}
