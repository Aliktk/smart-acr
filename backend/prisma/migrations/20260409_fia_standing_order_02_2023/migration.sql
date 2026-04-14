-- FIA Standing Order No. 02/2023 Implementation
-- Adds employee status tracking, grade-based deadlines, adverse remarks workflow,
-- calendar year tracking, and submission certificate support.

-- New enums
CREATE TYPE "EmployeeStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'AWAITING_POSTING', 'RETIRED');
CREATE TYPE "AdverseRemarkStatus" AS ENUM ('DRAFT', 'ENDORSED_BY_CSO', 'COMMUNICATED', 'REPRESENTATION_RECEIVED', 'REPRESENTATION_DECIDED');
CREATE TYPE "PartPeriodReason" AS ENUM ('TRANSFER', 'MID_YEAR_POSTING', 'RETIREMENT', 'SUSPENSION', 'OTHER');

-- Employee: Add status, retirement, suspension fields
ALTER TABLE "Employee" ADD COLUMN "status" "EmployeeStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "Employee" ADD COLUMN "retirementDate" TIMESTAMP(3);
ALTER TABLE "Employee" ADD COLUMN "suspendedFrom" TIMESTAMP(3);
ALTER TABLE "Employee" ADD COLUMN "suspendedTo" TIMESTAMP(3);

CREATE INDEX "Employee_status_idx" ON "Employee"("status");
CREATE INDEX "Employee_retirementDate_idx" ON "Employee"("retirementDate");

-- AcrRecord: Add grade-based deadline, calendar year, adverse remarks flag, submission cert
ALTER TABLE "AcrRecord" ADD COLUMN "calendarYear" INTEGER;
ALTER TABLE "AcrRecord" ADD COLUMN "gradeDueDate" TIMESTAMP(3);
ALTER TABLE "AcrRecord" ADD COLUMN "partPeriodReason" "PartPeriodReason";
ALTER TABLE "AcrRecord" ADD COLUMN "hasAdverseRemarks" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AcrRecord" ADD COLUMN "submissionCertificatePath" TEXT;

CREATE INDEX "AcrRecord_calendarYear_idx" ON "AcrRecord"("calendarYear");

-- AdverseRemark: Track adverse remarks per ACR
CREATE TABLE "AdverseRemark" (
    "id" TEXT NOT NULL,
    "acrRecordId" TEXT NOT NULL,
    "remarkText" TEXT NOT NULL,
    "counsellingDate" TIMESTAMP(3),
    "counsellingNotes" TEXT,
    "endorsedByCso" BOOLEAN NOT NULL DEFAULT false,
    "endorsedAt" TIMESTAMP(3),
    "communicatedAt" TIMESTAMP(3),
    "communicationDeadline" TIMESTAMP(3),
    "status" "AdverseRemarkStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdverseRemark_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdverseRemark_acrRecordId_status_idx" ON "AdverseRemark"("acrRecordId", "status");
ALTER TABLE "AdverseRemark" ADD CONSTRAINT "AdverseRemark_acrRecordId_fkey" FOREIGN KEY ("acrRecordId") REFERENCES "AcrRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AdverseRepresentation: Officer representation against adverse remarks
CREATE TABLE "AdverseRepresentation" (
    "id" TEXT NOT NULL,
    "adverseRemarkId" TEXT NOT NULL,
    "representationText" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "representationDeadline" TIMESTAMP(3) NOT NULL,
    "decidedById" TEXT,
    "decision" TEXT,
    "decisionDate" TIMESTAMP(3),
    "decisionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdverseRepresentation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdverseRepresentation_adverseRemarkId_key" ON "AdverseRepresentation"("adverseRemarkId");
ALTER TABLE "AdverseRepresentation" ADD CONSTRAINT "AdverseRepresentation_adverseRemarkId_fkey" FOREIGN KEY ("adverseRemarkId") REFERENCES "AdverseRemark"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdverseRepresentation" ADD CONSTRAINT "AdverseRepresentation_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
