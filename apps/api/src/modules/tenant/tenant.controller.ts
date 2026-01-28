import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TenantService } from './tenant.service';
import { CreateTenantDto, UpdateTenantDto } from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@Controller('tenants')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  /**
   * Create a new tenant (admin only)
   */
  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN')
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createTenantDto: CreateTenantDto) {
    return this.tenantService.createTenant(createTenantDto);
  }

  /**
   * Get all tenants (admin only)
   */
  @Get()
  @Roles('SUPER_ADMIN', 'ADMIN')
  async findAll() {
    return this.tenantService.findAll();
  }

  /**
   * Get tenant statistics (admin only)
   */
  @Get('stats')
  @Roles('SUPER_ADMIN', 'ADMIN')
  async getStats() {
    return this.tenantService.getStats();
  }

  /**
   * Get a single tenant (admin only)
   */
  @Get(':id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  async findOne(@Param('id') id: string) {
    return this.tenantService.findOne(id);
  }

  /**
   * Update a tenant (admin only)
   */
  @Patch(':id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  async update(@Param('id') id: string, @Body() updateTenantDto: UpdateTenantDto) {
    return this.tenantService.update(id, updateTenantDto);
  }

  /**
   * Delete a tenant (super admin only)
   */
  @Delete(':id')
  @Roles('SUPER_ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    await this.tenantService.remove(id);
  }
}
