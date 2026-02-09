import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';

export type WorkflowProgressSnapshot = {
  date?: string | null;
  metaProcessed?: number;
  metaTotal?: number;
  posProcessed?: number;
  posTotal?: number;
  updatedAt?: string;
};

@Injectable()
export class WorkflowProgressCacheService {
  private readonly redis: Redis;
  private readonly ttlSeconds = 60 * 60 * 24; // 24 hours

  constructor() {
    const host = process.env.REDIS_HOST || 'localhost';
    const port = parseInt(process.env.REDIS_PORT || '6379', 10);
    const keyPrefix = process.env.CACHE_PREFIX || 'erp:';
    const password = process.env.REDIS_PASSWORD || undefined;
    this.redis = new Redis({
      host,
      port,
      keyPrefix,
      password,
      lazyConnect: false,
    });
  }

  private key(executionId: string) {
    return `workflow:execution:${executionId}:progress`;
  }

  async getProgress(executionId: string): Promise<WorkflowProgressSnapshot | null> {
    const raw = await this.redis.get(this.key(executionId));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as WorkflowProgressSnapshot;
    } catch {
      return null;
    }
  }

  async setProgress(executionId: string, progress: WorkflowProgressSnapshot) {
    const payload: WorkflowProgressSnapshot = {
      ...progress,
      updatedAt: new Date().toISOString(),
    };
    await this.redis.set(this.key(executionId), JSON.stringify(payload), 'EX', this.ttlSeconds);
  }

  async bumpMetaProcessed(executionId: string, total?: number, date?: string | null) {
    const current = (await this.getProgress(executionId)) || {};
    await this.setProgress(executionId, {
      date: date ?? current.date ?? null,
      metaTotal: total ?? current.metaTotal,
      posTotal: current.posTotal,
      posProcessed: current.posProcessed ?? 0,
      metaProcessed: (current.metaProcessed ?? 0) + 1,
    });
  }

  async bumpPosProcessed(executionId: string, total?: number, date?: string | null) {
    const current = (await this.getProgress(executionId)) || {};
    await this.setProgress(executionId, {
      date: date ?? current.date ?? null,
      metaTotal: current.metaTotal,
      posTotal: total ?? current.posTotal,
      metaProcessed: current.metaProcessed ?? 0,
      posProcessed: (current.posProcessed ?? 0) + 1,
    });
  }
}
