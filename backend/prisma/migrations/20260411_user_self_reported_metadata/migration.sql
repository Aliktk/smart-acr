-- AddColumn: selfReportedMetadata on User
-- Allows any user to fill in their own service metadata before an Employee record exists.
-- The settings service merges this into the profile view when no linked Employee record is found.

ALTER TABLE "User" ADD COLUMN "selfReportedMetadata" JSONB;
