import { IsEmail, IsOptional, IsUUID } from 'class-validator';

/**
 * Grant an identity that already exists (in any tenant) membership in the
 * caller's tenant. No password: the account is theirs already.
 */
export class AddExistingUserDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsUUID()
  roleId?: string;

  @IsOptional()
  @IsUUID()
  wmsRoleId?: string;

  @IsOptional()
  @IsUUID()
  teamId?: string;

  @IsOptional()
  @IsUUID()
  teamRoleId?: string;
}
