import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { TeamGuard } from '../../common/guards/team.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CreateMarketingCategoryTargetDto } from './dto/create-marketing-category-target.dto';
import { CreateMarketingTeamTargetDto } from './dto/create-marketing-team-target.dto';
import { CreateMarketingUserCategoryAssignmentDto } from './dto/create-marketing-user-category-assignment.dto';
import { CreateMarketingUserTargetDto } from './dto/create-marketing-user-target.dto';
import { KpisService } from './kpis.service';

@Controller('kpis/marketing')
@UseGuards(JwtAuthGuard, TenantGuard, TeamGuard, PermissionsGuard)
export class KpisController {
  constructor(private readonly kpisService: KpisService) {}

  @Get('overview')
  @Permissions('kpi.marketing.read', 'kpi.marketing.manage')
  async getOverview(
    @Query('team_code') teamCode?: string,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
  ) {
    return this.kpisService.getOverview({ teamCode, startDate, endDate });
  }

  @Post('team-targets')
  @Permissions('kpi.marketing.manage')
  async createTeamTargets(@Body() dto: CreateMarketingTeamTargetDto, @Req() req: any) {
    return this.kpisService.createTeamTargets(dto, req.user);
  }

  @Post('category-targets')
  @Permissions('kpi.marketing.manage')
  async createCategoryTargets(@Body() dto: CreateMarketingCategoryTargetDto, @Req() req: any) {
    return this.kpisService.createCategoryTargets(dto, req.user);
  }

  @Post('user-category-assignments')
  @Permissions('kpi.marketing.manage')
  async createUserCategoryAssignment(
    @Body() dto: CreateMarketingUserCategoryAssignmentDto,
    @Req() req: any,
  ) {
    return this.kpisService.createUserCategoryAssignment(dto, req.user);
  }

  @Post('user-targets')
  @Permissions('kpi.marketing.manage')
  async createUserTargets(@Body() dto: CreateMarketingUserTargetDto, @Req() req: any) {
    return this.kpisService.createUserTargets(dto, req.user);
  }

  @Get('dashboard/me')
  @Permissions('dashboard.marketing')
  async getMyDashboard(
    @Req() req: any,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
  ) {
    return this.kpisService.getMyDashboard({ actor: req.user, startDate, endDate });
  }

  @Get('dashboard/team')
  @Permissions('dashboard.marketing_leader', 'dashboard.executives')
  async getTeamDashboard(
    @Query('team_code') teamCode?: string,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
  ) {
    return this.kpisService.getTeamDashboard({ teamCode, startDate, endDate });
  }

  @Get('dashboard/executive')
  @Permissions('dashboard.executives')
  async getExecutiveDashboard(
    @Query('team_code') teamCode?: string,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
  ) {
    return this.kpisService.getExecutiveDashboard({ teamCode, startDate, endDate });
  }
}
