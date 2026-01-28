/*
  Warnings:

  - You are about to drop the column `createdTime` on the `reconcile_marketing` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "reconcile_marketing" DROP COLUMN "createdTime",
ADD COLUMN     "dateCreated" TIMESTAMP(3);
