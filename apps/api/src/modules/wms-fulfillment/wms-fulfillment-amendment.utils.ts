import { createHash } from 'crypto';

export type FulfillmentDemandItem = {
  variationId: string;
  productId: string | null;
  productName: string;
  productDisplayId: string | null;
  quantityRequired: number;
};

export type FulfillmentDemandChange = FulfillmentDemandItem & {
  previousQuantity: number;
  nextQuantity: number;
  delta: number;
};

export type FulfillmentDemandDiff = {
  hasChanges: boolean;
  added: FulfillmentDemandChange[];
  removed: FulfillmentDemandChange[];
  increased: FulfillmentDemandChange[];
  decreased: FulfillmentDemandChange[];
};

function normalize(items: FulfillmentDemandItem[]) {
  const byVariation = new Map<string, FulfillmentDemandItem>();
  for (const item of items) {
    const variationId = item.variationId?.trim();
    const quantityRequired = Math.max(Math.trunc(item.quantityRequired), 0);
    if (!variationId || quantityRequired <= 0) continue;
    const existing = byVariation.get(variationId);
    byVariation.set(variationId, {
      variationId,
      productId: item.productId?.trim() || existing?.productId || null,
      productName: item.productName.trim() || existing?.productName || variationId,
      productDisplayId: item.productDisplayId?.trim() || existing?.productDisplayId || null,
      quantityRequired: (existing?.quantityRequired ?? 0) + quantityRequired,
    });
  }
  return Array.from(byVariation.values())
    .sort((left, right) => left.variationId.localeCompare(right.variationId));
}

export function buildFulfillmentDemandHash(items: FulfillmentDemandItem[]) {
  const demandIdentity = normalize(items).map((item) => ({
    variationId: item.variationId,
    quantityRequired: item.quantityRequired,
  }));
  return createHash('sha256').update(JSON.stringify(demandIdentity)).digest('hex');
}

export function diffFulfillmentDemand(
  previousItems: FulfillmentDemandItem[],
  nextItems: FulfillmentDemandItem[],
): FulfillmentDemandDiff {
  const previousByVariation = new Map(normalize(previousItems).map((item) => [item.variationId, item]));
  const nextByVariation = new Map(normalize(nextItems).map((item) => [item.variationId, item]));
  const variationIds = Array.from(new Set([
    ...previousByVariation.keys(),
    ...nextByVariation.keys(),
  ])).sort();
  const result: FulfillmentDemandDiff = {
    hasChanges: false,
    added: [],
    removed: [],
    increased: [],
    decreased: [],
  };

  for (const variationId of variationIds) {
    const previous = previousByVariation.get(variationId);
    const next = nextByVariation.get(variationId);
    const previousQuantity = previous?.quantityRequired ?? 0;
    const nextQuantity = next?.quantityRequired ?? 0;
    if (previousQuantity === nextQuantity) {
      continue;
    }

    const item = next ?? previous!;
    const change: FulfillmentDemandChange = {
      ...item,
      previousQuantity,
      nextQuantity,
      delta: nextQuantity - previousQuantity,
    };
    result.hasChanges = true;
    if (previousQuantity === 0) {
      result.added.push(change);
    } else if (nextQuantity === 0) {
      result.removed.push(change);
    } else if (nextQuantity > previousQuantity) {
      result.increased.push(change);
    } else {
      result.decreased.push(change);
    }
  }

  return result;
}

export function summarizeFulfillmentDemandDiff(diff: FulfillmentDemandDiff) {
  const addedUnits = [...diff.added, ...diff.increased]
    .reduce((sum, item) => sum + Math.max(item.delta, 0), 0);
  const removedUnits = [...diff.removed, ...diff.decreased]
    .reduce((sum, item) => sum + Math.max(-item.delta, 0), 0);

  return {
    ...diff,
    addedUnits,
    removedUnits,
    message: addedUnits > 0 && removedUnits > 0
      ? `${addedUnits} item${addedUnits === 1 ? '' : 's'} added and ${removedUnits} item${removedUnits === 1 ? '' : 's'} removed.`
      : addedUnits > 0
        ? `${addedUnits} additional item${addedUnits === 1 ? '' : 's'} must be picked.`
        : `${removedUnits} excess item${removedUnits === 1 ? '' : 's'} must be removed.`,
  };
}
