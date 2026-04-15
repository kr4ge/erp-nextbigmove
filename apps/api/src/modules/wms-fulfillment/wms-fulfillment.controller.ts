import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { Permissions } from "../../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import {
  AssignWmsPackingDto,
  CreateWmsPackingStationDto,
  ListWmsFulfillmentOrdersDto,
  ScanWmsFulfillmentUnitDto,
  SetWmsFulfillmentOrderStatusDto,
  StartWmsFulfillmentSessionDto,
  SyncWmsFulfillmentIntakeDto,
  UpdateWmsPackingStationDto,
} from "./dto";
import { WmsFulfillmentService } from "./wms-fulfillment.service";

@Controller("wms/fulfillment")
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class WmsFulfillmentController {
  constructor(
    private readonly wmsFulfillmentService: WmsFulfillmentService,
  ) {}

  @Post("intake/sync")
  @Permissions("wms.fulfillment.create", "wms.fulfillment.update")
  async syncIntake(@Body() dto: SyncWmsFulfillmentIntakeDto) {
    return this.wmsFulfillmentService.syncIntake(dto);
  }

  @Get("operators")
  @Permissions("wms.fulfillment.read")
  async listOperators() {
    return this.wmsFulfillmentService.listOperators();
  }

  @Get("stations")
  @Permissions("wms.fulfillment.read")
  async listStations(@Query("warehouseId") warehouseId?: string) {
    return this.wmsFulfillmentService.listStations({ warehouseId });
  }

  @Post("stations")
  @Permissions("wms.fulfillment.create", "wms.fulfillment.update")
  async createStation(@Body() dto: CreateWmsPackingStationDto) {
    return this.wmsFulfillmentService.createStation(dto);
  }

  @Patch("stations/:id")
  @Permissions("wms.fulfillment.update")
  async updateStation(
    @Param("id") id: string,
    @Body() dto: UpdateWmsPackingStationDto,
  ) {
    return this.wmsFulfillmentService.updateStation(id, dto);
  }

  @Get("orders")
  @Permissions("wms.fulfillment.read")
  async listOrders(@Query() query: ListWmsFulfillmentOrdersDto) {
    return this.wmsFulfillmentService.listOrders(query);
  }

  @Get("orders/:id")
  @Permissions("wms.fulfillment.read")
  async getOrder(@Param("id") id: string) {
    return this.wmsFulfillmentService.getOrder(id);
  }

  @Post("orders/:id/status")
  @Permissions("wms.fulfillment.update")
  async setOrderStatus(
    @Param("id") id: string,
    @Body() dto: SetWmsFulfillmentOrderStatusDto,
  ) {
    return this.wmsFulfillmentService.setOrderStatus(id, dto);
  }

  @Post("orders/:id/picking/start")
  @Permissions("wms.fulfillment.update")
  async startPicking(
    @Param("id") id: string,
    @Body() dto: StartWmsFulfillmentSessionDto,
  ) {
    return this.wmsFulfillmentService.startPicking(id, dto);
  }

  @Post("orders/:id/picking/scan")
  @Permissions("wms.fulfillment.update")
  async scanPickUnit(
    @Param("id") id: string,
    @Body() dto: ScanWmsFulfillmentUnitDto,
  ) {
    return this.wmsFulfillmentService.scanPickUnit(id, dto);
  }

  @Post("orders/:id/packing/assign")
  @Permissions("wms.fulfillment.update")
  async assignPacking(
    @Param("id") id: string,
    @Body() dto: AssignWmsPackingDto,
  ) {
    return this.wmsFulfillmentService.assignPacking(id, dto);
  }

  @Post("orders/:id/packing/start")
  @Permissions("wms.fulfillment.update")
  async startPacking(
    @Param("id") id: string,
    @Body() dto: StartWmsFulfillmentSessionDto,
  ) {
    return this.wmsFulfillmentService.startPacking(id, dto);
  }

  @Post("orders/:id/packing/scan")
  @Permissions("wms.fulfillment.update")
  async scanPackUnit(
    @Param("id") id: string,
    @Body() dto: ScanWmsFulfillmentUnitDto,
  ) {
    return this.wmsFulfillmentService.scanPackUnit(id, dto);
  }
}

