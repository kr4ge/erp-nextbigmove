import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Delete,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { WmsAccessGuard } from '../../common/guards/wms-access.guard';
import { CreateWmsSettingsRoleDto, UpdateWmsSettingsRoleDto } from './dto/wms-settings-role.dto';
import { CreateWmsStoxReleaseDto, ImportWmsStoxReleaseDto } from './dto/wms-stox-release.dto';
import { CreateWmsSettingsUserDto, UpdateWmsSettingsUserDto } from './dto/wms-settings-user.dto';
import { WmsSettingsService } from './wms-settings.service';
import { UploadedBinaryFile, WmsStoxReleasesService } from './wms-stox-releases.service';

@Controller('wms/settings')
@UseGuards(JwtAuthGuard, WmsAccessGuard)
export class WmsSettingsController {
  constructor(
    private readonly wmsSettingsService: WmsSettingsService,
    private readonly wmsStoxReleasesService: WmsStoxReleasesService,
  ) {}

  private static buildStoxUploadRoot() {
    const uploadRoot = process.env.STOX_APK_UPLOAD_TMP_DIR
      || join(process.cwd(), 'tmp', 'wms-stox-releases');
    mkdirSync(uploadRoot, { recursive: true });
    return uploadRoot;
  }

  private static buildStoxMaxUploadBytes() {
    const maxMb = Number(process.env.OBJECT_STORAGE_STOX_APK_MAX_FILE_MB || '150');
    if (!Number.isFinite(maxMb) || maxMb <= 0) {
      return 150 * 1024 * 1024;
    }

    return Math.floor(maxMb * 1024 * 1024);
  }

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

  @Get('stox/releases')
  @Permissions('wms.stox.read')
  async listStoxReleases(@Request() req) {
    return this.wmsStoxReleasesService.listReleases(req.user);
  }

  @Post('stox/releases')
  @Permissions('wms.stox.write')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: WmsSettingsController.buildStoxUploadRoot(),
      filename: (_req, file, cb) => {
        const safeExt = extname(file.originalname || '').toLowerCase();
        const token = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        cb(null, `${token}${safeExt || '.apk'}`);
      },
    }),
    limits: {
      fileSize: WmsSettingsController.buildStoxMaxUploadBytes(),
    },
    fileFilter: (_req, file, cb) => {
      const normalizedName = (file.originalname || '').trim().toLowerCase();
      if (!normalizedName.endsWith('.apk')) {
        cb(new BadRequestException('Only Android APK files are supported'), false);
        return;
      }

      cb(null, true);
    },
  }))
  async createStoxRelease(
    @Request() req,
    @Body() body: CreateWmsStoxReleaseDto,
    @UploadedFile() file: UploadedBinaryFile,
  ) {
    return this.wmsStoxReleasesService.createRelease(req.user, body, file);
  }

  @Post('stox/releases/import-url')
  @Permissions('wms.stox.write')
  async importStoxReleaseFromUrl(
    @Request() req,
    @Body() body: ImportWmsStoxReleaseDto,
  ) {
    return this.wmsStoxReleasesService.importReleaseFromUrl(req.user, body);
  }

  @Post('stox/releases/:id/activate')
  @Permissions('wms.stox.write')
  async activateStoxRelease(@Request() req, @Param('id') id: string) {
    return this.wmsStoxReleasesService.activateRelease(req.user, id);
  }
}
