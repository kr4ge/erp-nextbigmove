-- WMS serialized unit cost should use inhouse/partner COGS, not supplier COGS.
-- This forward correction only updates rows that are null or appear to have inherited supplier COGS.

WITH procurement_line_targets AS (
  SELECT
    receiving_line."id",
    COALESCE(purchasing_line."partnerUnitCost", profile."inhouseUnitCost") AS target_unit_cost,
    purchasing_line."supplierUnitCost" AS line_supplier_unit_cost,
    profile."supplierUnitCost" AS profile_supplier_unit_cost
  FROM "wms_receiving_lines" AS receiving_line
  JOIN "wms_receiving_batches" AS receiving_batch
    ON receiving_batch."id" = receiving_line."batchId"
  JOIN "wms_purchasing_batches" AS purchasing_batch
    ON purchasing_batch."id" = receiving_batch."purchasingBatchId"
  LEFT JOIN "wms_purchasing_batch_lines" AS purchasing_line
    ON purchasing_line."id" = receiving_line."purchasingBatchLineId"
  LEFT JOIN "wms_product_profiles" AS profile
    ON profile."id" = receiving_line."resolvedProfileId"
  WHERE purchasing_batch."requestType" = 'PROCUREMENT'
    AND COALESCE(purchasing_line."partnerUnitCost", profile."inhouseUnitCost") IS NOT NULL
),
manual_line_targets AS (
  SELECT
    receiving_line."id",
    profile."inhouseUnitCost" AS target_unit_cost,
    NULL::DECIMAL(14, 2) AS line_supplier_unit_cost,
    profile."supplierUnitCost" AS profile_supplier_unit_cost
  FROM "wms_receiving_lines" AS receiving_line
  JOIN "wms_receiving_batches" AS receiving_batch
    ON receiving_batch."id" = receiving_line."batchId"
  JOIN "wms_product_profiles" AS profile
    ON profile."id" = receiving_line."resolvedProfileId"
  WHERE receiving_batch."purchasingBatchId" IS NULL
    AND profile."inhouseUnitCost" IS NOT NULL
),
receiving_line_targets AS (
  SELECT * FROM procurement_line_targets
  UNION ALL
  SELECT * FROM manual_line_targets
)
UPDATE "wms_receiving_lines" AS receiving_line
SET "unitCost" = receiving_line_targets.target_unit_cost
FROM receiving_line_targets
WHERE receiving_line."id" = receiving_line_targets."id"
  AND (
    receiving_line."unitCost" IS NULL
    OR receiving_line."unitCost" = receiving_line_targets.line_supplier_unit_cost
    OR receiving_line."unitCost" = receiving_line_targets.profile_supplier_unit_cost
  );

WITH unit_targets AS (
  SELECT DISTINCT ON (unit."id")
    unit."id",
    COALESCE(purchasing_line."partnerUnitCost", profile."inhouseUnitCost") AS target_unit_cost,
    purchasing_line."supplierUnitCost" AS line_supplier_unit_cost,
    profile."supplierUnitCost" AS profile_supplier_unit_cost
  FROM "wms_inventory_units" AS unit
  JOIN "wms_product_profiles" AS profile
    ON profile."id" = unit."productProfileId"
  LEFT JOIN "wms_receiving_batches" AS receiving_batch
    ON receiving_batch."id" = unit."receivingBatchId"
  LEFT JOIN "wms_purchasing_batches" AS purchasing_batch
    ON purchasing_batch."id" = receiving_batch."purchasingBatchId"
  LEFT JOIN "wms_receiving_lines" AS receiving_line
    ON receiving_line."batchId" = unit."receivingBatchId"
    AND receiving_line."resolvedProfileId" = unit."productProfileId"
  LEFT JOIN "wms_purchasing_batch_lines" AS purchasing_line
    ON purchasing_line."id" = receiving_line."purchasingBatchLineId"
  WHERE profile."inhouseUnitCost" IS NOT NULL
    AND (
      unit."sourceType" = 'MANUAL_INPUT'
      OR purchasing_batch."requestType" = 'PROCUREMENT'
    )
  ORDER BY unit."id", receiving_line."lineNo" ASC NULLS LAST
)
UPDATE "wms_inventory_units" AS unit
SET "unitCost" = unit_targets.target_unit_cost
FROM unit_targets
WHERE unit."id" = unit_targets."id"
  AND unit_targets.target_unit_cost IS NOT NULL
  AND (
    unit."unitCost" IS NULL
    OR unit."unitCost" = unit_targets.line_supplier_unit_cost
    OR unit."unitCost" = unit_targets.profile_supplier_unit_cost
  );
