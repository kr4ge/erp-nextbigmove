import { IsEmail, IsEnum, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class UpdateWmsUserDto {
  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsEnum(['ACTIVE', 'INACTIVE', 'INVITED', 'SUSPENDED'])
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  @MinLength(8)
  password?: string;

  @IsUUID()
  @IsOptional()
  roleId?: string;
}
