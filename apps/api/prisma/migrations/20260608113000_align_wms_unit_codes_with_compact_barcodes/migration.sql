-- Keep the Code128C barcode numeric, but align the human unit code to:
--   tenant-prefix + compact barcode
-- Example: barcode 0100000062 for tenant slug JTC becomes unit code JTC0100000062.
WITH unit_sources AS (
  SELECT
    unit."id",
    unit."code",
    unit."barcode",
    COALESCE(NULLIF(TRIM(tenant."slug"), ''), NULLIF(TRIM(tenant."name"), ''), 'partner') AS source_label
  FROM "wms_inventory_units" AS unit
  JOIN "tenants" AS tenant ON tenant."id" = unit."tenantId"
  WHERE unit."barcode" ~ '^[0-9]+$'
),
normalized_sources AS (
  SELECT
    "id",
    "code",
    "barcode",
    UPPER(TRIM(REGEXP_REPLACE(source_label, '[^A-Za-z0-9]+', ' ', 'g'))) AS normalized_label
  FROM unit_sources
),
prefix_sources AS (
  SELECT
    "id",
    "code",
    "barcode",
    REGEXP_REPLACE(normalized_label, '[^A-Z0-9]', '', 'g') AS compact_label,
    ARRAY(
      SELECT token.value
      FROM REGEXP_SPLIT_TO_TABLE(normalized_label, '\s+') AS token(value)
      WHERE token.value <> ''
    ) AS label_words
  FROM normalized_sources
),
prefix_parts AS (
  SELECT
    "id",
    "code",
    "barcode",
    compact_label,
    label_words,
    COALESCE(
      (
        SELECT STRING_AGG(SUBSTR(word.value, 1, 1), '')
        FROM UNNEST(label_words) AS word(value)
      ),
      ''
    ) AS initials
  FROM prefix_sources
),
desired_codes AS (
  SELECT
    "id",
    "code",
    (
      SUBSTR(
        COALESCE(
          NULLIF(
            CASE
              WHEN ARRAY_LENGTH(label_words, 1) > 1 THEN initials
              ELSE compact_label
            END,
            ''
          ),
          'PRT'
        ) || 'XXX',
        1,
        3
      ) || "barcode"
    ) AS desired_code
  FROM prefix_parts
),
safe_updates AS (
  SELECT desired_codes.*
  FROM desired_codes
  WHERE desired_codes.desired_code <> desired_codes."code"
    AND NOT EXISTS (
      SELECT 1
      FROM "wms_inventory_units" AS existing
      WHERE existing."code" = desired_codes.desired_code
        AND existing."id" <> desired_codes."id"
    )
)
UPDATE "wms_inventory_units"
SET "code" = safe_updates.desired_code
FROM safe_updates
WHERE "wms_inventory_units"."id" = safe_updates."id";
