import { describe, expect, it, jest } from '@jest/globals';
import { WmsFulfillmentOrderStatus } from '@prisma/client';
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

describe('WmsFulfillmentSyncService transient empty-item cancellation recovery', () => {
  const eligibleOrder = {
    id: 'fulfillment-1',
    tenantId: 'tenant-1',
    storeId: 'store-1',
    warehouseId: null,
    shopId: 'shop-1',
    posOrderId: '161',
    status: WmsFulfillmentOrderStatus.CANCELED,
    completedAt: new Date('2026-09-02T03:55:03.656Z'),
    pickedQuantity: 0,
  };

  const createTransactionClient = (overrides: {
    transientWebhook?: { id: string } | null;
    pickedReservationCount?: number;
    basketUnitCount?: number;
    packingProofCount?: number;
    outboundRecordCount?: number;
    manualVoidCount?: number;
  } = {}) => ({
    pancakeWebhookLogOrder: {
      findFirst: jest.fn<() => Promise<{ id: string } | null>>().mockResolvedValue(
        overrides.transientWebhook === undefined
          ? { id: 'webhook-log-order-1' }
          : overrides.transientWebhook,
      ),
    },
    wmsPickReservation: {
      count: jest.fn<() => Promise<number>>().mockResolvedValue(overrides.pickedReservationCount ?? 0),
    },
    wmsBasketUnit: {
      count: jest.fn<() => Promise<number>>().mockResolvedValue(overrides.basketUnitCount ?? 0),
    },
    wmsPackingProof: {
      count: jest.fn<() => Promise<number>>().mockResolvedValue(overrides.packingProofCount ?? 0),
    },
    wmsOutboundUnitRecord: {
      count: jest.fn<() => Promise<number>>().mockResolvedValue(overrides.outboundRecordCount ?? 0),
    },
    wmsStaffActivity: {
      count: jest.fn<() => Promise<number>>().mockResolvedValue(overrides.manualVoidCount ?? 0),
    },
  });

  it('reopens only a confirmed order canceled by the transient empty-items webhook', async () => {
    const service = new WmsFulfillmentSyncService({} as any, {} as any, {} as any);
    const tx = createTransactionClient();

    const result = await (service as any).canRecoverTransientEmptyItemsCancellationTx(tx, {
      order: eligibleOrder,
      posOrder: { status: 1, isVoid: false },
      nextLines: [{ variationId: 'variation-1', quantityRequired: 1 }],
    });

    expect(result).toBe(true);
    expect(tx.pancakeWebhookLogOrder.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        shopId: 'shop-1',
        orderId: '161',
        reason: 'VOID_NO_PRODUCT_ITEMS',
        log: { tenantId: 'tenant-1' },
      }),
      select: { id: true },
    });
  });

  it.each([
    ['picked reservation history', { pickedReservationCount: 1 }],
    ['basket unit history', { basketUnitCount: 1 }],
    ['packing proof history', { packingProofCount: 1 }],
    ['outbound record history', { outboundRecordCount: 1 }],
    ['manual void activity', { manualVoidCount: 1 }],
    ['missing transient webhook evidence', { transientWebhook: null }],
  ])('does not reopen when %s exists', async (_label, overrides) => {
    const service = new WmsFulfillmentSyncService({} as any, {} as any, {} as any);
    const tx = createTransactionClient(overrides);

    const result = await (service as any).canRecoverTransientEmptyItemsCancellationTx(tx, {
      order: eligibleOrder,
      posOrder: { status: 1, isVoid: false },
      nextLines: [{ variationId: 'variation-1', quantityRequired: 1 }],
    });

    expect(result).toBe(false);
  });

  it('rejects canceled orders when POS is still void or no replacement lines exist', async () => {
    const service = new WmsFulfillmentSyncService({} as any, {} as any, {} as any);
    const tx = createTransactionClient();

    await expect((service as any).canRecoverTransientEmptyItemsCancellationTx(tx, {
      order: eligibleOrder,
      posOrder: { status: 1, isVoid: true },
      nextLines: [{ variationId: 'variation-1', quantityRequired: 1 }],
    })).resolves.toBe(false);
    await expect((service as any).canRecoverTransientEmptyItemsCancellationTx(tx, {
      order: eligibleOrder,
      posOrder: { status: 1, isVoid: false },
      nextLines: [],
    })).resolves.toBe(false);

    expect(tx.pancakeWebhookLogOrder.findFirst).not.toHaveBeenCalled();
  });
});
