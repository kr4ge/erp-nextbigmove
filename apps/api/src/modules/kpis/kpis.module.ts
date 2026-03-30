import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { CommonServicesModule } from '../../common/services/services.module';
import { KpisController } from './kpis.controller';
import { KpisService } from './kpis.service';

@Module({
  imports: [PrismaModule, CommonServicesModule],
  controllers: [KpisController],
  providers: [KpisService],
})
export class KpisModule {}
