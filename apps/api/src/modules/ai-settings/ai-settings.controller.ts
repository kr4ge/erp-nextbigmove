import { Body, Controller, Delete, Get, Put, Request, UseGuards } from '@nestjs/common';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { AiSettingsService } from './ai-settings.service';

class SetAiKeyDto {
  @IsString()
  @MinLength(20)
  @MaxLength(300)
  apiKey!: string;
}

type AuthedRequest = { user: { userId?: string; id?: string; tenantId: string } };

/** Main-admin territory: only tenant.manage (and SUPER_ADMIN) reach these. */
@Controller('ai-settings')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class AiSettingsController {
  constructor(private readonly settings: AiSettingsService) {}

  @Get()
  @Permissions('tenant.manage')
  get(@Request() req: AuthedRequest) {
    return this.settings.get(req.user.tenantId);
  }

  @Put()
  @Permissions('tenant.manage')
  set(@Request() req: AuthedRequest, @Body() dto: SetAiKeyDto) {
    return this.settings.set(req.user.tenantId, req.user.userId ?? req.user.id ?? '', dto.apiKey);
  }

  @Delete()
  @Permissions('tenant.manage')
  clear(@Request() req: AuthedRequest) {
    return this.settings.clear(req.user.tenantId, req.user.userId ?? req.user.id ?? '');
  }
}
