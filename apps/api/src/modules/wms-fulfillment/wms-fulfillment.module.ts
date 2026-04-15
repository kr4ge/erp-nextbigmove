import { Module } from "@nestjs/common";
import { PrismaModule } from "../../common/prisma/prisma.module";
import { WmsFulfillmentController } from "./wms-fulfillment.controller";
import { WmsFulfillmentService } from "./wms-fulfillment.service";

@Module({
  imports: [PrismaModule],
  controllers: [WmsFulfillmentController],
  providers: [WmsFulfillmentService],
  exports: [WmsFulfillmentService],
})
export class WmsFulfillmentModule {}
