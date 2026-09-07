-- Backfill pos_orders.mapping to the canonical pv::<storeId>::<variationId> key.
--
-- Why: mapping is the join key between ad spend and sales. Orders synced before
-- the store+variation keys shipped carry coarse labels ("pesticide"), so the
-- same product splits into multiple analytics buckets across naming eras.
-- This rewrites every order that resolves to EXACTLY ONE product variation
-- (via its persisted itemData) to the same key new orders get. Multi-product
-- orders and orders whose items match no product are left untouched.
--
-- Safe to re-run (idempotent). Run AFTER deploying the mapping-key release,
-- and BEFORE re-running the reconcile workflow (reconcile copies this value).
--
--   psql "$DATABASE_URL" -f scripts/backfill-order-mapping.sql

BEGIN;

WITH resolved AS (
  SELECT o.id,
         MIN(LOWER(p."storeId"::text)) AS store_id,
         MIN(LOWER(p."variationId"))   AS variation_id
  FROM pos_orders o
  JOIN pos_stores s
    ON s."shopId" = o."shopId"
   AND s."tenantId" = o."tenantId"
  CROSS JOIN LATERAL jsonb_array_elements(o."itemData"::jsonb) AS item
  JOIN pos_products p
    ON p."storeId" = s.id
   AND p."productId" = item->>'productId'
  WHERE p."variationId" IS NOT NULL
  GROUP BY o.id
  HAVING COUNT(DISTINCT p."variationId") = 1
)
UPDATE pos_orders o
SET mapping = 'pv::' || r.store_id || '::' || r.variation_id
FROM resolved r
WHERE o.id = r.id
  AND o.mapping IS DISTINCT FROM 'pv::' || r.store_id || '::' || r.variation_id;

-- Report what changed before committing.
SELECT COUNT(*) AS orders_with_pv_key FROM pos_orders WHERE mapping LIKE 'pv::%';

COMMIT;
