-- Fetch analysis media by link.
--
-- A creative keeps its Facebook post link (mediaUrl) and gains a Google Drive
-- link to the source file. An analysis can now start from either link; the
-- run records which one it used.

ALTER TABLE "creatives" ADD COLUMN "driveUrl" TEXT;

ALTER TYPE "CreativeAiSourceType" ADD VALUE 'FACEBOOK_POST';
