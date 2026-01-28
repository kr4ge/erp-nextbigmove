import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength, IsUUID, IsEnum, IsArray } from 'class-validator';

export class CreateUserDto {
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

  @IsEnum(['ADMIN', 'USER', 'VIEWER', 'SUPER_ADMIN'])
  @IsOptional()
  role?: string;

  @IsUUID()
  @IsOptional()
  teamId?: string;

  // Tenant-scoped role assignment
  @IsUUID()
  @IsOptional()
  roleId?: string;

  // Optional team-scoped role assignment
  @IsUUID()
  @IsOptional()
  teamRoleId?: string;
}
