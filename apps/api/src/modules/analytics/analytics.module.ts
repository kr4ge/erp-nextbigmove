import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { CommonServicesModule } from '../../common/services/services.module';
import { MarketingAnalyticsController } from './marketing-analytics.controller';
import { MarketingAnalyticsService } from './marketing-analytics.service';
import { SalesAnalyticsController } from './sales-analytics.controller';
import { SalesAnalyticsService } from './sales-analytics.service';
import { AnalyticsCacheService } from './analytics-cache.service';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { AnalyticsShareController } from './analytics-share.controller';
import { AnalyticsShareService } from './analytics-share.service';
import { SalesPerformanceController } from './sales-performance.controller';
import { SalesPerformanceService } from './sales-performance.service';

@Module({
  imports: [PrismaModule, CommonServicesModule],
  controllers: [
    MarketingAnalyticsController,
    SalesAnalyticsController,
    AnalyticsShareController,
    SalesPerformanceController,
  ],
  providers: [
    MarketingAnalyticsService,
    SalesAnalyticsService,
    AnalyticsShareService,
    SalesPerformanceService,
    AnalyticsCacheService,
    PermissionsGuard,
  ],
})
export class AnalyticsModule {}
