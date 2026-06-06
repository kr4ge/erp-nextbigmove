-- Add immutable per-unit COGS for WMS-managed inventory.
ALTER TABLE "wms_inventory_units"
ADD COLUMN "unitCost" DECIMAL(14, 2);

-- Prefer the receiving line cost used to create the units.
UPDATE "wms_inventory_units" AS unit
SET "unitCost" = matched."unitCost"
FROM (
  SELECT DISTINCT ON ("batchId", "resolvedProfileId")
    "batchId",
    "resolvedProfileId",
    "unitCost"
  FROM "wms_receiving_lines"
  WHERE "unitCost" IS NOT NULL
    AND "resolvedProfileId" IS NOT NULL
  ORDER BY "batchId", "resolvedProfileId", "createdAt" ASC, "lineNo" ASC
) AS matched
WHERE unit."unitCost" IS NULL
  AND unit."receivingBatchId" = matched."batchId"
  AND unit."productProfileId" = matched."resolvedProfileId";

-- Fallback for older units where receiving line cost was not available.
UPDATE "wms_inventory_units" AS unit
SET "unitCost" = COALESCE(profile."supplierUnitCost", profile."inhouseUnitCost")
FROM "wms_product_profiles" AS profile
WHERE unit."unitCost" IS NULL
  AND unit."productProfileId" = profile."id"
  AND COALESCE(profile."supplierUnitCost", profile."inhouseUnitCost") IS NOT NULL;
