import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import helmet from 'helmet';
import * as compression from 'compression';
import { webcrypto } from 'crypto';
import { resolveAllowedCorsOrigins } from './common/services/cors-config.service';

// Ensure global crypto is available for libraries that rely on Web Crypto APIs
if (!globalThis.crypto) {
  (globalThis as any).crypto = webcrypto;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });

  // Security middleware
  app.use(helmet());
  app.use(compression());

  // CORS configuration
  const corsOrigins = resolveAllowedCorsOrigins();
  if (process.env.NODE_ENV === 'production' && corsOrigins.length === 0) {
    console.warn('No CORS origins configured. Browser cross-origin requests will be blocked.');
  }

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Tenant-ID',
      'X-Team-ID',
      'X-API-KEY',
      'X-Client-Platform',
      'X-Device-ID',
      'X-Device-Name',
    ],
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // API prefix
  app.setGlobalPrefix('api/v1');

  const port = process.env.PORT || 3001;
  const host = process.env.HOST || '0.0.0.0';
  await app.listen(port, host);

  console.log(`🚀 API running on http://${host}:${port}/api/v1`);
}

bootstrap();
