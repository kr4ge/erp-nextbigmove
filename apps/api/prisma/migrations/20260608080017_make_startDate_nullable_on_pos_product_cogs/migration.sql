-- DropIndex
DROP INDEX "wms_purchasing_batches_paymentProofAssetId_idx";

-- DropIndex
DROP INDEX "wms_purchasing_batches_paymentProofSubmittedById_idx";

-- AlterTable
ALTER TABLE "media_assets" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "pos_product_cogs" ALTER COLUMN "startDate" DROP NOT NULL;

-- AlterTable
ALTER TABLE "reconcile_sales_attribution" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "wms_inventory_store_transfer_items" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "wms_inventory_store_transfers" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "wms_product_profile_equivalences" ALTER COLUMN "id" DROP DEFAULT;

-- RenameIndex
ALTER INDEX "marketing_kpi_user_category_assignments_tenantId_teamCode_categ" RENAME TO "marketing_kpi_user_category_assignments_tenantId_teamCode_c_idx";

-- RenameIndex
ALTER INDEX "marketing_kpi_user_category_assignments_tenantId_teamCode_userI" RENAME TO "marketing_kpi_user_category_assignments_tenantId_teamCode_u_key";

-- RenameIndex
ALTER INDEX "reconcile_sales_attribution_tenantId_date_campaignKey_mapp_key" RENAME TO "reconcile_sales_attribution_tenantId_date_campaignKey_mappi_key";

-- RenameIndex
ALTER INDEX "reconcile_sales_attribution_tenantId_date_teamCodeKey_mapping_i" RENAME TO "reconcile_sales_attribution_tenantId_date_teamCodeKey_mappi_idx";

-- RenameIndex
ALTER INDEX "wms_inventory_count_sessions_tenantId_warehouseId_status_create" RENAME TO "wms_inventory_count_sessions_tenantId_warehouseId_status_cr_idx";

-- RenameIndex
ALTER INDEX "wms_inventory_store_transfer_items_fromVariationId_toVariationI" RENAME TO "wms_inventory_store_transfer_items_fromVariationId_toVariat_idx";

-- RenameIndex
ALTER INDEX "wms_inventory_store_transfer_items_transferId_inventoryUnitId_k" RENAME TO "wms_inventory_store_transfer_items_transferId_inventoryUnit_key";

-- RenameIndex
ALTER INDEX "wms_inventory_store_transfers_tenantId_fromStoreId_toStoreId_id" RENAME TO "wms_inventory_store_transfers_tenantId_fromStoreId_toStoreI_idx";

-- RenameIndex
ALTER INDEX "wms_product_profile_equivalences_sourceProfileId_targetProfileI" RENAME TO "wms_product_profile_equivalences_sourceProfileId_targetProf_idx";

-- RenameIndex
ALTER INDEX "wms_product_profile_equivalences_tenantId_sourceProfileId_targe" RENAME TO "wms_product_profile_equivalences_tenantId_sourceProfileId_t_key";

-- RenameIndex
ALTER INDEX "wms_staff_activities_tenantId_resourceType_resourceId_createdAt" RENAME TO "wms_staff_activities_tenantId_resourceType_resourceId_creat_idx";
