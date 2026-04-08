import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import { Permissions } from "../../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { CreateWmsInventoryAdjustmentDto } from "./dto/create-wms-inventory-adjustment.dto";
import { CreateWmsInventoryTransferDto } from "./dto/create-wms-inventory-transfer.dto";
import { ListWmsInventoryBalancesDto } from "./dto/list-wms-inventory-balances.dto";
import { ListWmsInventoryAdjustmentsDto } from "./dto/list-wms-inventory-adjustments.dto";
import { ListWmsInventoryLedgerDto } from "./dto/list-wms-inventory-ledger.dto";
import { ListWmsInventoryLotsDto } from "./dto/list-wms-inventory-lots.dto";
import { ListWmsInventoryTransfersDto } from "./dto/list-wms-inventory-transfers.dto";
import { ListWmsInventoryUnitsDto } from "./dto/list-wms-inventory-units.dto";
import { ListWmsPosProductFiltersDto } from "./dto/list-wms-pos-product-filters.dto";
import { ListWmsPosProductsDto } from "./dto/list-wms-pos-products.dto";
import { UpsertWmsSkuProfileDto } from "./dto/upsert-wms-sku-profile.dto";
import { WmsInventoryAdjustmentsService } from "./wms-inventory-adjustments.service";
import { WmsInventoryCatalogService } from "./wms-inventory-catalog.service";
import { WmsInventoryService } from "./wms-inventory.service";
import { WmsInventoryTransfersService } from "./wms-inventory-transfers.service";

@Controller("wms/inventory")
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class WmsInventoryController {
  constructor(
    private readonly wmsInventoryService: WmsInventoryService,
    private readonly wmsInventoryAdjustmentsService: WmsInventoryAdjustmentsService,
    private readonly wmsInventoryCatalogService: WmsInventoryCatalogService,
    private readonly wmsInventoryTransfersService: WmsInventoryTransfersService,
  ) {}

  @Get("overview")
  @Permissions("wms.inventory.read")
  async getOverview() {
    return this.wmsInventoryService.getOverview();
  }

  @Get("balances")
  @Permissions("wms.inventory.read")
  async listBalances(@Query() query: ListWmsInventoryBalancesDto) {
    return this.wmsInventoryService.listBalances(query);
  }

  @Get("lots")
  @Permissions("wms.inventory.read")
  async listLots(@Query() query: ListWmsInventoryLotsDto) {
    return this.wmsInventoryService.listLots(query);
  }

  @Get("units")
  @Permissions("wms.inventory.read")
  async listUnits(@Query() query: ListWmsInventoryUnitsDto) {
    return this.wmsInventoryService.listUnits(query);
  }

  @Get("ledger")
  @Permissions("wms.inventory.read")
  async listLedger(@Query() query: ListWmsInventoryLedgerDto) {
    return this.wmsInventoryService.listLedger(query);
  }

  @Get("adjustments")
  @Permissions("wms.inventory.read")
  async listAdjustments(@Query() query: ListWmsInventoryAdjustmentsDto) {
    return this.wmsInventoryAdjustmentsService.listAdjustments(query);
  }

  @Post("adjustments")
  @Permissions("wms.inventory.create", "wms.inventory.update")
  async createAdjustment(@Body() dto: CreateWmsInventoryAdjustmentDto) {
    return this.wmsInventoryAdjustmentsService.createAdjustment(dto);
  }

  @Get("transfers")
  @Permissions("wms.inventory.read")
  async listTransfers(@Query() query: ListWmsInventoryTransfersDto) {
    return this.wmsInventoryTransfersService.listTransfers(query);
  }

  @Post("transfers")
  @Permissions("wms.inventory.create", "wms.inventory.update")
  async createTransfer(@Body() dto: CreateWmsInventoryTransferDto) {
    return this.wmsInventoryTransfersService.createTransfer(dto);
  }

  @Get("catalog/pos-products")
  @Permissions("wms.inventory.read", "wms.purchasing.read")
  async listPosProducts(@Query() query: ListWmsPosProductsDto) {
    return this.wmsInventoryCatalogService.listPosProducts(query);
  }

  @Get("catalog/pos-products/filters")
  @Permissions("wms.inventory.read", "wms.purchasing.read")
  async listPosProductFilters(@Query() query: ListWmsPosProductFiltersDto) {
    return this.wmsInventoryCatalogService.listPosProductFilters(query);
  }

  @Put("catalog/pos-products/:posProductId/sku-profile")
  @Permissions("wms.inventory.create", "wms.inventory.update")
  async upsertSkuProfile(
    @Param("posProductId") posProductId: string,
    @Body() dto: UpsertWmsSkuProfileDto,
  ) {
    return this.wmsInventoryCatalogService.upsertSkuProfile(posProductId, dto);
  }

  @Delete("catalog/pos-products/:posProductId/sku-profile")
  @Permissions("wms.inventory.delete")
  async removeSkuProfile(@Param("posProductId") posProductId: string) {
    return this.wmsInventoryCatalogService.removeSkuProfile(posProductId);
  }
}
