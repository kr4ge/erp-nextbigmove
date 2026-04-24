import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionWorkspaceQueryDto } from '../../common/dto/permission-workspace-query.dto';
import { normalizePermissionWorkspace } from '../../common/rbac/permission-workspace';

@Controller('roles')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @Permissions('permission.assign')
  async list(@Query() query: PermissionWorkspaceQueryDto) {
    return this.rolesService.list(normalizePermissionWorkspace(query.workspace));
  }

  @Get('permissions')
  @Permissions('permission.assign')
  async listPermissions(@Query() query: PermissionWorkspaceQueryDto) {
    return this.rolesService.listPermissions(normalizePermissionWorkspace(query.workspace));
  }

  @Post()
  @Permissions('permission.assign')
  async create(@Body() dto: CreateRoleDto, @Query() query: PermissionWorkspaceQueryDto) {
    return this.rolesService.create(dto, normalizePermissionWorkspace(query.workspace) === 'wms' ? 'wms' : 'erp');
  }

  @Patch(':id')
  @Permissions('permission.assign')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
    @Query() query: PermissionWorkspaceQueryDto,
  ) {
    return this.rolesService.update(id, dto, normalizePermissionWorkspace(query.workspace) === 'wms' ? 'wms' : 'erp');
  }

  @Delete(':id')
  @Permissions('permission.assign')
  async remove(@Param('id') id: string, @Query() query: PermissionWorkspaceQueryDto) {
    return this.rolesService.remove(id, normalizePermissionWorkspace(query.workspace) === 'wms' ? 'wms' : 'erp');
  }
}
