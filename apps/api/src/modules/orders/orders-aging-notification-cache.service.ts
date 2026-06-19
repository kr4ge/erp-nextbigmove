import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { createHash } from 'crypto';

type AgingOrdersBucketCacheRow = {
  shopId: string;
  bucketKey: string;
  agedCount: number;
  orderIds: string[];
};

@Injectable()
export class OrdersAgingNotificationCacheService {
  private readonly logger = new Logger(OrdersAgingNotificationCacheService.name);

  constructor(
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  private getLazySyncTtlMs() {
    const ttlSecondsRaw = Number(process.env.ORDERS_AGING_NOTIFICATION_LAZY_SYNC_TTL_SECONDS || '300');
    const ttlSeconds = Number.isFinite(ttlSecondsRaw) && ttlSecondsRaw >= 30
      ? Math.floor(ttlSecondsRaw)
      : 300;
    return Math.min(ttlSeconds, 3600) * 1000;
  }

  private getLazySyncLockTtlMs() {
    const ttlSecondsRaw = Number(process.env.ORDERS_AGING_NOTIFICATION_LAZY_SYNC_LOCK_TTL_SECONDS || '15');
    const ttlSeconds = Number.isFinite(ttlSecondsRaw) && ttlSecondsRaw >= 5
      ? Math.floor(ttlSecondsRaw)
      : 15;
    return Math.min(ttlSeconds, 120) * 1000;
  }

  private getSummaryCacheTtlMs() {
    const ttlSecondsRaw = Number(process.env.ORDERS_AGING_SUMMARY_CACHE_TTL_SECONDS || '60');
    const ttlSeconds = Number.isFinite(ttlSecondsRaw) && ttlSecondsRaw >= 10
      ? Math.floor(ttlSecondsRaw)
      : 60;
    return Math.min(ttlSeconds, 600) * 1000;
  }

  private buildScopeHash(shopIds: string[]) {
    const normalized = Array.from(new Set(
      shopIds
        .map((shopId) => shopId?.trim())
        .filter((shopId): shopId is string => !!shopId),
    )).sort((left, right) => left.localeCompare(right));

    return createHash('sha1').update(normalized.join('|')).digest('hex');
  }

  private getSummaryCacheKey(
    tenantId: string,
    shopIds: string[],
    thresholdDays: number,
  ) {
    return `orders:aging:summary:${tenantId}:${thresholdDays}:${this.buildScopeHash(shopIds)}`;
  }

  private getLazySyncStampKey(tenantId: string, shopIds: string[]) {
    return `orders:aging:lazy-sync:stamp:${tenantId}:${this.buildScopeHash(shopIds)}`;
  }

  private getLazySyncLockKey(tenantId: string, shopIds: string[]) {
    return `orders:aging:lazy-sync:lock:${tenantId}:${this.buildScopeHash(shopIds)}`;
  }

  async getCachedBucketDetails(
    tenantId: string,
    shopIds: string[],
    thresholdDays: number,
  ): Promise<AgingOrdersBucketCacheRow[] | null> {
    const key = this.getSummaryCacheKey(tenantId, shopIds, thresholdDays);

    try {
      const cached = await this.cacheManager.get<AgingOrdersBucketCacheRow[]>(key);
      return Array.isArray(cached) ? cached : null;
    } catch (error: any) {
      this.logger.warn(
        `Failed to read aging summary cache key=${key}: ${error?.message || 'Unknown cache error'}`,
      );
      return null;
    }
  }

  async setCachedBucketDetails(
    tenantId: string,
    shopIds: string[],
    thresholdDays: number,
    value: AgingOrdersBucketCacheRow[],
  ) {
    const key = this.getSummaryCacheKey(tenantId, shopIds, thresholdDays);

    try {
      await this.cacheManager.set(key, value, this.getSummaryCacheTtlMs());
    } catch (error: any) {
      this.logger.warn(
        `Failed to write aging summary cache key=${key}: ${error?.message || 'Unknown cache error'}`,
      );
    }
  }

  async hasRecentLazySync(tenantId: string, shopIds: string[]) {
    const key = this.getLazySyncStampKey(tenantId, shopIds);

    try {
      const cached = await this.cacheManager.get<string>(key);
      return typeof cached === 'string' && cached.length > 0;
    } catch (error: any) {
      this.logger.warn(
        `Failed to read aging lazy sync stamp key=${key}: ${error?.message || 'Unknown cache error'}`,
      );
      return false;
    }
  }

  async hasLazySyncLock(tenantId: string, shopIds: string[]) {
    const key = this.getLazySyncLockKey(tenantId, shopIds);

    try {
      const cached = await this.cacheManager.get<string>(key);
      return typeof cached === 'string' && cached.length > 0;
    } catch (error: any) {
      this.logger.warn(
        `Failed to read aging lazy sync lock key=${key}: ${error?.message || 'Unknown cache error'}`,
      );
      return false;
    }
  }

  async setLazySyncLock(tenantId: string, shopIds: string[]) {
    const key = this.getLazySyncLockKey(tenantId, shopIds);

    try {
      await this.cacheManager.set(key, new Date().toISOString(), this.getLazySyncLockTtlMs());
    } catch (error: any) {
      this.logger.warn(
        `Failed to write aging lazy sync lock key=${key}: ${error?.message || 'Unknown cache error'}`,
      );
    }
  }

  async clearLazySyncLock(tenantId: string, shopIds: string[]) {
    const key = this.getLazySyncLockKey(tenantId, shopIds);

    try {
      await this.cacheManager.del(key);
    } catch (error: any) {
      this.logger.warn(
        `Failed to clear aging lazy sync lock key=${key}: ${error?.message || 'Unknown cache error'}`,
      );
    }
  }

  async markLazySyncFresh(tenantId: string, shopIds: string[]) {
    const key = this.getLazySyncStampKey(tenantId, shopIds);

    try {
      await this.cacheManager.set(key, new Date().toISOString(), this.getLazySyncTtlMs());
    } catch (error: any) {
      this.logger.warn(
        `Failed to write aging lazy sync stamp key=${key}: ${error?.message || 'Unknown cache error'}`,
      );
    }
  }
}
