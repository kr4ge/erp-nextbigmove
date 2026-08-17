import { registerAs } from '@nestjs/config';

export function applyDatabasePoolSettings(
  databaseUrl: string | undefined,
  settings: {
    connectionLimit?: string | number;
    poolTimeoutSeconds?: string | number;
  },
) {
  if (!databaseUrl) {
    return databaseUrl;
  }

  try {
    const parsed = new URL(databaseUrl);
    const connectionLimit = Number(settings.connectionLimit);
    const poolTimeoutSeconds = Number(settings.poolTimeoutSeconds);

    if (Number.isFinite(connectionLimit) && connectionLimit >= 1) {
      parsed.searchParams.set('connection_limit', String(Math.floor(connectionLimit)));
    }
    if (Number.isFinite(poolTimeoutSeconds) && poolTimeoutSeconds >= 1) {
      parsed.searchParams.set('pool_timeout', String(Math.floor(poolTimeoutSeconds)));
    }

    return parsed.toString();
  } catch {
    return databaseUrl;
  }
}

export default registerAs('database', () => ({
  url: applyDatabasePoolSettings(process.env.DATABASE_URL, {
    connectionLimit: process.env.DATABASE_CONNECTION_LIMIT,
    poolTimeoutSeconds: process.env.DATABASE_POOL_TIMEOUT_SECONDS,
  }),
}));
