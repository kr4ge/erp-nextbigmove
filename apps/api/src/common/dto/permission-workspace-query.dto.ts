import { IsIn, IsOptional } from 'class-validator';
import { PERMISSION_WORKSPACES, type PermissionWorkspace } from '../rbac/permission-workspace';

export class PermissionWorkspaceQueryDto {
  @IsOptional()
  @IsIn(PERMISSION_WORKSPACES)
  workspace?: PermissionWorkspace;
}
