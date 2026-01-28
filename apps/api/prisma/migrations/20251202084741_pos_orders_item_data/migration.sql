/*
  Warnings:

  - You are about to drop the column `accountName` on the `pos_orders` table. All the data in the column will be lost.
  - You are about to drop the column `currency` on the `pos_orders` table. All the data in the column will be lost.
  - You are about to drop the column `data` on the `pos_orders` table. All the data in the column will be lost.
  - You are about to drop the column `productDisplayId` on the `pos_orders` table. All the data in the column will be lost.
  - You are about to drop the column `productName` on the `pos_orders` table. All the data in the column will be lost.
  - You are about to drop the column `total` on the `pos_orders` table. All the data in the column will be lost.
  - You are about to drop the column `warehouseName` on the `pos_orders` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "pos_orders" DROP COLUMN "accountName",
DROP COLUMN "currency",
DROP COLUMN "data",
DROP COLUMN "productDisplayId",
DROP COLUMN "productName",
DROP COLUMN "total",
DROP COLUMN "warehouseName",
ADD COLUMN     "itemData" JSONB NOT NULL DEFAULT '[]';
