import { Module, Global } from '@nestjs/common';
import { TeamContextService } from './team-context.service';
import { PrismaModule } from '../prisma/prisma.module';
import { EffectiveAccessService } from './effective-access.service';
import { RequestClientContextService } from './request-client-context.service';
import { WmsStaffActivityService } from './wms-staff-activity.service';
import { WmsAccessGuard } from '../guards/wms-access.guard';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [
    TeamContextService,
    EffectiveAccessService,
    RequestClientContextService,
    WmsStaffActivityService,
    WmsAccessGuard,
  ],
  exports: [
    TeamContextService,
    EffectiveAccessService,
    RequestClientContextService,
    WmsStaffActivityService,
    WmsAccessGuard,
  ],
})
export class CommonServicesModule {}
