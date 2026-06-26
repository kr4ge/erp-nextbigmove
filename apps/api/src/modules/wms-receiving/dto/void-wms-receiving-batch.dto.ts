import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class VoidWmsReceivingBatchDto {
  @IsString()
  @MinLength(3)
  @MaxLength(400)
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(800)
  notes?: string;
}
