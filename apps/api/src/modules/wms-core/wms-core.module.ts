import { Module } from '@nestjs/common';
import { ClsModule } from 'nestjs-cls';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { WmsCoreController } from './wms-core.controller';
import { WmsCoreService } from './wms-core.service';

@Module({
  imports: [PrismaModule, ClsModule],
  controllers: [WmsCoreController],
  providers: [WmsCoreService],
  exports: [WmsCoreService],
})
export class WmsCoreModule {}
