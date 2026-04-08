import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { WmsIdentityController } from './wms-identity.controller';
import { WmsIdentityService } from './wms-identity.service';

@Module({
  imports: [PrismaModule],
  controllers: [WmsIdentityController],
  providers: [WmsIdentityService],
  exports: [WmsIdentityService],
})
export class WmsIdentityModule {}
