import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateWmsRoleDto } from './dto/create-wms-role.dto';
import { CreateWmsUserDto } from './dto/create-wms-user.dto';
import { UpdateWmsRoleDto } from './dto/update-wms-role.dto';
import { UpdateWmsUserDto } from './dto/update-wms-user.dto';
import { WmsIdentityService } from './wms-identity.service';

@Controller('wms/settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class WmsIdentityController {
  constructor(private readonly wmsIdentityService: WmsIdentityService) {}

  @Get('users')
  async listUsers() {
    return this.wmsIdentityService.listUsers();
  }

  @Post('users')
  async createUser(@Body() dto: CreateWmsUserDto) {
    return this.wmsIdentityService.createUser(dto);
  }

  @Patch('users/:id')
  async updateUser(@Param('id') id: string, @Body() dto: UpdateWmsUserDto) {
    return this.wmsIdentityService.updateUser(id, dto);
  }

  @Delete('users/:id')
  async removeUser(@Param('id') id: string, @Request() req) {
    const actingUserId = req.user.userId || req.user.id;
    return this.wmsIdentityService.removeUser(id, actingUserId);
  }

  @Get('roles')
  async listRoles() {
    return this.wmsIdentityService.listRoles();
  }

  @Get('permissions')
  async listPermissions() {
    return this.wmsIdentityService.listPermissions();
  }

  @Post('roles')
  async createRole(@Body() dto: CreateWmsRoleDto) {
    return this.wmsIdentityService.createRole(dto);
  }

  @Patch('roles/:id')
  async updateRole(@Param('id') id: string, @Body() dto: UpdateWmsRoleDto) {
    return this.wmsIdentityService.updateRole(id, dto);
  }

  @Delete('roles/:id')
  async removeRole(@Param('id') id: string) {
    return this.wmsIdentityService.removeRole(id);
  }
}
