import {
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateWmsSettingsRoleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Matches(/^[A-Za-z0-9_-]+$/, {
    message: 'Role key can only contain letters, numbers, underscores, and hyphens',
  })
  key: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  description?: string | null;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  permissionKeys: string[];
}

export class UpdateWmsSettingsRoleDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  @Matches(/^[A-Za-z0-9_-]+$/, {
    message: 'Role key can only contain letters, numbers, underscores, and hyphens',
  })
  key?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  description?: string | null;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @IsOptional()
  permissionKeys?: string[];
}
