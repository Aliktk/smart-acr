-- CreateEnum
CREATE TYPE "ArchiveRecordSource" AS ENUM ('WORKFLOW_FINAL', 'HISTORICAL_UPLOAD');

-- CreateEnum
CREATE TYPE "SecretBranchDeskCode" AS ENUM ('AD_SECRET_BRANCH', 'DA1', 'DA2', 'DA3', 'DA4');

-- AlterEnum
BEGIN;
CREATE TYPE "AcrWorkflowState_new" AS ENUM ('DRAFT', 'PENDING_REPORTING', 'PENDING_COUNTERSIGNING', 'PENDING_SECRET_BRANCH_REVIEW', 'PENDING_SECRET_BRANCH_VERIFICATION', 'RETURNED_TO_CLERK', 'RETURNED_TO_REPORTING', 'RETURNED_TO_COUNTERSIGNING', 'ARCHIVED');
ALTER TABLE "AcrRecord" ALTER COLUMN "workflowState" TYPE "AcrWorkflowState_new" USING (
    CASE
        WHEN "workflowState"::text = 'SUBMITTED_TO_SECRET_BRANCH' THEN 'PENDING_SECRET_BRANCH_REVIEW'
        WHEN "workflowState"::text = 'RETURNED' THEN 'RETURNED_TO_CLERK'
        ELSE "workflowState"::text
    END::"AcrWorkflowState_new"
);
ALTER TYPE "AcrWorkflowState" RENAME TO "AcrWorkflowState_old";
ALTER TYPE "AcrWorkflowState_new" RENAME TO "AcrWorkflowState";
DROP TYPE "AcrWorkflowState_old";
COMMIT;

-- AlterTable
ALTER TABLE "AcrRecord" ADD COLUMN     "employeeMetadataSnapshot" JSONB,
ADD COLUMN     "returnToRole" "UserRole",
ADD COLUMN     "returnedByRole" "UserRole",
ADD COLUMN     "secretBranchAllocatedToId" TEXT,
ADD COLUMN     "secretBranchDeskCode" "SecretBranchDeskCode",
ADD COLUMN     "secretBranchReviewedAt" TIMESTAMP(3),
ADD COLUMN     "secretBranchSubmittedAt" TIMESTAMP(3),
ADD COLUMN     "secretBranchVerificationNotes" TEXT,
ADD COLUMN     "secretBranchVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "secretBranchVerifiedById" TEXT;

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "branchId" TEXT,
ADD COLUMN     "cellId" TEXT,
ADD COLUMN     "circleId" TEXT,
ADD COLUMN     "departmentId" TEXT,
ADD COLUMN     "directorateId" TEXT,
ADD COLUMN     "positionTitle" TEXT,
ADD COLUMN     "regionId" TEXT,
ADD COLUMN     "stationId" TEXT;

-- AlterTable
ALTER TABLE "FileAsset" ADD COLUMN     "archiveRecordId" TEXT;

-- AlterTable
ALTER TABLE "Office" ADD COLUMN     "branchId" TEXT,
ADD COLUMN     "cellId" TEXT,
ADD COLUMN     "circleId" TEXT,
ADD COLUMN     "directorateId" TEXT,
ADD COLUMN     "regionId" TEXT,
ADD COLUMN     "stationId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "branchId" TEXT,
ADD COLUMN     "cellId" TEXT,
ADD COLUMN     "circleId" TEXT,
ADD COLUMN     "departmentId" TEXT,
ADD COLUMN     "directorateId" TEXT,
ADD COLUMN     "positionTitle" TEXT,
ADD COLUMN     "regionId" TEXT,
ADD COLUMN     "stationId" TEXT;

-- AlterTable
ALTER TABLE "UserRoleAssignment" ADD COLUMN     "branchId" TEXT,
ADD COLUMN     "cellId" TEXT,
ADD COLUMN     "circleId" TEXT,
ADD COLUMN     "departmentId" TEXT,
ADD COLUMN     "directorateId" TEXT,
ADD COLUMN     "regionId" TEXT,
ADD COLUMN     "stationId" TEXT;

-- AlterTable
ALTER TABLE "Zone" ADD COLUMN     "regionId" TEXT;

-- CreateTable
CREATE TABLE "Directorate" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "wingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Directorate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Region" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "wingId" TEXT NOT NULL,
    "directorateId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Region_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Circle" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "wingId" TEXT NOT NULL,
    "regionId" TEXT,
    "zoneId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Circle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Station" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "wingId" TEXT NOT NULL,
    "regionId" TEXT,
    "zoneId" TEXT NOT NULL,
    "circleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Station_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Branch" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "wingId" TEXT NOT NULL,
    "regionId" TEXT,
    "zoneId" TEXT NOT NULL,
    "circleId" TEXT,
    "stationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cell" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "wingId" TEXT NOT NULL,
    "regionId" TEXT,
    "zoneId" TEXT NOT NULL,
    "circleId" TEXT,
    "stationId" TEXT,
    "branchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cell_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "officeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecretBranchStaffProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deskCode" "SecretBranchDeskCode" NOT NULL,
    "canManageUsers" BOOLEAN NOT NULL DEFAULT false,
    "canVerify" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SecretBranchStaffProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecretBranchRoutingRule" (
    "id" TEXT NOT NULL,
    "templateFamily" "TemplateFamilyCode" NOT NULL,
    "reviewDeskCode" "SecretBranchDeskCode" NOT NULL,
    "verificationDeskCode" "SecretBranchDeskCode" NOT NULL DEFAULT 'AD_SECRET_BRANCH',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SecretBranchRoutingRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArchiveRecord" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "acrRecordId" TEXT,
    "source" "ArchiveRecordSource" NOT NULL,
    "templateFamily" "TemplateFamilyCode",
    "reportingPeriodFrom" TIMESTAMP(3),
    "reportingPeriodTo" TIMESTAMP(3),
    "archiveReference" TEXT,
    "positionTitle" TEXT,
    "employeeName" TEXT NOT NULL,
    "employeeServiceNumber" TEXT,
    "employeeCnic" TEXT,
    "employeePosting" TEXT,
    "wingId" TEXT,
    "directorateId" TEXT,
    "regionId" TEXT,
    "zoneId" TEXT,
    "circleId" TEXT,
    "stationId" TEXT,
    "branchId" TEXT,
    "cellId" TEXT,
    "officeId" TEXT,
    "departmentId" TEXT,
    "organizationSnapshot" JSONB,
    "documentPath" TEXT NOT NULL,
    "remarks" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "uploadedById" TEXT,
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArchiveRecord_pkey" PRIMARY KEY ("id")
);

-- Backfill status labels and stage metadata from the legacy workflow model.
UPDATE "AcrRecord"
SET
    "statusLabel" = 'Returned to Clerk',
    "returnToRole" = 'CLERK'::"UserRole"
WHERE "workflowState" = 'RETURNED_TO_CLERK'::"AcrWorkflowState";

UPDATE "AcrRecord"
SET
    "statusLabel" = 'Pending Secret Branch Review',
    "secretBranchSubmittedAt" = COALESCE("archivedAt", "updatedAt", "createdAt")
WHERE "workflowState" = 'PENDING_SECRET_BRANCH_REVIEW'::"AcrWorkflowState"
  AND "statusLabel" IN ('Submitted to Secret Branch', 'Archived');

UPDATE "AcrRecord"
SET
    "statusLabel" = 'Archived',
    "secretBranchSubmittedAt" = COALESCE("secretBranchSubmittedAt", "archivedAt", "updatedAt", "createdAt"),
    "secretBranchVerifiedAt" = COALESCE("secretBranchVerifiedAt", "archivedAt", "completedDate", "updatedAt", "createdAt")
WHERE "workflowState" = 'ARCHIVED'::"AcrWorkflowState";

-- Backfill unified archive/history records from archived workflow rows.
INSERT INTO "ArchiveRecord" (
    "id",
    "employeeId",
    "acrRecordId",
    "source",
    "templateFamily",
    "reportingPeriodFrom",
    "reportingPeriodTo",
    "archiveReference",
    "positionTitle",
    "employeeName",
    "employeeServiceNumber",
    "employeeCnic",
    "employeePosting",
    "wingId",
    "zoneId",
    "officeId",
    "organizationSnapshot",
    "documentPath",
    "isVerified",
    "uploadedById",
    "verifiedById",
    "verifiedAt",
    "createdAt",
    "updatedAt"
)
SELECT
    md5(random()::text || clock_timestamp()::text || acr."id"),
    acr."employeeId",
    acr."id",
    'WORKFLOW_FINAL'::"ArchiveRecordSource",
    emp."templateFamily",
    acr."reportingPeriodFrom",
    acr."reportingPeriodTo",
    COALESCE(snapshot."documentPath", acr."acrNo"),
    emp."positionTitle",
    emp."name",
    emp."serviceNumber",
    emp."cnic",
    emp."posting",
    emp."wingId",
    emp."zoneId",
    emp."officeId",
    jsonb_build_object(
        'wing', wing."name",
        'zone', zone."name",
        'office', office."name"
    ),
    COALESCE(snapshot."documentPath", acr."acrNo"),
    true,
    snapshot."archivedById",
    snapshot."archivedById",
    COALESCE(acr."archivedAt", acr."completedDate", snapshot."createdAt", acr."updatedAt", acr."createdAt"),
    COALESCE(acr."archivedAt", acr."completedDate", snapshot."createdAt", acr."createdAt"),
    COALESCE(acr."updatedAt", acr."createdAt")
FROM "AcrRecord" acr
JOIN "Employee" emp ON emp."id" = acr."employeeId"
LEFT JOIN "ArchiveSnapshot" snapshot ON snapshot."acrRecordId" = acr."id"
LEFT JOIN "Wing" wing ON wing."id" = emp."wingId"
LEFT JOIN "Zone" zone ON zone."id" = emp."zoneId"
LEFT JOIN "Office" office ON office."id" = emp."officeId"
WHERE acr."workflowState" = 'ARCHIVED'::"AcrWorkflowState"
  AND NOT EXISTS (
    SELECT 1
    FROM "ArchiveRecord" archive
    WHERE archive."acrRecordId" = acr."id"
  );

-- CreateIndex
CREATE UNIQUE INDEX "Directorate_code_key" ON "Directorate"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Region_code_key" ON "Region"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Circle_code_key" ON "Circle"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Station_code_key" ON "Station"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Branch_code_key" ON "Branch"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Cell_code_key" ON "Cell"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Department_code_key" ON "Department"("code");

-- CreateIndex
CREATE UNIQUE INDEX "SecretBranchStaffProfile_userId_key" ON "SecretBranchStaffProfile"("userId");

-- CreateIndex
CREATE INDEX "SecretBranchStaffProfile_deskCode_isActive_idx" ON "SecretBranchStaffProfile"("deskCode", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "SecretBranchRoutingRule_templateFamily_key" ON "SecretBranchRoutingRule"("templateFamily");

-- CreateIndex
CREATE INDEX "SecretBranchRoutingRule_reviewDeskCode_isActive_idx" ON "SecretBranchRoutingRule"("reviewDeskCode", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ArchiveRecord_acrRecordId_key" ON "ArchiveRecord"("acrRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "ArchiveRecord_archiveReference_key" ON "ArchiveRecord"("archiveReference");

-- CreateIndex
CREATE INDEX "ArchiveRecord_employeeId_source_createdAt_idx" ON "ArchiveRecord"("employeeId", "source", "createdAt");

-- CreateIndex
CREATE INDEX "ArchiveRecord_templateFamily_isVerified_createdAt_idx" ON "ArchiveRecord"("templateFamily", "isVerified", "createdAt");

-- CreateIndex
CREATE INDEX "ArchiveRecord_wingId_zoneId_officeId_idx" ON "ArchiveRecord"("wingId", "zoneId", "officeId");

-- CreateIndex
CREATE INDEX "AcrRecord_secretBranchDeskCode_workflowState_idx" ON "AcrRecord"("secretBranchDeskCode", "workflowState");

-- CreateIndex
CREATE INDEX "FileAsset_acrRecordId_kind_idx" ON "FileAsset"("acrRecordId", "kind");

-- CreateIndex
CREATE INDEX "FileAsset_archiveRecordId_kind_idx" ON "FileAsset"("archiveRecordId", "kind");

-- CreateIndex
CREATE INDEX "UserRoleAssignment_role_wingId_zoneId_officeId_idx" ON "UserRoleAssignment"("role", "wingId", "zoneId", "officeId");

-- AddForeignKey
ALTER TABLE "Directorate" ADD CONSTRAINT "Directorate_wingId_fkey" FOREIGN KEY ("wingId") REFERENCES "Wing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Region" ADD CONSTRAINT "Region_wingId_fkey" FOREIGN KEY ("wingId") REFERENCES "Wing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Region" ADD CONSTRAINT "Region_directorateId_fkey" FOREIGN KEY ("directorateId") REFERENCES "Directorate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Zone" ADD CONSTRAINT "Zone_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Circle" ADD CONSTRAINT "Circle_wingId_fkey" FOREIGN KEY ("wingId") REFERENCES "Wing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Circle" ADD CONSTRAINT "Circle_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Circle" ADD CONSTRAINT "Circle_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Station" ADD CONSTRAINT "Station_wingId_fkey" FOREIGN KEY ("wingId") REFERENCES "Wing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Station" ADD CONSTRAINT "Station_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Station" ADD CONSTRAINT "Station_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "Circle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_wingId_fkey" FOREIGN KEY ("wingId") REFERENCES "Wing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cell" ADD CONSTRAINT "Cell_wingId_fkey" FOREIGN KEY ("wingId") REFERENCES "Wing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cell" ADD CONSTRAINT "Cell_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cell" ADD CONSTRAINT "Cell_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Office" ADD CONSTRAINT "Office_directorateId_fkey" FOREIGN KEY ("directorateId") REFERENCES "Directorate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Office" ADD CONSTRAINT "Office_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Office" ADD CONSTRAINT "Office_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "Circle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Office" ADD CONSTRAINT "Office_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Office" ADD CONSTRAINT "Office_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Office" ADD CONSTRAINT "Office_cellId_fkey" FOREIGN KEY ("cellId") REFERENCES "Cell"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecretBranchStaffProfile" ADD CONSTRAINT "SecretBranchStaffProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcrRecord" ADD CONSTRAINT "AcrRecord_secretBranchAllocatedToId_fkey" FOREIGN KEY ("secretBranchAllocatedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcrRecord" ADD CONSTRAINT "AcrRecord_secretBranchVerifiedById_fkey" FOREIGN KEY ("secretBranchVerifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArchiveRecord" ADD CONSTRAINT "ArchiveRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArchiveRecord" ADD CONSTRAINT "ArchiveRecord_acrRecordId_fkey" FOREIGN KEY ("acrRecordId") REFERENCES "AcrRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArchiveRecord" ADD CONSTRAINT "ArchiveRecord_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArchiveRecord" ADD CONSTRAINT "ArchiveRecord_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileAsset" ADD CONSTRAINT "FileAsset_archiveRecordId_fkey" FOREIGN KEY ("archiveRecordId") REFERENCES "ArchiveRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

