-- Code128C encodes digit pairs, so numeric WMS unit barcodes must have an even digit count.
WITH odd_numeric_units AS (
  SELECT
    "id",
    "barcode",
    '0' || "barcode" AS padded_barcode
  FROM "wms_inventory_units"
  WHERE "barcode" ~ '^[0-9]+$'
    AND LENGTH("barcode") % 2 = 1
),
safe_padded_updates AS (
  SELECT
    odd_numeric_units."id",
    odd_numeric_units.padded_barcode AS next_barcode
  FROM odd_numeric_units
  WHERE NOT EXISTS (
    SELECT 1
    FROM "wms_inventory_units" existing
    WHERE existing."barcode" = odd_numeric_units.padded_barcode
      AND existing."id" <> odd_numeric_units."id"
  )
),
fallback_seed AS (
  SELECT GREATEST(
    10000000::numeric,
    COALESCE(
      (
        SELECT MAX("barcode"::numeric)
        FROM "wms_inventory_units"
        WHERE "barcode" ~ '^[0-9]+$'
      ),
      0::numeric
    )
  ) AS base_value
),
fallback_updates AS (
  SELECT
    odd_numeric_units."id",
    CASE
      WHEN LENGTH((fallback_seed.base_value + ROW_NUMBER() OVER (ORDER BY odd_numeric_units."id"))::text) % 2 = 0
        THEN (fallback_seed.base_value + ROW_NUMBER() OVER (ORDER BY odd_numeric_units."id"))::text
      ELSE '0' || (fallback_seed.base_value + ROW_NUMBER() OVER (ORDER BY odd_numeric_units."id"))::text
    END AS next_barcode
  FROM odd_numeric_units
  CROSS JOIN fallback_seed
  WHERE NOT EXISTS (
    SELECT 1
    FROM safe_padded_updates
    WHERE safe_padded_updates."id" = odd_numeric_units."id"
  )
),
barcode_updates AS (
  SELECT * FROM safe_padded_updates
  UNION ALL
  SELECT * FROM fallback_updates
)
UPDATE "wms_inventory_units"
SET "barcode" = barcode_updates.next_barcode
FROM barcode_updates
WHERE "wms_inventory_units"."id" = barcode_updates."id";

SELECT setval(
  'wms_inventory_unit_barcode_seq',
  GREATEST(
    10000001::bigint,
    COALESCE(
      (
        SELECT MAX("barcode"::bigint) + 1
        FROM "wms_inventory_units"
        WHERE "barcode" ~ '^[0-9]+$'
      ),
      10000001::bigint
    )
  ),
  false
);
