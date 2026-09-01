import { describe, expect, it, jest } from '@jest/globals';
import { WMS_DEMAND_QUEUE_REFRESH_JOB } from './wms-fulfillment.constants';
import { WmsFulfillmentSyncService } from './wms-fulfillment-sync.service';

describe('WmsFulfillmentSyncService.reconcileCanceledPickingOrderRefs', () => {
  it('deduplicates canceled order references and reconciles each store scope', async () => {
    const service = new WmsFulfillmentSyncService({} as any, {} as any, {} as any);
    const reconcile = jest
      .spyOn(service as any, 'syncCanceledPickingOrders')
      .mockResolvedValueOnce({ cleanedOrders: 2 })
      .mockResolvedValueOnce({ cleanedOrders: 1 });

    const result = await service.reconcileCanceledPickingOrderRefs({
      actorId: 'user-1',
      orders: [
        {
          tenantId: 'tenant-1',
          storeId: 'store-1',
          shopId: 'shop-1',
          posOrderId: '100',
        },
        {
          tenantId: 'tenant-1',
          storeId: 'store-1',
          shopId: 'shop-1',
          posOrderId: '100',
        },
        {
          tenantId: 'tenant-1',
          storeId: 'store-1',
          shopId: 'shop-1',
          posOrderId: '101',
        },
        {
          tenantId: 'tenant-2',
          storeId: 'store-2',
          shopId: 'shop-2',
          posOrderId: '200',
        },
      ],
    });

    expect(result).toEqual({ cleanedOrders: 3 });
    expect(reconcile).toHaveBeenCalledTimes(2);
    expect(reconcile).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        tenantId: 'tenant-1',
        storeId: 'store-1',
        actorId: 'user-1',
        posOrderRefs: [
          { shopId: 'shop-1', posOrderId: '100' },
          { shopId: 'shop-1', posOrderId: '101' },
        ],
      }),
      [{ id: 'store-1', tenantId: 'tenant-1', shopId: 'shop-1' }],
    );
    expect(reconcile).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        tenantId: 'tenant-2',
        storeId: 'store-2',
        actorId: 'user-1',
        posOrderRefs: [{ shopId: 'shop-2', posOrderId: '200' }],
      }),
      [{ id: 'store-2', tenantId: 'tenant-2', shopId: 'shop-2' }],
    );
  });

  it('does not query fulfillment state when no valid order references are provided', async () => {
    const service = new WmsFulfillmentSyncService({} as any, {} as any, {} as any);
    const reconcile = jest.spyOn(service as any, 'syncCanceledPickingOrders');

    const result = await service.reconcileCanceledPickingOrderRefs({
      actorId: null,
      orders: [],
    });

    expect(result).toEqual({ cleanedOrders: 0 });
    expect(reconcile).not.toHaveBeenCalled();
  });

  it('commits canceled basket cleanup before queueing the store-wide demand refresh', async () => {
    const transactionClient = {
      wmsFulfillmentOrder: {
        findMany: jest.fn<() => Promise<any[]>>().mockResolvedValue([
          {
            id: 'fulfillment-1',
            tenantId: 'tenant-1',
            storeId: 'store-1',
            assignmentMode: 'BASKET_DEMAND',
            basketId: null,
            basketUnits: [],
            posOrder: { status: 6, isVoid: false },
          },
        ]),
      },
    };
    const prisma = {
      posOrder: {
        findMany: jest.fn<() => Promise<any[]>>().mockResolvedValue([{ id: 'pos-order-db-1' }]),
      },
      $transaction: jest.fn(async (callback: any) => callback(transactionClient)),
    };
    const queue = {
      add: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue({ id: 'refresh-job-1' }),
    };
    const service = new WmsFulfillmentSyncService(prisma as any, {} as any, queue as any);
    jest.spyOn(service as any, 'buildTenantGoLiveOrderFilters').mockResolvedValue([{}]);
    jest.spyOn(service as any, 'releaseCanceledDemandOrderTx').mockResolvedValue(undefined);
    const refreshInsideTransaction = jest.spyOn(service as any, 'refreshDemandFulfillmentQueueTx');

    const result = await (service as any).syncCanceledPickingOrders({
      tenantId: 'tenant-1',
      storeId: 'store-1',
      stores: [{ id: 'store-1', tenantId: 'tenant-1', shopId: 'shop-1' }],
      actorId: 'user-1',
      posOrderRefs: [{ shopId: 'shop-1', posOrderId: '100' }],
    }, [{ id: 'store-1', tenantId: 'tenant-1', shopId: 'shop-1' }]);

    expect(result).toEqual({ cleanedOrders: 1 });
    expect(prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { timeout: 90000, maxWait: 10000 },
    );
    expect(refreshInsideTransaction).not.toHaveBeenCalled();
    expect(queue.add).toHaveBeenCalledWith(
      WMS_DEMAND_QUEUE_REFRESH_JOB,
      expect.objectContaining({
        tenantId: 'tenant-1',
        storeId: 'store-1',
      }),
      expect.objectContaining({
        attempts: 4,
        removeOnComplete: true,
      }),
    );
    expect(prisma.$transaction.mock.invocationCallOrder[0])
      .toBeLessThan(queue.add.mock.invocationCallOrder[0]);
  });
});
