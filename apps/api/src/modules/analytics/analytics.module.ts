import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { CommonServicesModule } from '../../common/services/services.module';
import { MarketingAnalyticsController } from './marketing-analytics.controller';
import { MarketingAnalyticsService } from './marketing-analytics.service';
import { CeoDashboardController } from './ceo-dashboard.controller';
import { SalesAnalyticsController } from './sales-analytics.controller';
import { CeoDashboardService } from './services/ceo-dashboard.service';
import { SalesAnalyticsService } from './sales-analytics.service';
import { AnalyticsCacheService } from './analytics-cache.service';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { AnalyticsShareController } from './analytics-share.controller';
import { AnalyticsShareService } from './analytics-share.service';
import { SalesPerformanceController } from './sales-performance.controller';
import { SalesPerformanceService } from './sales-performance.service';
import { SalesAttributionAnalyticsController } from './sales-attribution-analytics.controller';
import { SalesAttributionAnalyticsService } from './sales-attribution-analytics.service';
import { ReconcileMarketingService } from '../workflows/services/reconcile-marketing.service';
import { ReconcileSalesService } from '../workflows/services/reconcile-sales.service';
import { ReconcileSalesAttributionService } from '../workflows/services/reconcile-sales-attribution.service';
import { AnalyticsRequestCoordinatorService } from './analytics-request-coordinator.service';

@Module({
  imports: [PrismaModule, CommonServicesModule],
  controllers: [
    MarketingAnalyticsController,
    SalesAnalyticsController,
    SalesAttributionAnalyticsController,
    AnalyticsShareController,
    SalesPerformanceController,
    CeoDashboardController,
  ],
  providers: [
    MarketingAnalyticsService,
    SalesAnalyticsService,
    SalesAttributionAnalyticsService,
    AnalyticsShareService,
    SalesPerformanceService,
    CeoDashboardService,
    AnalyticsCacheService,
    AnalyticsRequestCoordinatorService,
    ReconcileMarketingService,
    ReconcileSalesService,
    ReconcileSalesAttributionService,
    PermissionsGuard,
  ],
})
export class AnalyticsModule {}
