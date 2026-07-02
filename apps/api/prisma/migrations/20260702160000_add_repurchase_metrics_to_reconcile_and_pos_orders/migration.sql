ALTER TABLE "pos_orders"
ADD COLUMN "isRepurchase" BOOLEAN NOT NULL DEFAULT false;

UPDATE "pos_orders"
SET "isRepurchase" = EXISTS (
  SELECT 1
  FROM jsonb_array_elements(COALESCE("tags"::jsonb, '[]'::jsonb)) AS tag(value)
  WHERE LOWER(BTRIM(
    CASE
      WHEN jsonb_typeof(tag.value) = 'object' THEN COALESCE(tag.value->>'name', '')
      WHEN jsonb_typeof(tag.value) = 'string' THEN TRIM(BOTH '"' FROM tag.value::text)
      ELSE ''
    END
  )) = 'repurchase'
);

ALTER TABLE "reconcile_marketing"
ADD COLUMN "repurchaseCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "repurchaseProcessedPurchasesPos" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "repurchaseCodPos" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "repurchaseCogsPos" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "repurchaseCogsCanceledPos" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "repurchaseCogsRestockingPos" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "repurchaseCogsRtsPos" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "repurchaseCogsDeliveredPos" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "repurchaseSfPos" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "repurchaseFfPos" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "repurchaseIfPos" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "repurchaseSfSdrPos" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "repurchaseFfSdrPos" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "repurchaseIfSdrPos" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "repurchaseCodFeePos" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "repurchaseCodFeeDeliveredPos" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "repurchaseCanceledCodPos" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "repurchaseRtsCodPos" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "repurchaseDeliveredCodPos" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "repurchaseShippedCodPos" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "repurchaseWaitingPickupCodPos" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "repurchaseRestockingCodPos" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "repurchaseConfirmedCodPos" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "repurchaseUnconfirmedCodPos" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "repurchaseAbandonedCodPos" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "repurchaseConfirmedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "repurchaseUnconfirmedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "repurchasePrintedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "repurchaseAbandonedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "repurchaseWaitingPickupCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "repurchaseShippedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "repurchaseDeliveredCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "repurchaseCanceledCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "repurchaseDeletedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "repurchaseRtsCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "repurchaseRestockingCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "reconcile_sales"
ADD COLUMN "repurchaseCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "repurchaseProcessedPurchasesPos" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "repurchaseConfirmedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "repurchaseUnconfirmedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "repurchasePrintedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "repurchaseWaitingPickupCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "repurchaseShippedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "repurchaseDeliveredCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "repurchaseCanceledCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "repurchaseDeletedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "repurchaseRtsCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "repurchaseRestockingCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "repurchaseAbandonedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "repurchaseCodPos" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "repurchaseDeliveredCodPos" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "repurchaseShippedCodPos" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "repurchaseWaitingPickupCodPos" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "repurchaseRtsCodPos" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "repurchaseCanceledCodPos" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "repurchaseRestockingCodPos" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "repurchaseConfirmedCodPos" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "repurchaseUnconfirmedCodPos" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "repurchaseAbandonedCodPos" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "repurchaseCogsPos" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "repurchaseCogsCanceledPos" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "repurchaseCogsRestockingPos" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "repurchaseCogsRtsPos" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "repurchaseCogsDeliveredPos" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "repurchaseSfPos" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "repurchaseFfPos" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "repurchaseIfPos" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "repurchaseSfSdrPos" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "repurchaseFfSdrPos" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "repurchaseIfSdrPos" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "repurchaseCodFeePos" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "repurchaseCodFeeDeliveredPos" DECIMAL(12,2) NOT NULL DEFAULT 0;
