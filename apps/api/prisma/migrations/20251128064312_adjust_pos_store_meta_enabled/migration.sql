-- AlterTable
ALTER TABLE "meta_ad_accounts" ADD COLUMN     "status" "IntegrationStatus" NOT NULL DEFAULT 'ACTIVE',
ALTER COLUMN "enabled" DROP NOT NULL,
ALTER COLUMN "enabled" DROP DEFAULT;

-- AlterTable
ALTER TABLE "pos_stores" ALTER COLUMN "status" SET DEFAULT 'ACTIVE',
ALTER COLUMN "enabled" DROP NOT NULL,
ALTER COLUMN "enabled" DROP DEFAULT;
