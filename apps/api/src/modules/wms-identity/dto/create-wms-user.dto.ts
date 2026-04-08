import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateWmsUserDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsEnum(['ACTIVE', 'INACTIVE', 'INVITED', 'SUSPENDED'])
  @IsOptional()
  status?: string;

  @IsUUID()
  @IsOptional()
  roleId?: string;
}
