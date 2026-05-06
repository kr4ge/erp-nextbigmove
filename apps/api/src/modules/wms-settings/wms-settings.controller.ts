import { Body, Controller, Delete, Get, Param, Patch, Post, Request, UseGuards } from '@nestjs/common';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { WmsAccessGuard } from '../../common/guards/wms-access.guard';
import { CreateWmsSettingsRoleDto, UpdateWmsSettingsRoleDto } from './dto/wms-settings-role.dto';
import { CreateWmsSettingsUserDto, UpdateWmsSettingsUserDto } from './dto/wms-settings-user.dto';
import { WmsSettingsService } from './wms-settings.service';

@Controller('wms/settings')
@UseGuards(JwtAuthGuard, WmsAccessGuard)
export class WmsSettingsController {
  constructor(private readonly wmsSettingsService: WmsSettingsService) {}

  @Get('users')
  @Permissions('wms.users.read')
  async listUsers(@Request() req) {
    return this.wmsSettingsService.listUsers(req.user, req);
  }

  @Get('users/options')
  @Permissions('wms.users.read', 'wms.users.write')
  async getUserOptions(@Request() req) {
    return this.wmsSettingsService.getUserOptions(req.user, req);
  }

  @Get('users/:id')
  @Permissions('wms.users.read')
  async getUser(@Request() req, @Param('id') id: string) {
    return this.wmsSettingsService.getUser(req.user, id, req);
  }

  @Post('users')
  @Permissions('wms.users.write')
  async createUser(@Request() req, @Body() body: CreateWmsSettingsUserDto) {
    return this.wmsSettingsService.createUser(req.user, body, req);
  }

  @Patch('users/:id')
  @Permissions('wms.users.write')
  async updateUser(
    @Request() req,
    @Param('id') id: string,
    @Body() body: UpdateWmsSettingsUserDto,
  ) {
    return this.wmsSettingsService.updateUser(req.user, id, body, req);
  }

  @Delete('users/:id')
  @Permissions('wms.users.write')
  async deactivateUser(@Request() req, @Param('id') id: string) {
    return this.wmsSettingsService.deactivateUser(req.user, id, req);
  }

  @Get('roles')
  @Permissions('wms.roles.read')
  async listRoles(@Request() req) {
    return this.wmsSettingsService.listRoles(req.user, req);
  }

  @Get('roles/options')
  @Permissions('wms.roles.read', 'wms.roles.write')
  async getRoleOptions(@Request() req) {
    return this.wmsSettingsService.getRoleOptions(req.user, req);
  }

  @Get('roles/:id')
  @Permissions('wms.roles.read')
  async getRole(@Request() req, @Param('id') id: string) {
    return this.wmsSettingsService.getRole(req.user, id, req);
  }

  @Post('roles')
  @Permissions('wms.roles.write')
  async createRole(@Request() req, @Body() body: CreateWmsSettingsRoleDto) {
    return this.wmsSettingsService.createRole(req.user, body, req);
  }

  @Patch('roles/:id')
  @Permissions('wms.roles.write')
  async updateRole(
    @Request() req,
    @Param('id') id: string,
    @Body() body: UpdateWmsSettingsRoleDto,
  ) {
    return this.wmsSettingsService.updateRole(req.user, id, body, req);
  }

  @Delete('roles/:id')
  @Permissions('wms.roles.write')
  async deleteRole(@Request() req, @Param('id') id: string) {
    return this.wmsSettingsService.deleteRole(req.user, id, req);
  }
}
