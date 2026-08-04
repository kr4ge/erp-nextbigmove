import { ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { TeamContextService } from './team-context.service';

describe('TeamContextService tenant-wide analytics scope', () => {
  const prisma = {} as any;
  const cls = {
    get: jest.fn(),
  } as any;

  beforeEach(() => {
    cls.get.mockImplementation((key: string) => (
      key === 'tenantId' ? 'tenant-a' : undefined
    ));
  });

  it('enforces the current tenant even if input contains another tenant', () => {
    const service = new TeamContextService(prisma, cls);

    expect(service.buildTenantWhereClause({
      tenantId: 'tenant-b',
      dateLocal: '2026-08-04',
    })).toEqual({
      tenantId: 'tenant-a',
      dateLocal: '2026-08-04',
    });
  });

  it('returns unrestricted team scope for tenant-wide analytics', async () => {
    const service = new TeamContextService(prisma, cls);

    await expect(service.getAnalyticsTeamIds('sales')).resolves.toBeNull();
  });

  it('rejects analytics without a tenant boundary', () => {
    cls.get.mockReturnValue(undefined);
    const service = new TeamContextService(prisma, cls);

    expect(() => service.getTenantId()).toThrow(ForbiddenException);
  });
});
