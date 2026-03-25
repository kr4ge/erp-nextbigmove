import { Type } from 'class-transformer';
import { IsArray, IsIn, IsInt, IsNumber, IsObject, IsOptional, IsString, MinLength, ValidateNested } from 'class-validator';

export class UpdateConfirmationOrderTagDto {
  @IsString()
  @MinLength(1)
  id!: string;

  @IsString()
  @MinLength(1)
  name!: string;
}

export class UpdateConfirmationOrderStatusDto {
  @IsOptional()
  @IsInt()
  @IsIn([1, 6, 7, 11])
  status?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateConfirmationOrderTagDto)
  tags?: UpdateConfirmationOrderTagDto[];

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  note_print?: string;

  @IsOptional()
  @IsObject()
  shipping_address?: Record<string, unknown>;

  @IsOptional()
  @IsNumber()
  shipping_fee?: number;

  @IsOptional()
  @IsNumber()
  total_discount?: number;

  @IsOptional()
  bank_payments?: unknown;

  @IsOptional()
  @IsNumber()
  surcharge?: number;
}
