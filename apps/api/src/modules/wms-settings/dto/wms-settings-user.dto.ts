import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateWmsSettingsUserDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(100)
  password: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  firstName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  lastName: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  employeeId?: string | null;

  @IsUUID()
  roleId: string;

  @IsEnum(['ACTIVE', 'INACTIVE', 'INVITED', 'SUSPENDED'])
  @IsOptional()
  status?: string;
}

export class UpdateWmsSettingsUserDto {
  @IsString()
  @IsOptional()
  @MaxLength(50)
  firstName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  lastName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  employeeId?: string | null;

  @IsString()
  @MinLength(8)
  @MaxLength(100)
  @IsOptional()
  password?: string;

  @IsUUID()
  @IsOptional()
  roleId?: string;

  @IsEnum(['ACTIVE', 'INACTIVE', 'INVITED', 'SUSPENDED'])
  @IsOptional()
  status?: string;
}
