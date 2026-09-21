import { ConflictException } from '@nestjs/common';
import { describe, expect, it, jest } from '@jest/globals';
import {
  Prisma,
  WmsBasketStatus,
  WmsBasketUnitStatus,
  WmsFulfillmentAssignmentMode,
  WmsFulfillmentLineStatus,
  WmsFulfillmentOrderStatus,
} from '@prisma/client';
import { WmsMobileService } from './wms-mobile.service';

describe('WmsMobileService demand packing serial reassignment', () => {
  const service = Object.create(WmsMobileService.prototype) as WmsMobileService;
  const asyncMock = <T>(value: T) => (
    jest.fn<(...args: unknown[]) => Promise<T>>().mockResolvedValue(value)
  );
  const params = {
    basketId: 'basket-1',
    basketCode: 'BASKET-001',
    basketUnit: {
      id: 'scanned-unit',
      status: WmsBasketUnitStatus.PICKED,
      fulfillmentOrderId: 'source-order',
      fulfillmentLineId: 'source-line',
      variationId: 'variation-1',
      productId: 'product-1',
    },
    targetOrderId: 'target-order',
    targetOrderCode: '2002',
    unitCode: 'SERIAL-001',
  };

  const callReassignment = (tx: unknown, overrides: Record<string, unknown> = {}) => (
    (service as unknown as {
      reassignDemandPackingUnitIfNeeded: (
        transaction: Prisma.TransactionClient,
        input: typeof params,
      ) => Promise<{ sourceOrderId: string; replacementUnitId: string } | null>;
    }).reassignDemandPackingUnitIfNeeded(tx as Prisma.TransactionClient, {
      ...params,
      ...overrides,
    })
  );

  it('keeps a unit already assigned to the selected order unchanged', async () => {
    const tx = {
      wmsFulfillmentOrder: { findUnique: jest.fn() },
      wmsBasketUnit: { findFirst: jest.fn(), updateMany: jest.fn() },
    };

    await expect(callReassignment(tx, {
      basketUnit: {
        ...params.basketUnit,
        fulfillmentOrderId: params.targetOrderId,
      },
    })).resolves.toBeNull();
    expect(tx.wmsFulfillmentOrder.findUnique).not.toHaveBeenCalled();
    expect(tx.wmsBasketUnit.updateMany).not.toHaveBeenCalled();
  });

  it('atomically exchanges equivalent unpacked serial assignments', async () => {
    const tx = {
      wmsFulfillmentOrder: {
        findUnique: asyncMock({
          posOrderId: '1001',
          status: WmsFulfillmentOrderStatus.PICKED,
          lines: [{ id: 'source-line' }],
        }),
      },
      wmsBasketUnit: {
        findFirst: asyncMock({
          id: 'replacement-unit',
          fulfillmentOrderId: params.targetOrderId,
        }),
        updateMany: asyncMock({ count: 1 }),
      },
    };

    await expect(callReassignment(tx)).resolves.toEqual({
      sourceOrderId: 'source-order',
      replacementUnitId: 'replacement-unit',
    });
    expect(tx.wmsBasketUnit.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'replacement-unit',
        status: WmsBasketUnitStatus.PICKED,
        fulfillmentOrderId: params.targetOrderId,
      },
      data: {
        fulfillmentOrderId: 'source-order',
        fulfillmentLineId: 'source-line',
      },
    });
  });

  it('never moves a serial that is already packed for another order', async () => {
    const tx = {
      wmsFulfillmentOrder: {
        findUnique: asyncMock({
          posOrderId: '1001',
          status: WmsFulfillmentOrderStatus.PACKING,
          lines: [{ id: 'source-line' }],
        }),
      },
      wmsBasketUnit: { findFirst: jest.fn(), updateMany: jest.fn() },
    };

    await expect(callReassignment(tx, {
      basketUnit: {
        ...params.basketUnit,
        status: WmsBasketUnitStatus.PACKED,
      },
    })).rejects.toThrow(new ConflictException('Unit SERIAL-001 is already packed for order 1001'));
    expect(tx.wmsBasketUnit.updateMany).not.toHaveBeenCalled();
  });

  it('fails safely when the selected order has no equivalent serial to exchange', async () => {
    const tx = {
      wmsFulfillmentOrder: {
        findUnique: asyncMock({
          posOrderId: '1001',
          status: WmsFulfillmentOrderStatus.PICKED,
          lines: [{ id: 'source-line' }],
        }),
      },
      wmsBasketUnit: {
        findFirst: asyncMock(null),
        updateMany: jest.fn(),
      },
    };

    await expect(callReassignment(tx)).rejects.toThrow(
      'Unit SERIAL-001 is allocated to order 1001. Scan a matching unpacked serial allocated to order 2002.',
    );
    expect(tx.wmsBasketUnit.updateMany).not.toHaveBeenCalled();
  });
});

describe('WmsMobileService demand packing basket manifest', () => {
  const service = Object.create(WmsMobileService.prototype) as WmsMobileService;

  const buildPlan = (basket: unknown, activeOrderId: string | null = null) => (
    (service as unknown as {
      buildMobileBasketPackPlan: (input: unknown, orderId: string | null) => {
        units: Array<Record<string, unknown>>;
      };
    }).buildMobileBasketPackPlan(basket, activeOrderId)
  );

  it('returns every active basket item with its scannable barcode and assigned order', () => {
    const order = {
      id: 'order-1',
      posOrderId: '44404',
      status: WmsFulfillmentOrderStatus.PACKING,
      assignmentMode: WmsFulfillmentAssignmentMode.BASKET_DEMAND,
      customerName: 'Test Customer',
      posOrder: { tracking: 'WAYBILL-1' },
      lines: [{
        id: 'line-1',
        variationId: 'variation-1',
        productId: 'product-1',
        productName: 'Red Clover Bracelet',
        productDisplayId: 'RCB-1',
        status: WmsFulfillmentLineStatus.PICKED,
        quantityRequired: 2,
      }],
      basketUnits: [{
        id: 'basket-unit-2',
        status: WmsBasketUnitStatus.PACKED,
        fulfillmentLineId: 'line-1',
      }],
    };
    const basket = {
      id: 'basket-1',
      barcode: 'BASKET-001',
      status: WmsBasketStatus.PACKING,
      fulfillmentOrders: [order],
      basketUnits: [
        {
          id: 'basket-unit-1',
          inventoryUnitId: 'inventory-unit-1',
          status: WmsBasketUnitStatus.PICKED,
          fulfillmentOrderId: 'order-1',
          fulfillmentLineId: 'line-1',
          variationId: 'variation-1',
          productId: 'product-1',
          inventoryUnit: {
            code: 'SERIAL-001',
            barcode: 'BARCODE-001',
            posProduct: { name: 'Red Clover Bracelet', customId: 'RCB-1' },
          },
          fulfillmentOrder: { id: 'order-1', posOrderId: '44404' },
        },
        {
          id: 'basket-unit-2',
          inventoryUnitId: 'inventory-unit-2',
          status: WmsBasketUnitStatus.PACKED,
          fulfillmentOrderId: 'order-1',
          fulfillmentLineId: 'line-1',
          variationId: 'variation-1',
          productId: 'product-1',
          inventoryUnit: {
            code: 'SERIAL-002',
            barcode: null,
            posProduct: { name: 'Red Clover Bracelet', customId: 'RCB-1' },
          },
          fulfillmentOrder: { id: 'order-1', posOrderId: '44404' },
        },
      ],
    };

    expect(buildPlan(basket, 'order-1').units).toEqual([
      expect.objectContaining({
        id: 'basket-unit-1',
        code: 'SERIAL-001',
        barcode: 'BARCODE-001',
        scannableCode: 'BARCODE-001',
        status: WmsBasketUnitStatus.PICKED,
        assignedOrder: { id: 'order-1', posOrderId: '44404' },
      }),
      expect.objectContaining({
        id: 'basket-unit-2',
        code: 'SERIAL-002',
        barcode: null,
        scannableCode: 'SERIAL-002',
        status: WmsBasketUnitStatus.PACKED,
        assignedOrder: { id: 'order-1', posOrderId: '44404' },
      }),
    ]);
  });
});
