-- An analysis can now read the file held from enrollment instead of asking for
-- an upload or fetching a link. The run records which it did.

ALTER TYPE "CreativeAiSourceType" ADD VALUE 'STORED_SOURCE';
