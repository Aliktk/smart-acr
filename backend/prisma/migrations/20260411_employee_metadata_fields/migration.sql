-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "DeputationType" AS ENUM ('DIRECT', 'DEPUTATIONIST');

-- CreateEnum
CREATE TYPE "DisciplinaryRecordType" AS ENUM ('ENQUIRY', 'MAJOR_PUNISHMENT', 'MINOR_PUNISHMENT');

-- CreateEnum
CREATE TYPE "RewardType" AS ENUM ('REWARD', 'COMMENDATION_CERTIFICATE', 'LETTER_OF_APPRECIATION');

-- CreateEnum
CREATE TYPE "LanguageProficiencyLevel" AS ENUM ('NONE', 'BASIC', 'GOOD', 'EXCELLENT');

-- AlterTable
ALTER TABLE "Employee"
ADD COLUMN "gender" "Gender",
ADD COLUMN "dateOfBirth" TIMESTAMP(3),
ADD COLUMN "basicPay" INTEGER,
ADD COLUMN "appointmentToBpsDate" TIMESTAMP(3),
ADD COLUMN "qualifications" TEXT,
ADD COLUMN "fatherName" TEXT,
ADD COLUMN "deputationType" "DeputationType",
ADD COLUMN "natureOfDuties" TEXT,
ADD COLUMN "personnelNumber" TEXT,
ADD COLUMN "serviceGroup" TEXT,
ADD COLUMN "licenseType" TEXT,
ADD COLUMN "vehicleType" TEXT,
ADD COLUMN "trainingCoursesText" TEXT;

-- CreateTable
CREATE TABLE "EmployeeTrainingCourse" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "courseName" TEXT NOT NULL,
    "durationFrom" TIMESTAMP(3),
    "durationTo" TIMESTAMP(3),
    "institution" TEXT,
    "country" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeTrainingCourse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeDisciplinaryRecord" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" "DisciplinaryRecordType" NOT NULL,
    "description" TEXT NOT NULL,
    "year" INTEGER,
    "outcome" TEXT,
    "awardedDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeDisciplinaryRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeReward" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" "RewardType" NOT NULL,
    "description" TEXT NOT NULL,
    "awardedDate" TIMESTAMP(3),
    "awardedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeReward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeLanguageProficiency" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "speaking" "LanguageProficiencyLevel" NOT NULL DEFAULT 'NONE',
    "reading" "LanguageProficiencyLevel" NOT NULL DEFAULT 'NONE',
    "writing" "LanguageProficiencyLevel" NOT NULL DEFAULT 'NONE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeLanguageProficiency_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmployeeTrainingCourse_employeeId_idx" ON "EmployeeTrainingCourse"("employeeId");

-- CreateIndex
CREATE INDEX "EmployeeDisciplinaryRecord_employeeId_idx" ON "EmployeeDisciplinaryRecord"("employeeId");

-- CreateIndex
CREATE INDEX "EmployeeReward_employeeId_idx" ON "EmployeeReward"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeLanguageProficiency_employeeId_language_key" ON "EmployeeLanguageProficiency"("employeeId", "language");

-- CreateIndex
CREATE INDEX "EmployeeLanguageProficiency_employeeId_idx" ON "EmployeeLanguageProficiency"("employeeId");

-- AddForeignKey
ALTER TABLE "EmployeeTrainingCourse" ADD CONSTRAINT "EmployeeTrainingCourse_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeDisciplinaryRecord" ADD CONSTRAINT "EmployeeDisciplinaryRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeReward" ADD CONSTRAINT "EmployeeReward_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeLanguageProficiency" ADD CONSTRAINT "EmployeeLanguageProficiency_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
