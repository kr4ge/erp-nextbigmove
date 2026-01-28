import { Module } from '@nestjs/common';
import { RolesService } from './roles.service';
import { RolesController } from './roles.controller';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { ClsModule } from 'nestjs-cls';

@Module({
  imports: [PrismaModule, ClsModule],
  controllers: [RolesController],
  providers: [RolesService],
  exports: [RolesService],
})
export class RolesModule {}
