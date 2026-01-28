import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ClsModule } from 'nestjs-cls';
import { BullModule } from '@nestjs/bull';
import databaseConfig from './config/database.config';
import jwtConfig from './config/jwt.config';
import redisConfig from './config/redis.config';
import validationSchema from './config/validation.schema';
import { PrismaModule } from './common/prisma/prisma.module';
import { CommonServicesModule } from './common/services/services.module';
import { AuthModule } from './modules/auth/auth.module';
import { TenantModule } from './modules/tenant/tenant.module';
import { IntegrationModule } from './modules/integrations/integration.module';
import { WorkflowModule } from './modules/workflows/workflow.module';
import { TeamModule } from './modules/teams/team.module';
import { UserModule } from './modules/users/user.module';
import { RolesModule } from './modules/roles/roles.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, jwtConfig, redisConfig],
      validationSchema,
    }),

    // Redis cache (global)
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: async () => {
        const { redisStore } = await import('cache-manager-redis-yet');
        const host = process.env.REDIS_HOST || 'localhost';
        const port = parseInt(process.env.REDIS_PORT || '6379', 10);
        const password = process.env.REDIS_PASSWORD || undefined;
        const ttlSeconds = parseInt(process.env.CACHE_TTL_SECONDS || '60', 10);
        const prefix = process.env.CACHE_PREFIX || 'erp:';
        return {
          store: await redisStore({
            socket: { host, port },
            password,
            ttl: ttlSeconds * 1000, // milliseconds expected by store
            keyPrefix: prefix,
          }),
        };
      },
    }),

    // CLS (Continuation Local Storage) for tenant context
    ClsModule.forRoot({
      global: true,
      middleware: {
        mount: true,
        generateId: true,
      },
    }),

    // Bull queues for background jobs
    BullModule.forRootAsync({
      useFactory: () => ({
        redis: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379', 10),
          password: process.env.REDIS_PASSWORD || undefined,
        },
      }),
    }),

    // Rate limiting
    ThrottlerModule.forRoot([{
      ttl: parseInt(process.env.THROTTLE_TTL || '60000', 10),
      limit: parseInt(process.env.THROTTLE_LIMIT || '100', 10),
    }]),

    // Prisma database
    PrismaModule,

    // Common services
    CommonServicesModule,

    // Feature modules
    AuthModule,
    TenantModule,
    IntegrationModule,
    WorkflowModule,
    TeamModule,
    UserModule,
    RolesModule,
    AnalyticsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
