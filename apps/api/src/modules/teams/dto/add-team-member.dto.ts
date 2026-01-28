import { IsNotEmpty, IsUUID, IsOptional } from 'class-validator';

export class AddTeamMemberDto {
  @IsUUID()
  @IsNotEmpty()
  userId: string;

  @IsOptional()
  @IsUUID()
  roleId?: string;
}

