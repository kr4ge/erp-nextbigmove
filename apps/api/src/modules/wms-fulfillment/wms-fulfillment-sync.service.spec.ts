import { describe, expect, it, jest } from '@jest/globals';
import { WmsFulfillmentSyncService } from './wms-fulfillment-sync.service';

describe('WmsFulfillmentSyncService.reconcileCanceledPickingOrderRefs', () => {
  it('deduplicates canceled order references and reconciles each store scope', async () => {
    const service = new WmsFulfillmentSyncService({} as any, {} as any);
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
    const service = new WmsFulfillmentSyncService({} as any, {} as any);
    const reconcile = jest.spyOn(service as any, 'syncCanceledPickingOrders');

    const result = await service.reconcileCanceledPickingOrderRefs({
      actorId: null,
      orders: [],
    });

    expect(result).toEqual({ cleanedOrders: 0 });
    expect(reconcile).not.toHaveBeenCalled();
  });
});
