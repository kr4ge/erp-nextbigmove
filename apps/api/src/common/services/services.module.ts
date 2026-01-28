import { Module, Global } from '@nestjs/common';
import { TeamContextService } from './team-context.service';
import { PrismaModule } from '../prisma/prisma.module';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [TeamContextService],
  exports: [TeamContextService],
})
export class CommonServicesModule {}
