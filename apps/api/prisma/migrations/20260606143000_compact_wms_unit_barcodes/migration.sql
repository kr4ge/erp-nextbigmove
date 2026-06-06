-- Preserve the long WMS unit code while making the scannable barcode shorter.
-- Existing labels with the old long value still resolve through wms_inventory_units.code.
WITH legacy_units AS (
  SELECT
    "id",
    "code",
    NULLIF(regexp_replace("code", '\D', '', 'g'), '') AS digits
  FROM "wms_inventory_units"
  WHERE "barcode" = "code"
),
candidates AS (
  SELECT
    "id",
    CASE
      WHEN digits IS NULL THEN NULL
      ELSE (digits::numeric)::text
    END AS desired_barcode
  FROM legacy_units
),
ranked_candidates AS (
  SELECT
    "id",
    desired_barcode,
    COUNT(*) OVER (PARTITION BY desired_barcode) AS desired_count
  FROM candidates
),
existing_numeric_barcodes AS (
  SELECT "barcode"
  FROM "wms_inventory_units"
  WHERE "barcode" ~ '^[0-9]+$'
    AND "id" NOT IN (SELECT "id" FROM legacy_units)
),
preferred_updates AS (
  SELECT
    ranked_candidates."id",
    ranked_candidates.desired_barcode AS next_barcode
  FROM ranked_candidates
  WHERE ranked_candidates.desired_barcode IS NOT NULL
    AND ranked_candidates.desired_count = 1
    AND NOT EXISTS (
      SELECT 1
      FROM existing_numeric_barcodes
      WHERE existing_numeric_barcodes."barcode" = ranked_candidates.desired_barcode
    )
),
barcode_seed AS (
  SELECT GREATEST(
    10000000::numeric,
    COALESCE((SELECT MAX("barcode"::numeric) FROM existing_numeric_barcodes), 0::numeric),
    COALESCE((SELECT MAX(next_barcode::numeric) FROM preferred_updates), 0::numeric)
  ) AS base_value
),
fallback_updates AS (
  SELECT
    ranked_candidates."id",
    (barcode_seed.base_value + ROW_NUMBER() OVER (ORDER BY ranked_candidates."id"))::text AS next_barcode
  FROM ranked_candidates
  CROSS JOIN barcode_seed
  WHERE NOT EXISTS (
    SELECT 1
    FROM preferred_updates
    WHERE preferred_updates."id" = ranked_candidates."id"
  )
),
barcode_updates AS (
  SELECT * FROM preferred_updates
  UNION ALL
  SELECT * FROM fallback_updates
)
UPDATE "wms_inventory_units"
SET "barcode" = barcode_updates.next_barcode
FROM barcode_updates
WHERE "wms_inventory_units"."id" = barcode_updates."id";

CREATE SEQUENCE IF NOT EXISTS "wms_inventory_unit_barcode_seq";

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
