import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { IntegrationService } from './integration.service';
import {
  CreateIntegrationDto,
  UpdateIntegrationDto,
  IntegrationResponseDto,
  BulkCreatePosIntegrationDto,
} from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { TeamGuard } from '../../common/guards/team.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';

@Controller('integrations')
@UseGuards(JwtAuthGuard, TenantGuard, TeamGuard, PermissionsGuard)
export class IntegrationController {
  constructor(private readonly integrationService: IntegrationService) {}

  /**
   * Create a new integration
   * Requires integration.create permission
   */
  @Post()
  @Permissions('integration.create')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createIntegrationDto: CreateIntegrationDto,
  ): Promise<IntegrationResponseDto> {
    return this.integrationService.create(createIntegrationDto);
  }

  /**
   * Get all integrations for the current tenant
   */
  @Get()
  @Permissions('integration.read')
  async findAll(): Promise<IntegrationResponseDto[]> {
    return this.integrationService.findAll();
  }

  /**
   * Meta Ad Accounts - list all for tenant
   * NOTE: Must come BEFORE /:id routes to avoid route conflicts
   */
  @Get('/meta/accounts')
  @Permissions('integration.read')
  async listAllMetaAdAccounts() {
    return this.integrationService.listMetaAdAccounts();
  }

  /**
   * POS Stores - duplicate check
   * NOTE: This must come BEFORE /pos-stores/:id to avoid route conflicts
   */
  @Get('/pos-stores/check')
  @Permissions('integration.read')
  async checkPosStoreDuplicate(
    @Query('apiKey') apiKey?: string,
    @Query('shopId') shopId?: string,
  ) {
    return this.integrationService.checkPosDuplicate(apiKey, shopId);
  }

  /**
   * POS Stores - list for current tenant
   */
  @Get('/pos-stores')
  @Permissions('integration.read')
  async listPosStores() {
    return this.integrationService.listPosStores();
  }

  /**
   * POS Stores - list products for store (from DB)
   * NOTE: This must come BEFORE /pos-stores/:id to avoid route conflicts
   */
  @Get('/pos-stores/:id/products')
  @Permissions('integration.read')
  async getPosStoreProducts(@Param('id') id: string) {
    return this.integrationService.listPosStoreProducts(id);
  }

  /**
   * POS Stores - list orders for store (from DB) with optional date range
   * NOTE: This must come BEFORE /pos-stores/:id to avoid route conflicts
   */
  @Get('/pos-stores/:id/orders')
  @Permissions('integration.read')
  async getPosStoreOrders(
    @Param('id') id: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.integrationService.listPosStoreOrders(id, dateFrom, dateTo);
  }

  /**
   * POS Stores - bulk update product mapping
   * NOTE: This must come BEFORE /pos-stores/:id to avoid route conflicts
   */
  @Patch('/pos-stores/:id/products/mapping')
  @Permissions('integration.update')
  async bulkUpdateProductMapping(
    @Param('id') storeId: string,
    @Body() body: { productIds: string[]; mapping: string },
  ) {
    return this.integrationService.bulkUpdateProductMapping(
      storeId,
      body.productIds,
      body.mapping,
    );
  }

  /**
   * POS Stores - bulk import from API keys
   */
  @Post('/pos-stores/bulk-import')
  @Permissions('integration.create')
  @HttpCode(HttpStatus.CREATED)
  async bulkCreatePosIntegrations(
    @Body() dto: BulkCreatePosIntegrationDto,
  ) {
    return this.integrationService.bulkCreatePosIntegrations(dto);
  }

  /**
   * POS Stores - get one
   */
  @Get('/pos-stores/:id')
  @Permissions('integration.read')
  async getPosStore(@Param('id') id: string) {
    return this.integrationService.getPosStore(id);
  }

  /**
   * Fetch Pancake POS products by shop ID
   */
  @Get('shops/:shopId/products')
  @Permissions('integration.read')
  async getProductsByShop(
    @Param('shopId') shopId: string,
    @Query('apiKey') apiKey?: string,
  ): Promise<any[]> {
    return this.integrationService.fetchPancakeProductsByShopId(shopId, apiKey);
  }

  /**
   * Fetch Pancake POS products for a store by integration ID
   */
  @Get(':id/products')
  @Permissions('integration.read')
  async getProducts(@Param('id') id: string): Promise<any[]> {
    return this.integrationService.fetchPancakeProductsByIntegrationId(id);
  }

  /**
   * Get integration by ID
   */
  @Get(':id')
  @Permissions('integration.read')
  async findOne(@Param('id') id: string): Promise<IntegrationResponseDto> {
    return this.integrationService.findOne(id);
  }

  /**
   * Update an integration
   * Requires integration.update permission
   */
  @Patch(':id')
  @Permissions('integration.update')
  async update(
    @Param('id') id: string,
    @Body() updateIntegrationDto: UpdateIntegrationDto,
  ): Promise<IntegrationResponseDto> {
    return this.integrationService.update(id, updateIntegrationDto);
  }

  /**
   * Delete an integration
   * Requires integration.delete permission
   */
  @Delete(':id')
  @Permissions('integration.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    return this.integrationService.remove(id);
  }

  /**
   * Enable an integration
   * Requires integration.update permission
   */
  @Post(':id/enable')
  @Permissions('integration.update')
  async enable(@Param('id') id: string): Promise<IntegrationResponseDto> {
    return this.integrationService.enable(id);
  }

  /**
   * Disable an integration
   * Requires integration.update permission
   */
  @Post(':id/disable')
  @Permissions('integration.update')
  async disable(@Param('id') id: string): Promise<IntegrationResponseDto> {
    return this.integrationService.disable(id);
  }

  /**
   * Test connection for an integration
   * Requires integration.test permission
   */
  @Post(':id/test-connection')
  @Permissions('integration.test')
  async testConnection(@Param('id') id: string): Promise<any> {
    return this.integrationService.testConnection(id);
  }

  /**
   * Meta Ad Accounts - sync from Meta API for specific integration
   */
  @Post(':id/meta/sync-accounts')
  @Permissions('integration.update')
  async syncMetaAdAccounts(@Param('id') id: string) {
    const count = await this.integrationService.syncMetaAdAccounts(id);
    return {
      success: true,
      message: `Synced ${count} ad account(s)`,
      count,
    };
  }

  /**
   * Meta Ad Accounts - list for specific integration
   */
  @Get(':id/meta/accounts')
  @Permissions('integration.read')
  async getMetaAdAccountsByIntegration(@Param('id') id: string) {
    return this.integrationService.getMetaAdAccountsByIntegration(id);
  }

  /**
   * Meta Ad Accounts - set currency multiplier for selected accounts (non-PHP)
   */
  @Patch(':id/meta/accounts/multiplier')
  @Permissions('integration.update')
  async updateMetaAccountMultiplier(
    @Param('id') id: string,
    @Body() body: { accountIds: string[]; multiplier: number },
  ) {
    return this.integrationService.updateMetaAdAccountMultipliers(
      id,
      body.accountIds,
      body.multiplier,
    );
  }

  /**
   * Meta Ad Insights - list for specific integration with optional filters
   */
  @Get(':id/meta/insights')
  @Permissions('integration.read')
  async getMetaInsightsByIntegration(
    @Param('id') id: string,
    @Query('accountId') accountId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.integrationService.getMetaInsightsByIntegration(
      id,
      accountId,
      dateFrom,
      dateTo,
    );
  }

  // ============================================================================
  // COGS (Cost of Goods Sold) Management
  // ============================================================================

  /**
   * Get COGS history for a product in a store
   */
  @Get('pos-stores/:storeId/products/:productId/cogs')
  @Permissions('pos.read')
  async getProductCogsHistory(
    @Param('storeId') storeId: string,
    @Param('productId') productId: string,
  ) {
    return this.integrationService.getProductCogsHistory(productId, storeId);
  }

  /**
   * Get current active COGS for a product in a store
   */
  @Get('pos-stores/:storeId/products/:productId/cogs/current')
  @Permissions('pos.read')
  async getCurrentCogs(
    @Param('storeId') storeId: string,
    @Param('productId') productId: string,
  ) {
    return this.integrationService.getCurrentCogs(productId, storeId);
  }

  /**
   * Add new COGS entry for a product
   */
  @Post('pos-stores/:storeId/products/:productId/cogs')
  @Permissions('pos.cogs.manage')
  @HttpCode(HttpStatus.CREATED)
  async addCogsEntry(
    @Param('storeId') storeId: string,
    @Param('productId') productId: string,
    @Body() body: { cogs: number; startDate: string },
  ) {
    return this.integrationService.addCogsEntry(
      productId,
      storeId,
      body.cogs,
      new Date(body.startDate),
    );
  }

  /**
   * Update existing COGS entry
   */
  @Patch('pos-stores/:storeId/products/:productId/cogs/:cogsId')
  @Permissions('pos.cogs.manage')
  async updateCogsEntry(
    @Param('storeId') storeId: string,
    @Param('productId') productId: string,
    @Param('cogsId') cogsId: string,
    @Body() body: { cogs: number; startDate: string },
  ) {
    return this.integrationService.updateCogsEntry(
      cogsId,
      body.cogs,
      new Date(body.startDate),
    );
  }

  /**
   * Delete COGS entry
   */
  @Delete('pos-stores/:storeId/products/:productId/cogs/:cogsId')
  @Permissions('pos.cogs.manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteCogsEntry(
    @Param('storeId') storeId: string,
    @Param('productId') productId: string,
    @Param('cogsId') cogsId: string,
  ) {
    return this.integrationService.deleteCogsEntry(cogsId);
  }
}
