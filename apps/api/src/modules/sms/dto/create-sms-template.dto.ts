import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateSmsTemplateDto {
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsString()
  @MaxLength(160)
  body!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
