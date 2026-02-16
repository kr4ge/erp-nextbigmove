import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import helmet from 'helmet';
import * as compression from 'compression';
import { webcrypto } from 'crypto';

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
  const corsOrigins = process.env.NODE_ENV === 'production'
    ? [process.env.CORS_ORIGIN_WEB, process.env.CORS_ORIGIN_ADMIN].filter((o): o is string => !!o)
    : ['http://localhost:3000', 'http://localhost:3002'];

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID', 'X-Team-ID'],
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
  await app.listen(port);

  console.log(`🚀 API running on http://localhost:${port}/api/v1`);
}

bootstrap();
