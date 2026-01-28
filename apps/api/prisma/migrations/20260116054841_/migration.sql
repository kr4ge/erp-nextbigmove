/*
  Warnings:

  - You are about to drop the column `cogsDeliveredPos` on the `reconcile_marketing` table. All the data in the column will be lost.
  - You are about to drop the column `cogsRtsPos` on the `reconcile_marketing` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "reconcile_marketing" DROP COLUMN "cogsDeliveredPos",
DROP COLUMN "cogsRtsPos",
ADD COLUMN     "createdTime" TIMESTAMP(3);
