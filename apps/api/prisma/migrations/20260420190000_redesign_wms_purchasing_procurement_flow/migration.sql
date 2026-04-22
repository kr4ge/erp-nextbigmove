CREATE TYPE "WmsPurchasingBatchStatus_new" AS ENUM (
  'UNDER_REVIEW',
  'REVISION',
  'PENDING_PAYMENT',
  'PAYMENT_REVIEW',
  'RECEIVING_READY',
  'RECEIVING',
  'STOCKED',
  'REJECTED',
  'CANCELED'
);

ALTER TABLE "wms_purchasing_batches"
ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "wms_purchasing_batches"
ALTER COLUMN "status" TYPE "WmsPurchasingBatchStatus_new"
USING (
  CASE
    WHEN "status"::text = 'SUBMITTED' THEN 'UNDER_REVIEW'
    WHEN "status"::text = 'UNDER_REVIEW' THEN 'UNDER_REVIEW'
    WHEN "status"::text = 'WAITING_PARTNER' THEN 'PENDING_PAYMENT'
    WHEN "status"::text = 'APPROVED' AND "paymentVerifiedAt" IS NOT NULL THEN 'RECEIVING_READY'
    WHEN "status"::text = 'APPROVED' THEN 'PAYMENT_REVIEW'
    WHEN "status"::text = 'READY_FOR_RECEIVING' THEN 'RECEIVING_READY'
    WHEN "status"::text = 'PARTIALLY_RECEIVED' THEN 'RECEIVING'
    WHEN "status"::text = 'RECEIVED' THEN 'STOCKED'
    WHEN "status"::text = 'REJECTED' THEN 'REJECTED'
    WHEN "status"::text = 'CANCELED' THEN 'CANCELED'
    ELSE 'UNDER_REVIEW'
  END
)::"WmsPurchasingBatchStatus_new";

ALTER TABLE "wms_purchasing_events"
ALTER COLUMN "fromStatus" TYPE "WmsPurchasingBatchStatus_new"
USING (
  CASE
    WHEN "fromStatus" IS NULL THEN NULL
    WHEN "fromStatus"::text = 'SUBMITTED' THEN 'UNDER_REVIEW'
    WHEN "fromStatus"::text = 'UNDER_REVIEW' THEN 'UNDER_REVIEW'
    WHEN "fromStatus"::text = 'WAITING_PARTNER' THEN 'PENDING_PAYMENT'
    WHEN "fromStatus"::text = 'APPROVED' THEN 'PAYMENT_REVIEW'
    WHEN "fromStatus"::text = 'READY_FOR_RECEIVING' THEN 'RECEIVING_READY'
    WHEN "fromStatus"::text = 'PARTIALLY_RECEIVED' THEN 'RECEIVING'
    WHEN "fromStatus"::text = 'RECEIVED' THEN 'STOCKED'
    WHEN "fromStatus"::text = 'REJECTED' THEN 'REJECTED'
    WHEN "fromStatus"::text = 'CANCELED' THEN 'CANCELED'
    ELSE 'UNDER_REVIEW'
  END
)::"WmsPurchasingBatchStatus_new";

ALTER TABLE "wms_purchasing_events"
ALTER COLUMN "toStatus" TYPE "WmsPurchasingBatchStatus_new"
USING (
  CASE
    WHEN "toStatus" IS NULL THEN NULL
    WHEN "toStatus"::text = 'SUBMITTED' THEN 'UNDER_REVIEW'
    WHEN "toStatus"::text = 'UNDER_REVIEW' THEN 'UNDER_REVIEW'
    WHEN "toStatus"::text = 'WAITING_PARTNER' THEN 'PENDING_PAYMENT'
    WHEN "toStatus"::text = 'APPROVED' THEN 'PAYMENT_REVIEW'
    WHEN "toStatus"::text = 'READY_FOR_RECEIVING' THEN 'RECEIVING_READY'
    WHEN "toStatus"::text = 'PARTIALLY_RECEIVED' THEN 'RECEIVING'
    WHEN "toStatus"::text = 'RECEIVED' THEN 'STOCKED'
    WHEN "toStatus"::text = 'REJECTED' THEN 'REJECTED'
    WHEN "toStatus"::text = 'CANCELED' THEN 'CANCELED'
    ELSE 'UNDER_REVIEW'
  END
)::"WmsPurchasingBatchStatus_new";

DROP TYPE "WmsPurchasingBatchStatus";

ALTER TYPE "WmsPurchasingBatchStatus_new"
RENAME TO "WmsPurchasingBatchStatus";

ALTER TABLE "wms_purchasing_batches"
ALTER COLUMN "status" SET DEFAULT 'UNDER_REVIEW';
