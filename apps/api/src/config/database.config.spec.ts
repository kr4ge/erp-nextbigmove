import { describe, expect, it } from '@jest/globals';
import { applyDatabasePoolSettings } from './database.config';

describe('database pool settings', () => {
  it('applies explicit Prisma connection pool limits', () => {
    const result = applyDatabasePoolSettings(
      'postgresql://user:password@db.example.com:25060/erp?sslmode=require',
      { connectionLimit: 6, poolTimeoutSeconds: 10 },
    );
    const parsed = new URL(result!);

    expect(parsed.searchParams.get('connection_limit')).toBe('6');
    expect(parsed.searchParams.get('pool_timeout')).toBe('10');
    expect(parsed.searchParams.get('sslmode')).toBe('require');
  });

  it('preserves the original URL when settings are absent', () => {
    const original = 'postgresql://user:password@localhost:5432/erp';
    expect(applyDatabasePoolSettings(original, {})).toBe(`${original}`);
  });

  it('does not throw for an invalid URL', () => {
    expect(applyDatabasePoolSettings('not-a-url', { connectionLimit: 3 })).toBe('not-a-url');
  });
});
