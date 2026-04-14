DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'OrgScopeTrack'
      AND n.nspname = current_schema()
  ) THEN
    EXECUTE format(
      'CREATE TYPE %I."OrgScopeTrack" AS ENUM (''REGIONAL'', ''WING'')',
      current_schema()
    );
  END IF;
END $$;

ALTER TABLE "Region" ALTER COLUMN "wingId" DROP NOT NULL;
ALTER TABLE "Zone" ALTER COLUMN "wingId" DROP NOT NULL;
ALTER TABLE "Circle" ALTER COLUMN "wingId" DROP NOT NULL;
ALTER TABLE "Station" ALTER COLUMN "wingId" DROP NOT NULL;
ALTER TABLE "Branch" ALTER COLUMN "wingId" DROP NOT NULL;
ALTER TABLE "Cell" ALTER COLUMN "wingId" DROP NOT NULL;
ALTER TABLE "Office" ALTER COLUMN "wingId" DROP NOT NULL;
ALTER TABLE "Office" ALTER COLUMN "zoneId" DROP NOT NULL;
ALTER TABLE "Employee" ALTER COLUMN "wingId" DROP NOT NULL;
ALTER TABLE "Employee" ALTER COLUMN "zoneId" DROP NOT NULL;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "userId" TEXT;

ALTER TABLE "Office" ADD COLUMN IF NOT EXISTS "scopeTrack" "OrgScopeTrack" NOT NULL DEFAULT 'REGIONAL';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "scopeTrack" "OrgScopeTrack" NOT NULL DEFAULT 'WING';
ALTER TABLE "UserRoleAssignment" ADD COLUMN IF NOT EXISTS "scopeTrack" "OrgScopeTrack" NOT NULL DEFAULT 'WING';
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "scopeTrack" "OrgScopeTrack" NOT NULL DEFAULT 'WING';
ALTER TABLE "ArchiveRecord" ADD COLUMN IF NOT EXISTS "scopeTrack" "OrgScopeTrack" NOT NULL DEFAULT 'REGIONAL';

UPDATE "Office"
SET "scopeTrack" = CASE
  WHEN "directorateId" IS NOT NULL THEN 'WING'::"OrgScopeTrack"
  WHEN "regionId" IS NOT NULL OR "zoneId" IS NOT NULL OR "circleId" IS NOT NULL OR "stationId" IS NOT NULL OR "branchId" IS NOT NULL OR "cellId" IS NOT NULL THEN 'REGIONAL'::"OrgScopeTrack"
  ELSE 'WING'::"OrgScopeTrack"
END;

UPDATE "User"
SET "scopeTrack" = CASE
  WHEN "directorateId" IS NOT NULL THEN 'WING'::"OrgScopeTrack"
  WHEN "regionId" IS NOT NULL OR "zoneId" IS NOT NULL OR "circleId" IS NOT NULL OR "stationId" IS NOT NULL OR "branchId" IS NOT NULL OR "cellId" IS NOT NULL THEN 'REGIONAL'::"OrgScopeTrack"
  WHEN "officeId" IS NOT NULL THEN COALESCE((SELECT "scopeTrack" FROM "Office" WHERE "Office"."id" = "User"."officeId"), 'WING'::"OrgScopeTrack")
  ELSE 'WING'::"OrgScopeTrack"
END;

UPDATE "UserRoleAssignment"
SET "scopeTrack" = CASE
  WHEN "directorateId" IS NOT NULL THEN 'WING'::"OrgScopeTrack"
  WHEN "regionId" IS NOT NULL OR "zoneId" IS NOT NULL OR "circleId" IS NOT NULL OR "stationId" IS NOT NULL OR "branchId" IS NOT NULL OR "cellId" IS NOT NULL THEN 'REGIONAL'::"OrgScopeTrack"
  WHEN "officeId" IS NOT NULL THEN COALESCE((SELECT "scopeTrack" FROM "Office" WHERE "Office"."id" = "UserRoleAssignment"."officeId"), 'WING'::"OrgScopeTrack")
  ELSE 'WING'::"OrgScopeTrack"
END;

UPDATE "Employee"
SET "scopeTrack" = CASE
  WHEN "directorateId" IS NOT NULL THEN 'WING'::"OrgScopeTrack"
  WHEN "regionId" IS NOT NULL OR "zoneId" IS NOT NULL OR "circleId" IS NOT NULL OR "stationId" IS NOT NULL OR "branchId" IS NOT NULL OR "cellId" IS NOT NULL THEN 'REGIONAL'::"OrgScopeTrack"
  WHEN "officeId" IS NOT NULL THEN COALESCE((SELECT "scopeTrack" FROM "Office" WHERE "Office"."id" = "Employee"."officeId"), 'WING'::"OrgScopeTrack")
  ELSE 'WING'::"OrgScopeTrack"
END;

UPDATE "ArchiveRecord"
SET "scopeTrack" = CASE
  WHEN "directorateId" IS NOT NULL THEN 'WING'::"OrgScopeTrack"
  WHEN "regionId" IS NOT NULL OR "zoneId" IS NOT NULL OR "circleId" IS NOT NULL OR "stationId" IS NOT NULL OR "branchId" IS NOT NULL OR "cellId" IS NOT NULL THEN 'REGIONAL'::"OrgScopeTrack"
  WHEN "officeId" IS NOT NULL THEN COALESCE((SELECT "scopeTrack" FROM "Office" WHERE "Office"."id" = "ArchiveRecord"."officeId"), 'WING'::"OrgScopeTrack")
  ELSE 'WING'::"OrgScopeTrack"
END;

UPDATE "Office"
SET
  "regionId" = NULL,
  "zoneId" = NULL,
  "circleId" = NULL,
  "stationId" = NULL,
  "branchId" = NULL,
  "cellId" = NULL
WHERE "scopeTrack" = 'WING';

UPDATE "Office"
SET
  "wingId" = NULL,
  "directorateId" = NULL
WHERE "scopeTrack" = 'REGIONAL';

UPDATE "User"
SET
  "regionId" = NULL,
  "zoneId" = NULL,
  "circleId" = NULL,
  "stationId" = NULL,
  "branchId" = NULL,
  "cellId" = NULL
WHERE "scopeTrack" = 'WING';

UPDATE "User"
SET
  "wingId" = NULL,
  "directorateId" = NULL
WHERE "scopeTrack" = 'REGIONAL';

UPDATE "UserRoleAssignment"
SET
  "regionId" = NULL,
  "zoneId" = NULL,
  "circleId" = NULL,
  "stationId" = NULL,
  "branchId" = NULL,
  "cellId" = NULL
WHERE "scopeTrack" = 'WING';

UPDATE "UserRoleAssignment"
SET
  "wingId" = NULL,
  "directorateId" = NULL
WHERE "scopeTrack" = 'REGIONAL';

UPDATE "Employee"
SET
  "regionId" = NULL,
  "zoneId" = NULL,
  "circleId" = NULL,
  "stationId" = NULL,
  "branchId" = NULL,
  "cellId" = NULL
WHERE "scopeTrack" = 'WING';

UPDATE "Employee"
SET
  "wingId" = NULL,
  "directorateId" = NULL
WHERE "scopeTrack" = 'REGIONAL';

UPDATE "ArchiveRecord"
SET
  "regionId" = NULL,
  "zoneId" = NULL,
  "circleId" = NULL,
  "stationId" = NULL,
  "branchId" = NULL,
  "cellId" = NULL
WHERE "scopeTrack" = 'WING';

UPDATE "ArchiveRecord"
SET
  "wingId" = NULL,
  "directorateId" = NULL
WHERE "scopeTrack" = 'REGIONAL';

CREATE INDEX IF NOT EXISTS "Office_scopeTrack_wingId_directorateId_regionId_zoneId_idx"
  ON "Office"("scopeTrack", "wingId", "directorateId", "regionId", "zoneId");
CREATE INDEX IF NOT EXISTS "User_scopeTrack_wingId_directorateId_regionId_zoneId_officeId_idx"
  ON "User"("scopeTrack", "wingId", "directorateId", "regionId", "zoneId", "officeId");
CREATE INDEX IF NOT EXISTS "UserRoleAssignment_role_scopeTrack_wingId_directorateId_regionId_zoneId_circleId_stationId_branchId_cellId_officeId_departmentId_idx"
  ON "UserRoleAssignment"("role", "scopeTrack", "wingId", "directorateId", "regionId", "zoneId", "circleId", "stationId", "branchId", "cellId", "officeId", "departmentId");
CREATE INDEX IF NOT EXISTS "Employee_scopeTrack_wingId_directorateId_regionId_zoneId_officeId_idx"
  ON "Employee"("scopeTrack", "wingId", "directorateId", "regionId", "zoneId", "officeId");
CREATE INDEX IF NOT EXISTS "ArchiveRecord_scopeTrack_wingId_directorateId_regionId_zoneId_officeId_idx"
  ON "ArchiveRecord"("scopeTrack", "wingId", "directorateId", "regionId", "zoneId", "officeId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class tbl ON tbl.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = tbl.relnamespace
    WHERE c.conname = 'Employee_userId_fkey'
      AND n.nspname = current_schema()
  ) THEN
    ALTER TABLE "Employee"
      ADD CONSTRAINT "Employee_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
