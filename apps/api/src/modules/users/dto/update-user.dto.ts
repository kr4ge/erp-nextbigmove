import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateUserDto {
  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsEnum(['ADMIN', 'USER', 'VIEWER', 'SUPER_ADMIN'])
  @IsOptional()
  role?: string;

  @IsEnum(['ACTIVE', 'INACTIVE', 'INVITED', 'SUSPENDED'])
  @IsOptional()
  status?: string;

  @IsUUID()
  @IsOptional()
  defaultTeamId?: string;

  @IsUUID()
  @IsOptional()
  roleId?: string;

  @IsUUID()
  @IsOptional()
  teamRoleId?: string;

  @IsUUID()
  @IsOptional()
  teamId?: string;
}
