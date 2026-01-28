import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards, Request } from '@nestjs/common';
import { TeamService } from './team.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { AddTeamMemberDto } from './dto/add-team-member.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';

@Controller('teams')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Permissions('team.manage')
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  /**
   * Get current user's team memberships
   * No permission required - all users can see their own teams
   */
  @Get('my-teams')
  @Permissions() // Override class-level permission requirement
  async getMyTeams(@Request() req) {
    return this.teamService.getMyTeams(req.user.userId, req.user.tenantId);
  }

  @Get()
  async list() {
    return this.teamService.listTeams();
  }

  @Post()
  async create(@Body() dto: CreateTeamDto) {
    return this.teamService.createTeam(dto);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateTeamDto) {
    return this.teamService.updateTeam(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.teamService.deleteTeam(id);
  }

  @Post(':id/members')
  async addMember(@Param('id') id: string, @Body() dto: AddTeamMemberDto) {
    return this.teamService.addMember(id, dto);
  }

  @Get(':id/members')
  async listMembers(@Param('id') id: string) {
    return this.teamService.listMembers(id);
  }
}
