import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

function ensureHoistedPrismaEngineLibrary() {
  if (process.env.PRISMA_QUERY_ENGINE_LIBRARY) {
    return;
  }

  try {
    const prismaEngineDirs = [
      path.resolve(process.cwd(), 'node_modules/.prisma/client'),
      path.resolve(process.cwd(), '../node_modules/.prisma/client'),
      path.resolve(process.cwd(), '../../node_modules/.prisma/client'),
      path.resolve(__dirname, '../../../node_modules/.prisma/client'),
      path.resolve(__dirname, '../../../../node_modules/.prisma/client'),
    ];

    const prismaEngineDir = prismaEngineDirs.find((candidateDir) =>
      fs.existsSync(candidateDir),
    );

    if (!prismaEngineDir) {
      return;
    }

    const queryEngineLibrary = fs
      .readdirSync(prismaEngineDir)
      .find((entry) => entry.startsWith('libquery_engine') && entry.endsWith('.node'));

    if (!queryEngineLibrary) {
      return;
    }

    // Nest's webpack bundle runs from apps/api/dist, but Prisma generate is hoisted to the repo root.
    process.env.PRISMA_QUERY_ENGINE_LIBRARY = path.join(prismaEngineDir, queryEngineLibrary);
  } catch {
    // Fall back to Prisma's default resolution when the workspace layout differs.
  }
}

ensureHoistedPrismaEngineLibrary();

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(private configService: ConfigService) {
    super({
      datasources: {
        db: {
          url: configService.get<string>('database.url'),
        },
      },
      log: process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
    });
  }

  async onModuleInit() {
    await this.$connect();
    console.log('✅ Database connected');

    // Enable Row-Level Security on tenant-scoped tables
    try {
      const rlsTables = [
        'users',
        'integrations',
        'pos_stores',
        'pos_products',
        'analytics_events',
        'pancake_webhook_logs',
        'pancake_webhook_log_orders',
        'audit_logs',
      ];

      for (const table of rlsTables) {
        await this.$executeRawUnsafe(`ALTER TABLE IF EXISTS ${table} ENABLE ROW LEVEL SECURITY;`);
      }

      console.log('✅ Row-Level Security enabled');
    } catch (error) {
      console.warn('⚠️  RLS setup skipped (tables may not exist yet)');
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    console.log('❌ Database disconnected');
  }

  /**
   * Clean database (for testing only)
   */
  async cleanDatabase() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Cannot clean database in production');
    }

    const models = Reflect.ownKeys(this).filter(
      (key) => key[0] !== '_' && key !== 'constructor'
    );

    return Promise.all(
      models.map((modelKey) => {
        const model = this[modelKey as keyof this];
        if (model && typeof model === 'object' && 'deleteMany' in model) {
          return (model as any).deleteMany();
        }
      })
    );
  }
}
