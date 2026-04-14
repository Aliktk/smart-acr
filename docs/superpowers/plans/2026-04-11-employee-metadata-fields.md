# Employee Metadata Fields — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 12 scalar fields and 4 relation tables to `Employee` so ACR/PER form PART-I fields auto-fill from the database instead of being typed by the clerk each time.

**Architecture:** Prisma schema gets new scalar columns + 4 child tables (EmployeeTrainingCourse, EmployeeDisciplinaryRecord, EmployeeReward, EmployeeLanguageProficiency) all linked via `employeeId` FK with Cascade delete. The `mapEmployee()` view-mapper is extended to include every new field, and `createEmployee` / new `updateEmployee` service methods accept nested writes. The frontend `acr/new/page.tsx` Add-Employee panel gains conditional sections for the new fields.

**Tech Stack:** NestJS · Prisma (PostgreSQL) · class-validator DTOs · Next.js 15 App Router · TanStack Query · Tailwind CSS

---

## Files

| Action | Path | Purpose |
|--------|------|---------|
| Create | `backend/prisma/migrations/20260411_employee_metadata_fields/migration.sql` | DB migration |
| Modify | `backend/prisma/schema.prisma` | New models + enums |
| Modify | `backend/src/modules/employees/dto/create-employee.dto.ts` | New optional fields |
| Create | `backend/src/modules/employees/dto/update-employee.dto.ts` | PATCH body |
| Modify | `backend/src/helpers/view-mappers.ts` | `mapEmployee` returns new fields |
| Modify | `backend/src/modules/employees/employees.service.ts` | `create` + new `update` method |
| Modify | `backend/src/modules/employees/employees.controller.ts` | `PATCH /employees/:id` |
| Modify | `frontend/src/@types/contracts.ts` | `EmployeeSummary` + `ManualEmployeePayload` new fields |
| Modify | `frontend/src/api/client.ts` | `updateEmployee` + extend `createEmployee` signature |
| Modify | `frontend/src/app/(portal)/acr/new/page.tsx` | Add metadata fields to clerk form |

---

## Task 1 — Database: Schema + Migration

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/20260411_employee_metadata_fields/migration.sql`

- [ ] **Step 1: Add enums to schema.prisma**

Open `backend/prisma/schema.prisma`. After the last existing enum (search for the last `enum` block), add:

```prisma
enum Gender {
  MALE
  FEMALE
  OTHER
}

enum DeputationType {
  DIRECT
  DEPUTATIONIST
}

enum DisciplinaryRecordType {
  ENQUIRY
  MAJOR_PUNISHMENT
  MINOR_PUNISHMENT
}

enum RewardType {
  REWARD
  COMMENDATION_CERTIFICATE
  LETTER_OF_APPRECIATION
}

enum LanguageProficiencyLevel {
  NONE
  BASIC
  GOOD
  EXCELLENT
}
```

- [ ] **Step 2: Add scalar fields to the Employee model**

Inside `model Employee { ... }`, add after the `address` field (line ~526) and before `templateFamily`:

```prisma
  gender                   Gender?
  dateOfBirth              DateTime?
  basicPay                 Int?
  appointmentToBpsDate     DateTime?
  qualifications           String?
  fatherName               String?
  deputationType           DeputationType?
  natureOfDuties           String?
  personnelNumber          String?
  serviceGroup             String?
  licenseType              String?
  vehicleType              String?
  trainingCoursesText      String?
```

- [ ] **Step 3: Add relation declarations to Employee model**

At the bottom of `model Employee`, just before the closing `}` and the `@@index` lines, add:

```prisma
  trainingCourses          EmployeeTrainingCourse[]       @relation("EmployeeTrainingCourses")
  disciplinaryRecords      EmployeeDisciplinaryRecord[]   @relation("EmployeeDisciplinaryRecords")
  rewards                  EmployeeReward[]               @relation("EmployeeRewards")
  languages                EmployeeLanguageProficiency[]  @relation("EmployeeLanguages")
```

- [ ] **Step 4: Add the 4 new models to schema.prisma**

After the `Employee` model closing `}`, add:

```prisma
model EmployeeTrainingCourse {
  id           String    @id @default(cuid())
  employeeId   String
  courseName   String
  durationFrom DateTime?
  durationTo   DateTime?
  institution  String?
  country      String?
  createdAt    DateTime  @default(now())
  employee     Employee  @relation("EmployeeTrainingCourses", fields: [employeeId], references: [id], onDelete: Cascade)

  @@index([employeeId])
}

model EmployeeDisciplinaryRecord {
  id          String                 @id @default(cuid())
  employeeId  String
  type        DisciplinaryRecordType
  description String
  year        Int?
  outcome     String?
  awardedDate DateTime?
  createdAt   DateTime               @default(now())
  employee    Employee               @relation("EmployeeDisciplinaryRecords", fields: [employeeId], references: [id], onDelete: Cascade)

  @@index([employeeId])
}

model EmployeeReward {
  id          String     @id @default(cuid())
  employeeId  String
  type        RewardType
  description String
  awardedDate DateTime?
  awardedBy   String?
  createdAt   DateTime   @default(now())
  employee    Employee   @relation("EmployeeRewards", fields: [employeeId], references: [id], onDelete: Cascade)

  @@index([employeeId])
}

model EmployeeLanguageProficiency {
  id         String                   @id @default(cuid())
  employeeId String
  language   String
  speaking   LanguageProficiencyLevel @default(NONE)
  reading    LanguageProficiencyLevel @default(NONE)
  writing    LanguageProficiencyLevel @default(NONE)
  createdAt  DateTime                 @default(now())
  employee   Employee                 @relation("EmployeeLanguages", fields: [employeeId], references: [id], onDelete: Cascade)

  @@unique([employeeId, language])
  @@index([employeeId])
}
```

- [ ] **Step 5: Create the migration SQL file**

Create `backend/prisma/migrations/20260411_employee_metadata_fields/migration.sql` with:

```sql
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

-- AlterTable: add optional columns to Employee
ALTER TABLE "Employee"
  ADD COLUMN "gender"                "Gender",
  ADD COLUMN "dateOfBirth"           TIMESTAMP(3),
  ADD COLUMN "basicPay"              INTEGER,
  ADD COLUMN "appointmentToBpsDate"  TIMESTAMP(3),
  ADD COLUMN "qualifications"        TEXT,
  ADD COLUMN "fatherName"            TEXT,
  ADD COLUMN "deputationType"        "DeputationType",
  ADD COLUMN "natureOfDuties"        TEXT,
  ADD COLUMN "personnelNumber"       TEXT,
  ADD COLUMN "serviceGroup"          TEXT,
  ADD COLUMN "licenseType"           TEXT,
  ADD COLUMN "vehicleType"           TEXT,
  ADD COLUMN "trainingCoursesText"   TEXT;

-- CreateTable: EmployeeTrainingCourse
CREATE TABLE "EmployeeTrainingCourse" (
  "id"           TEXT NOT NULL,
  "employeeId"   TEXT NOT NULL,
  "courseName"   TEXT NOT NULL,
  "durationFrom" TIMESTAMP(3),
  "durationTo"   TIMESTAMP(3),
  "institution"  TEXT,
  "country"      TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmployeeTrainingCourse_pkey" PRIMARY KEY ("id")
);

-- CreateTable: EmployeeDisciplinaryRecord
CREATE TABLE "EmployeeDisciplinaryRecord" (
  "id"          TEXT NOT NULL,
  "employeeId"  TEXT NOT NULL,
  "type"        "DisciplinaryRecordType" NOT NULL,
  "description" TEXT NOT NULL,
  "year"        INTEGER,
  "outcome"     TEXT,
  "awardedDate" TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmployeeDisciplinaryRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable: EmployeeReward
CREATE TABLE "EmployeeReward" (
  "id"          TEXT NOT NULL,
  "employeeId"  TEXT NOT NULL,
  "type"        "RewardType" NOT NULL,
  "description" TEXT NOT NULL,
  "awardedDate" TIMESTAMP(3),
  "awardedBy"   TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmployeeReward_pkey" PRIMARY KEY ("id")
);

-- CreateTable: EmployeeLanguageProficiency
CREATE TABLE "EmployeeLanguageProficiency" (
  "id"         TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "language"   TEXT NOT NULL,
  "speaking"   "LanguageProficiencyLevel" NOT NULL DEFAULT 'NONE',
  "reading"    "LanguageProficiencyLevel" NOT NULL DEFAULT 'NONE',
  "writing"    "LanguageProficiencyLevel" NOT NULL DEFAULT 'NONE',
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmployeeLanguageProficiency_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "EmployeeTrainingCourse"
  ADD CONSTRAINT "EmployeeTrainingCourse_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeDisciplinaryRecord"
  ADD CONSTRAINT "EmployeeDisciplinaryRecord_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeReward"
  ADD CONSTRAINT "EmployeeReward_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeLanguageProficiency"
  ADD CONSTRAINT "EmployeeLanguageProficiency_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "EmployeeTrainingCourse_employeeId_idx" ON "EmployeeTrainingCourse"("employeeId");
CREATE INDEX "EmployeeDisciplinaryRecord_employeeId_idx" ON "EmployeeDisciplinaryRecord"("employeeId");
CREATE INDEX "EmployeeReward_employeeId_idx" ON "EmployeeReward"("employeeId");
CREATE INDEX "EmployeeLanguageProficiency_employeeId_idx" ON "EmployeeLanguageProficiency"("employeeId");

-- UniqueIndex for language proficiency
CREATE UNIQUE INDEX "EmployeeLanguageProficiency_employeeId_language_key"
  ON "EmployeeLanguageProficiency"("employeeId", "language");
```

- [ ] **Step 6: Apply migration and regenerate Prisma client**

```bash
cd backend
npx prisma migrate deploy
npx prisma generate
```

Expected: Migration applies with no errors. `@prisma/client` regenerated.

- [ ] **Step 7: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/20260411_employee_metadata_fields/
git commit -m "feat: add employee metadata schema — 5 enums, 13 scalar fields, 4 child tables"
```

---

## Task 2 — Backend DTOs

**Files:**
- Modify: `backend/src/modules/employees/dto/create-employee.dto.ts`
- Create: `backend/src/modules/employees/dto/update-employee.dto.ts`

- [ ] **Step 1: Update `create-employee.dto.ts`**

Replace the entire file with:

```typescript
import { DeputationType, Gender, DisciplinaryRecordType, RewardType, LanguageProficiencyLevel, TemplateFamilyCode } from "@prisma/client";
import {
  IsArray, IsDateString, IsEmail, IsEnum, IsInt, IsOptional,
  IsString, Length, Max, Min, ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export class TrainingCourseDto {
  @IsString()
  courseName!: string;

  @IsOptional()
  @IsDateString()
  durationFrom?: string;

  @IsOptional()
  @IsDateString()
  durationTo?: string;

  @IsOptional()
  @IsString()
  institution?: string;

  @IsOptional()
  @IsString()
  country?: string;
}

export class DisciplinaryRecordDto {
  @IsEnum(DisciplinaryRecordType)
  type!: DisciplinaryRecordType;

  @IsString()
  description!: string;

  @IsOptional()
  @IsInt()
  year?: number;

  @IsOptional()
  @IsString()
  outcome?: string;

  @IsOptional()
  @IsDateString()
  awardedDate?: string;
}

export class RewardDto {
  @IsEnum(RewardType)
  type!: RewardType;

  @IsString()
  description!: string;

  @IsOptional()
  @IsDateString()
  awardedDate?: string;

  @IsOptional()
  @IsString()
  awardedBy?: string;
}

export class LanguageProficiencyDto {
  @IsString()
  language!: string;

  @IsEnum(LanguageProficiencyLevel)
  speaking!: LanguageProficiencyLevel;

  @IsEnum(LanguageProficiencyLevel)
  reading!: LanguageProficiencyLevel;

  @IsEnum(LanguageProficiencyLevel)
  writing!: LanguageProficiencyLevel;
}

export class CreateEmployeeDto {
  @IsString()
  name!: string;

  @IsString()
  rank!: string;

  @IsString()
  designation!: string;

  @IsInt()
  @Min(1)
  @Max(22)
  bps!: number;

  @IsString()
  @Length(13, 15)
  cnic!: string;

  @IsString()
  mobile!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsString()
  posting!: string;

  @IsDateString()
  joiningDate!: string;

  @IsString()
  address!: string;

  @IsEnum(TemplateFamilyCode)
  templateFamily!: TemplateFamilyCode;

  @IsString()
  officeId!: string;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsString()
  reportingOfficerId!: string;

  @IsOptional()
  @IsString()
  countersigningOfficerId?: string;

  // ── Metadata fields ──────────────────────────────────────────────

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  basicPay?: number;

  @IsOptional()
  @IsDateString()
  appointmentToBpsDate?: string;

  @IsOptional()
  @IsString()
  qualifications?: string;

  @IsOptional()
  @IsString()
  fatherName?: string;

  @IsOptional()
  @IsEnum(DeputationType)
  deputationType?: DeputationType;

  @IsOptional()
  @IsString()
  natureOfDuties?: string;

  @IsOptional()
  @IsString()
  personnelNumber?: string;

  @IsOptional()
  @IsString()
  serviceGroup?: string;

  @IsOptional()
  @IsString()
  licenseType?: string;

  @IsOptional()
  @IsString()
  vehicleType?: string;

  @IsOptional()
  @IsString()
  trainingCoursesText?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TrainingCourseDto)
  trainingCourses?: TrainingCourseDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DisciplinaryRecordDto)
  disciplinaryRecords?: DisciplinaryRecordDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RewardDto)
  rewards?: RewardDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LanguageProficiencyDto)
  languages?: LanguageProficiencyDto[];
}
```

- [ ] **Step 2: Create `update-employee.dto.ts`**

```typescript
import { DeputationType, Gender, DisciplinaryRecordType, RewardType, LanguageProficiencyLevel } from "@prisma/client";
import {
  IsArray, IsDateString, IsEnum, IsInt, IsOptional,
  IsString, Max, Min, ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import {
  TrainingCourseDto,
  DisciplinaryRecordDto,
  RewardDto,
  LanguageProficiencyDto,
} from "./create-employee.dto";

export class UpdateEmployeeDto {
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  basicPay?: number;

  @IsOptional()
  @IsDateString()
  appointmentToBpsDate?: string;

  @IsOptional()
  @IsString()
  qualifications?: string;

  @IsOptional()
  @IsString()
  fatherName?: string;

  @IsOptional()
  @IsEnum(DeputationType)
  deputationType?: DeputationType;

  @IsOptional()
  @IsString()
  natureOfDuties?: string;

  @IsOptional()
  @IsString()
  personnelNumber?: string;

  @IsOptional()
  @IsString()
  serviceGroup?: string;

  @IsOptional()
  @IsString()
  licenseType?: string;

  @IsOptional()
  @IsString()
  vehicleType?: string;

  @IsOptional()
  @IsString()
  trainingCoursesText?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TrainingCourseDto)
  trainingCourses?: TrainingCourseDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DisciplinaryRecordDto)
  disciplinaryRecords?: DisciplinaryRecordDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RewardDto)
  rewards?: RewardDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LanguageProficiencyDto)
  languages?: LanguageProficiencyDto[];
}
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/modules/employees/dto/
git commit -m "feat: extend employee DTOs with metadata and nested relation arrays"
```

---

## Task 3 — Backend: EMPLOYEE_ORG_INCLUDE + mapEmployee

**Files:**
- Modify: `backend/src/modules/employees/employees.service.ts` (lines 59-88)
- Modify: `backend/src/helpers/view-mappers.ts`

- [ ] **Step 1: Add child relations to EMPLOYEE_ORG_INCLUDE**

In `employees.service.ts`, find `const EMPLOYEE_ORG_INCLUDE = {` and extend it to include the 4 new child tables. Add before the final `} satisfies Prisma.EmployeeInclude;`:

```typescript
  trainingCourses: {
    orderBy: { createdAt: "asc" as const },
  },
  disciplinaryRecords: {
    orderBy: { createdAt: "asc" as const },
  },
  rewards: {
    orderBy: { createdAt: "asc" as const },
  },
  languages: {
    orderBy: { language: "asc" as const },
  },
```

- [ ] **Step 2: Update EmployeeWithOrg type in view-mappers.ts**

In `backend/src/helpers/view-mappers.ts`, find the `type EmployeeWithOrg = Employee & {` block. Add these fields at the end, before the closing `};`:

```typescript
  trainingCourses?: Array<{
    id: string;
    courseName: string;
    durationFrom: Date | null;
    durationTo: Date | null;
    institution: string | null;
    country: string | null;
  }>;
  disciplinaryRecords?: Array<{
    id: string;
    type: string;
    description: string;
    year: number | null;
    outcome: string | null;
    awardedDate: Date | null;
  }>;
  rewards?: Array<{
    id: string;
    type: string;
    description: string;
    awardedDate: Date | null;
    awardedBy: string | null;
  }>;
  languages?: Array<{
    id: string;
    language: string;
    speaking: string;
    reading: string;
    writing: string;
  }>;
```

- [ ] **Step 3: Extend mapEmployee to return new fields**

In `backend/src/helpers/view-mappers.ts`, inside `export function mapEmployee(employee: EmployeeWithOrg)`, add the following fields to the returned object after the existing `templateFamily` line:

```typescript
    gender: employee.gender ?? null,
    dateOfBirth: employee.dateOfBirth ? formatDisplayDate(employee.dateOfBirth) : null,
    basicPay: employee.basicPay ?? null,
    appointmentToBpsDate: employee.appointmentToBpsDate ? formatDisplayDate(employee.appointmentToBpsDate) : null,
    qualifications: employee.qualifications ?? null,
    fatherName: employee.fatherName ?? null,
    deputationType: employee.deputationType ?? null,
    natureOfDuties: employee.natureOfDuties ?? null,
    personnelNumber: employee.personnelNumber ?? null,
    serviceGroup: employee.serviceGroup ?? null,
    licenseType: employee.licenseType ?? null,
    vehicleType: employee.vehicleType ?? null,
    trainingCoursesText: employee.trainingCoursesText ?? null,
    trainingCourses: (employee.trainingCourses ?? []).map((c) => ({
      id: c.id,
      courseName: c.courseName,
      durationFrom: c.durationFrom?.toISOString() ?? null,
      durationTo: c.durationTo?.toISOString() ?? null,
      institution: c.institution ?? null,
      country: c.country ?? null,
    })),
    disciplinaryRecords: (employee.disciplinaryRecords ?? []).map((d) => ({
      id: d.id,
      type: d.type,
      description: d.description,
      year: d.year ?? null,
      outcome: d.outcome ?? null,
      awardedDate: d.awardedDate?.toISOString() ?? null,
    })),
    rewards: (employee.rewards ?? []).map((r) => ({
      id: r.id,
      type: r.type,
      description: r.description,
      awardedDate: r.awardedDate?.toISOString() ?? null,
      awardedBy: r.awardedBy ?? null,
    })),
    languages: (employee.languages ?? []).map((l) => ({
      id: l.id,
      language: l.language,
      speaking: l.speaking,
      reading: l.reading,
      writing: l.writing,
    })),
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/employees/employees.service.ts backend/src/helpers/view-mappers.ts
git commit -m "feat: extend EMPLOYEE_ORG_INCLUDE and mapEmployee with metadata fields"
```

---

## Task 4 — Backend: Service create + update methods

**Files:**
- Modify: `backend/src/modules/employees/employees.service.ts`

- [ ] **Step 1: Extend `create()` to persist metadata fields**

In `employees.service.ts`, find the `prisma.employee.create({ data: { ... } })` block inside the `create()` method (around line 438). Add the metadata scalars after `countersigningOfficerId`:

```typescript
          gender: dto.gender ?? null,
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
          basicPay: dto.basicPay ?? null,
          appointmentToBpsDate: dto.appointmentToBpsDate ? new Date(dto.appointmentToBpsDate) : null,
          qualifications: dto.qualifications?.trim() ?? null,
          fatherName: dto.fatherName?.trim() ?? null,
          deputationType: dto.deputationType ?? null,
          natureOfDuties: dto.natureOfDuties?.trim() ?? null,
          personnelNumber: dto.personnelNumber?.trim() ?? null,
          serviceGroup: dto.serviceGroup?.trim() ?? null,
          licenseType: dto.licenseType?.trim() ?? null,
          vehicleType: dto.vehicleType?.trim() ?? null,
          trainingCoursesText: dto.trainingCoursesText?.trim() ?? null,
          trainingCourses: dto.trainingCourses?.length
            ? {
                create: dto.trainingCourses.map((c) => ({
                  courseName: c.courseName.trim(),
                  durationFrom: c.durationFrom ? new Date(c.durationFrom) : null,
                  durationTo: c.durationTo ? new Date(c.durationTo) : null,
                  institution: c.institution?.trim() ?? null,
                  country: c.country?.trim() ?? null,
                })),
              }
            : undefined,
          disciplinaryRecords: dto.disciplinaryRecords?.length
            ? {
                create: dto.disciplinaryRecords.map((d) => ({
                  type: d.type,
                  description: d.description.trim(),
                  year: d.year ?? null,
                  outcome: d.outcome?.trim() ?? null,
                  awardedDate: d.awardedDate ? new Date(d.awardedDate) : null,
                })),
              }
            : undefined,
          rewards: dto.rewards?.length
            ? {
                create: dto.rewards.map((r) => ({
                  type: r.type,
                  description: r.description.trim(),
                  awardedDate: r.awardedDate ? new Date(r.awardedDate) : null,
                  awardedBy: r.awardedBy?.trim() ?? null,
                })),
              }
            : undefined,
          languages: dto.languages?.length
            ? {
                create: dto.languages.map((l) => ({
                  language: l.language.trim(),
                  speaking: l.speaking,
                  reading: l.reading,
                  writing: l.writing,
                })),
              }
            : undefined,
```

- [ ] **Step 2: Add `update()` method to the service**

Add a new method after the `create()` method. Import `UpdateEmployeeDto` at the top of the file:

```typescript
import { UpdateEmployeeDto } from "./dto/update-employee.dto";
```

Then add the method:

```typescript
  async update(userId: string, activeRole: UserRole, employeeId: string, dto: UpdateEmployeeDto, ipAddress?: string) {
    const user = await loadScopedUser(this.prisma, userId, activeRole);

    if (!canCreateEmployeeRecord(user)) {
      throw new ForbiddenException("Only clerks or system administrators can update employee metadata.");
    }

    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, name: true, officeId: true },
    });

    if (!employee) {
      throw new NotFoundException("Employee not found.");
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // Replace child tables with incoming arrays (delete-all then create-all)
      if (dto.trainingCourses !== undefined) {
        await tx.employeeTrainingCourse.deleteMany({ where: { employeeId } });
        if (dto.trainingCourses.length > 0) {
          await tx.employeeTrainingCourse.createMany({
            data: dto.trainingCourses.map((c) => ({
              employeeId,
              courseName: c.courseName.trim(),
              durationFrom: c.durationFrom ? new Date(c.durationFrom) : null,
              durationTo: c.durationTo ? new Date(c.durationTo) : null,
              institution: c.institution?.trim() ?? null,
              country: c.country?.trim() ?? null,
            })),
          });
        }
      }

      if (dto.disciplinaryRecords !== undefined) {
        await tx.employeeDisciplinaryRecord.deleteMany({ where: { employeeId } });
        if (dto.disciplinaryRecords.length > 0) {
          await tx.employeeDisciplinaryRecord.createMany({
            data: dto.disciplinaryRecords.map((d) => ({
              employeeId,
              type: d.type,
              description: d.description.trim(),
              year: d.year ?? null,
              outcome: d.outcome?.trim() ?? null,
              awardedDate: d.awardedDate ? new Date(d.awardedDate) : null,
            })),
          });
        }
      }

      if (dto.rewards !== undefined) {
        await tx.employeeReward.deleteMany({ where: { employeeId } });
        if (dto.rewards.length > 0) {
          await tx.employeeReward.createMany({
            data: dto.rewards.map((r) => ({
              employeeId,
              type: r.type,
              description: r.description.trim(),
              awardedDate: r.awardedDate ? new Date(r.awardedDate) : null,
              awardedBy: r.awardedBy?.trim() ?? null,
            })),
          });
        }
      }

      if (dto.languages !== undefined) {
        await tx.employeeLanguageProficiency.deleteMany({ where: { employeeId } });
        if (dto.languages.length > 0) {
          await tx.employeeLanguageProficiency.createMany({
            data: dto.languages.map((l) => ({
              employeeId,
              language: l.language.trim(),
              speaking: l.speaking,
              reading: l.reading,
              writing: l.writing,
            })),
          });
        }
      }

      const scalarUpdate: Record<string, unknown> = {};
      if (dto.gender !== undefined) scalarUpdate.gender = dto.gender;
      if (dto.dateOfBirth !== undefined) scalarUpdate.dateOfBirth = dto.dateOfBirth ? new Date(dto.dateOfBirth) : null;
      if (dto.basicPay !== undefined) scalarUpdate.basicPay = dto.basicPay;
      if (dto.appointmentToBpsDate !== undefined) scalarUpdate.appointmentToBpsDate = dto.appointmentToBpsDate ? new Date(dto.appointmentToBpsDate) : null;
      if (dto.qualifications !== undefined) scalarUpdate.qualifications = dto.qualifications?.trim() ?? null;
      if (dto.fatherName !== undefined) scalarUpdate.fatherName = dto.fatherName?.trim() ?? null;
      if (dto.deputationType !== undefined) scalarUpdate.deputationType = dto.deputationType;
      if (dto.natureOfDuties !== undefined) scalarUpdate.natureOfDuties = dto.natureOfDuties?.trim() ?? null;
      if (dto.personnelNumber !== undefined) scalarUpdate.personnelNumber = dto.personnelNumber?.trim() ?? null;
      if (dto.serviceGroup !== undefined) scalarUpdate.serviceGroup = dto.serviceGroup?.trim() ?? null;
      if (dto.licenseType !== undefined) scalarUpdate.licenseType = dto.licenseType?.trim() ?? null;
      if (dto.vehicleType !== undefined) scalarUpdate.vehicleType = dto.vehicleType?.trim() ?? null;
      if (dto.trainingCoursesText !== undefined) scalarUpdate.trainingCoursesText = dto.trainingCoursesText?.trim() ?? null;

      const nextEmployee = await tx.employee.update({
        where: { id: employeeId },
        data: scalarUpdate as Prisma.EmployeeUpdateInput,
        include: EMPLOYEE_ORG_INCLUDE,
      });

      await tx.auditLog.create({
        data: {
          actorId: userId,
          actorRole: activeRole,
          action: "Employee metadata updated",
          recordType: "EMPLOYEE",
          recordId: employeeId,
          ipAddress: ipAddress ?? "unknown",
          details: `Metadata updated for employee ${employee.name}.`,
        },
      });

      return nextEmployee;
    });

    return mapEmployee(updated);
  }
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/modules/employees/employees.service.ts
git commit -m "feat: extend employee create/update service methods with metadata and child tables"
```

---

## Task 5 — Backend: Controller PATCH endpoint

**Files:**
- Modify: `backend/src/modules/employees/employees.controller.ts`

- [ ] **Step 1: Add the PATCH route and import**

Replace the entire file with:

```typescript
import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import type { Request } from "express";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import type { AuthenticatedUser } from "../../@types/authenticated-user.interface";
import { IsOptional, IsString, MaxLength } from "class-validator";
import { CreateEmployeeDto } from "./dto/create-employee.dto";
import { UpdateEmployeeDto } from "./dto/update-employee.dto";
import { UpdateEmployeeStatusDto } from "./dto/update-employee-status.dto";
import { EmployeesService } from "./employees.service";

class SearchEmployeesDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  query?: string;
}

class ManualOptionsDto {
  @IsOptional()
  @IsString()
  officeId?: string;
}

@Controller("employees")
@UseGuards(JwtAuthGuard)
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  search(@CurrentUser() user: AuthenticatedUser, @Query() dto: SearchEmployeesDto) {
    return this.employeesService.search(user.id, user.activeRole, dto.query);
  }

  @Get("manual-options")
  manualOptions(@CurrentUser() user: AuthenticatedUser, @Query() dto: ManualOptionsDto) {
    return this.employeesService.manualOptions(user.id, user.activeRole, dto.officeId);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateEmployeeDto) {
    return this.employeesService.create(user.id, user.activeRole, dto);
  }

  @Patch(":id/metadata")
  @UseGuards(RolesGuard)
  @Roles(UserRole.CLERK, UserRole.SUPER_ADMIN, UserRole.IT_OPS)
  updateMetadata(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: UpdateEmployeeDto,
    @Req() req: Request,
  ) {
    return this.employeesService.update(user.id, user.activeRole, id, dto, req.ip);
  }

  @Patch(":id/status")
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.IT_OPS)
  updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: UpdateEmployeeStatusDto,
    @Req() req: Request,
  ) {
    return this.employeesService.updateStatus(
      user.id,
      user.activeRole,
      id,
      dto.status,
      dto.retirementDate,
      req.ip,
    );
  }
}
```

- [ ] **Step 2: Verify NestJS build compiles**

```bash
cd backend
npx nest build --tsc 2>&1 | head -40
```

Expected: No TypeScript errors. Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add backend/src/modules/employees/employees.controller.ts
git commit -m "feat: add PATCH /employees/:id/metadata endpoint for clerk metadata update"
```

---

## Task 6 — Frontend: contracts.ts types

**Files:**
- Modify: `frontend/src/@types/contracts.ts`

- [ ] **Step 1: Add new type aliases**

After the existing `export type EmployeeStatus = ...` line, add:

```typescript
export type Gender = "MALE" | "FEMALE" | "OTHER";
export type DeputationType = "DIRECT" | "DEPUTATIONIST";
export type DisciplinaryRecordType = "ENQUIRY" | "MAJOR_PUNISHMENT" | "MINOR_PUNISHMENT";
export type RewardType = "REWARD" | "COMMENDATION_CERTIFICATE" | "LETTER_OF_APPRECIATION";
export type LanguageProficiencyLevel = "NONE" | "BASIC" | "GOOD" | "EXCELLENT";

export interface EmployeeTrainingCourse {
  id: string;
  courseName: string;
  durationFrom: string | null;
  durationTo: string | null;
  institution: string | null;
  country: string | null;
}

export interface EmployeeDisciplinaryRecord {
  id: string;
  type: DisciplinaryRecordType;
  description: string;
  year: number | null;
  outcome: string | null;
  awardedDate: string | null;
}

export interface EmployeeReward {
  id: string;
  type: RewardType;
  description: string;
  awardedDate: string | null;
  awardedBy: string | null;
}

export interface EmployeeLanguageProficiency {
  id: string;
  language: string;
  speaking: LanguageProficiencyLevel;
  reading: LanguageProficiencyLevel;
  writing: LanguageProficiencyLevel;
}
```

- [ ] **Step 2: Extend `EmployeeSummary` with new fields**

In the `EmployeeSummary` interface, add after the `templateFamily` line:

```typescript
  gender?: Gender | null;
  dateOfBirth?: string | null;
  basicPay?: number | null;
  appointmentToBpsDate?: string | null;
  qualifications?: string | null;
  fatherName?: string | null;
  deputationType?: DeputationType | null;
  natureOfDuties?: string | null;
  personnelNumber?: string | null;
  serviceGroup?: string | null;
  licenseType?: string | null;
  vehicleType?: string | null;
  trainingCoursesText?: string | null;
  trainingCourses?: EmployeeTrainingCourse[];
  disciplinaryRecords?: EmployeeDisciplinaryRecord[];
  rewards?: EmployeeReward[];
  languages?: EmployeeLanguageProficiency[];
```

- [ ] **Step 3: Extend `ManualEmployeePayload` with new optional fields**

In the `ManualEmployeePayload` interface, add after `countersigningOfficerId?`:

```typescript
  gender?: Gender;
  dateOfBirth?: string;
  basicPay?: number;
  appointmentToBpsDate?: string;
  qualifications?: string;
  fatherName?: string;
  deputationType?: DeputationType;
  natureOfDuties?: string;
  personnelNumber?: string;
  serviceGroup?: string;
  licenseType?: string;
  vehicleType?: string;
  trainingCoursesText?: string;
  trainingCourses?: Array<{ courseName: string; durationFrom?: string; durationTo?: string; institution?: string; country?: string }>;
  disciplinaryRecords?: Array<{ type: DisciplinaryRecordType; description: string; year?: number; outcome?: string; awardedDate?: string }>;
  rewards?: Array<{ type: RewardType; description: string; awardedDate?: string; awardedBy?: string }>;
  languages?: Array<{ language: string; speaking: LanguageProficiencyLevel; reading: LanguageProficiencyLevel; writing: LanguageProficiencyLevel }>;
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/@types/contracts.ts
git commit -m "feat: extend frontend contracts with employee metadata types"
```

---

## Task 7 — Frontend: API client `updateEmployee`

**Files:**
- Modify: `frontend/src/api/client.ts`

- [ ] **Step 1: Add `updateEmployee` function**

In `frontend/src/api/client.ts`, after the `createEmployee` function, add:

```typescript
export function updateEmployeeMetadata(
  id: string,
  payload: import("@/types/contracts").UpdateEmployeeMetadataPayload,
) {
  return apiFetch<EmployeeSummary>(`/employees/${id}/metadata`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}
```

- [ ] **Step 2: Add `UpdateEmployeeMetadataPayload` to contracts.ts**

In `frontend/src/@types/contracts.ts`, add after the `ManualEmployeePayload` interface:

```typescript
export interface UpdateEmployeeMetadataPayload {
  gender?: Gender;
  dateOfBirth?: string;
  basicPay?: number;
  appointmentToBpsDate?: string;
  qualifications?: string;
  fatherName?: string;
  deputationType?: DeputationType;
  natureOfDuties?: string;
  personnelNumber?: string;
  serviceGroup?: string;
  licenseType?: string;
  vehicleType?: string;
  trainingCoursesText?: string;
  trainingCourses?: Array<{ courseName: string; durationFrom?: string; durationTo?: string; institution?: string; country?: string }>;
  disciplinaryRecords?: Array<{ type: DisciplinaryRecordType; description: string; year?: number; outcome?: string; awardedDate?: string }>;
  rewards?: Array<{ type: RewardType; description: string; awardedDate?: string; awardedBy?: string }>;
  languages?: Array<{ language: string; speaking: LanguageProficiencyLevel; reading: LanguageProficiencyLevel; writing: LanguageProficiencyLevel }>;
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/api/client.ts frontend/src/@types/contracts.ts
git commit -m "feat: add updateEmployeeMetadata API client function"
```

---

## Task 8 — Frontend: Add-Employee form metadata fields

**Files:**
- Modify: `frontend/src/app/(portal)/acr/new/page.tsx`

- [ ] **Step 1: Extend `initialManualState`**

In `page.tsx`, find `const initialManualState: ManualEmployeePayload = {` and add these fields inside the object (after `countersigningOfficerId: ""`):

```typescript
  gender: undefined,
  dateOfBirth: "",
  basicPay: undefined,
  appointmentToBpsDate: "",
  qualifications: "",
  fatherName: "",
  deputationType: undefined,
  natureOfDuties: "",
  personnelNumber: "",
  serviceGroup: "",
  licenseType: "",
  vehicleType: "",
  trainingCoursesText: "",
  trainingCourses: [],
  disciplinaryRecords: [],
  rewards: [],
  languages: [],
```

- [ ] **Step 2: Add the metadata section to the manual-mode form**

Find the section inside `{manualMode ? (` that renders the manual employee form fields. This is a large JSX block. Locate the closing section that renders the "Add to Master Database" button — just before that button, add the following JSX block:

```tsx
{/* ── Metadata fields (optional enrichment) ── */}
<div className="mt-4 rounded-[20px] border border-[#E5E7EB] bg-[#F8FAFC] p-4">
  <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#6B7280]">
    Additional Information (Optional)
  </p>
  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

    {/* Gender */}
    <div className="text-sm text-[#475569]">
      <label>
        <span>Gender</span>
        <select
          value={manualEmployee.gender ?? ""}
          onChange={(e) => updateManualEmployee("gender", (e.target.value as Gender) || undefined)}
          className={getFieldClasses(false)}
        >
          <option value="">— Select —</option>
          <option value="MALE">Male</option>
          <option value="FEMALE">Female</option>
          <option value="OTHER">Other</option>
        </select>
      </label>
    </div>

    {/* Date of Birth */}
    <div className="text-sm text-[#475569]">
      <label>
        <span>Date of Birth</span>
        <input
          type="date"
          value={manualEmployee.dateOfBirth ?? ""}
          onChange={(e) => updateManualEmployee("dateOfBirth", e.target.value)}
          className={getFieldClasses(false)}
        />
      </label>
    </div>

    {/* Basic Pay */}
    <div className="text-sm text-[#475569]">
      <label>
        <span>Basic Pay (PKR / month)</span>
        <input
          type="number"
          min={0}
          value={manualEmployee.basicPay ?? ""}
          onChange={(e) => updateManualEmployee("basicPay", e.target.value ? Number(e.target.value) : undefined)}
          placeholder="e.g. 45000"
          className={getFieldClasses(false)}
        />
      </label>
    </div>

    {/* Date of Appointment to BPS */}
    <div className="text-sm text-[#475569]">
      <label>
        <span>Date of Appointment to Present BPS</span>
        <input
          type="date"
          value={manualEmployee.appointmentToBpsDate ?? ""}
          onChange={(e) => updateManualEmployee("appointmentToBpsDate", e.target.value)}
          className={getFieldClasses(false)}
        />
      </label>
    </div>

    {/* Father's Name — Inspector only */}
    {(manualEmployee.templateFamily === "INSPECTOR_SI_ASI") && (
      <div className="text-sm text-[#475569]">
        <label>
          <span>Father&apos;s Name (S/o)</span>
          <input
            type="text"
            value={manualEmployee.fatherName ?? ""}
            onChange={(e) => updateManualEmployee("fatherName", normalizeInlineText(e.target.value))}
            placeholder="Father's full name"
            maxLength={100}
            className={getFieldClasses(false)}
          />
        </label>
      </div>
    )}

    {/* Deputation Type — Inspector only */}
    {(manualEmployee.templateFamily === "INSPECTOR_SI_ASI") && (
      <div className="text-sm text-[#475569]">
        <label>
          <span>Direct / Deputationist</span>
          <select
            value={manualEmployee.deputationType ?? ""}
            onChange={(e) => updateManualEmployee("deputationType", (e.target.value as "DIRECT" | "DEPUTATIONIST") || undefined)}
            className={getFieldClasses(false)}
          >
            <option value="">— Select —</option>
            <option value="DIRECT">Direct</option>
            <option value="DEPUTATIONIST">Deputationist</option>
          </select>
        </label>
      </div>
    )}

    {/* Personnel Number — Officers BPS 17-18 */}
    {(manualEmployee.templateFamily === "PER_17_18_OFFICERS") && (
      <div className="text-sm text-[#475569]">
        <label>
          <span>Personnel Number</span>
          <input
            type="text"
            value={manualEmployee.personnelNumber ?? ""}
            onChange={(e) => updateManualEmployee("personnelNumber", normalizeInlineText(e.target.value))}
            placeholder="e.g. PK-201234"
            maxLength={50}
            className={getFieldClasses(false)}
          />
        </label>
      </div>
    )}

    {/* Service Group — Officers BPS 17-18 */}
    {(manualEmployee.templateFamily === "PER_17_18_OFFICERS") && (
      <div className="text-sm text-[#475569]">
        <label>
          <span>Service / Group</span>
          <input
            type="text"
            value={manualEmployee.serviceGroup ?? ""}
            onChange={(e) => updateManualEmployee("serviceGroup", normalizeInlineText(e.target.value))}
            placeholder="e.g. Police Service of Pakistan"
            maxLength={100}
            className={getFieldClasses(false)}
          />
        </label>
      </div>
    )}

    {/* License Type — Drivers only */}
    {(manualEmployee.templateFamily === "CAR_DRIVERS_DESPATCH_RIDERS") && (
      <div className="text-sm text-[#475569]">
        <label>
          <span>Type of License Held</span>
          <input
            type="text"
            value={manualEmployee.licenseType ?? ""}
            onChange={(e) => updateManualEmployee("licenseType", normalizeInlineText(e.target.value))}
            placeholder="e.g. LTV, HTV"
            maxLength={50}
            className={getFieldClasses(false)}
          />
        </label>
      </div>
    )}

    {/* Vehicle Type — Drivers only */}
    {(manualEmployee.templateFamily === "CAR_DRIVERS_DESPATCH_RIDERS") && (
      <div className="text-sm text-[#475569]">
        <label>
          <span>Type of Vehicle Driven</span>
          <input
            type="text"
            value={manualEmployee.vehicleType ?? ""}
            onChange={(e) => updateManualEmployee("vehicleType", normalizeInlineText(e.target.value))}
            placeholder="e.g. Toyota Corolla, Motorcycle"
            maxLength={100}
            className={getFieldClasses(false)}
          />
        </label>
      </div>
    )}

  </div>

  {/* Qualifications — full width */}
  {(manualEmployee.templateFamily !== "CAR_DRIVERS_DESPATCH_RIDERS") && (
    <div className="mt-4 text-sm text-[#475569]">
      <label>
        <span>Qualifications</span>
        <textarea
          value={manualEmployee.qualifications ?? ""}
          onChange={(e) => updateManualEmployee("qualifications", normalizeMultilineText(e.target.value))}
          placeholder="e.g. M.A. (Urdu), B.A., Certificate in Computer"
          rows={2}
          maxLength={500}
          className={`${getFieldClasses(false)} resize-none`}
        />
      </label>
    </div>
  )}

  {/* Nature of Duties — Assistants and Superintendent */}
  {(manualEmployee.templateFamily === "ASSISTANT_UDC_LDC" || manualEmployee.templateFamily === "SUPERINTENDENT_AINCHARGE") && (
    <div className="mt-4 text-sm text-[#475569]">
      <label>
        <span>Nature of Duties</span>
        <textarea
          value={manualEmployee.natureOfDuties ?? ""}
          onChange={(e) => updateManualEmployee("natureOfDuties", normalizeMultilineText(e.target.value))}
          placeholder="Brief description of duties performed"
          rows={2}
          maxLength={500}
          className={`${getFieldClasses(false)} resize-none`}
        />
      </label>
    </div>
  )}

  {/* Training Courses (free text — all except BPS 17-18) */}
  {(manualEmployee.templateFamily !== "PER_17_18_OFFICERS") && (
    <div className="mt-4 text-sm text-[#475569]">
      <label>
        <span>Training Courses Attended (if any)</span>
        <textarea
          value={manualEmployee.trainingCoursesText ?? ""}
          onChange={(e) => updateManualEmployee("trainingCoursesText", normalizeMultilineText(e.target.value))}
          placeholder="List courses attended, one per line"
          rows={3}
          maxLength={1000}
          className={`${getFieldClasses(false)} resize-none`}
        />
      </label>
    </div>
  )}

</div>
```

Note: Add `import type { Gender } from "@/types/contracts";` at the top of the file alongside the other contract imports.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/(portal)/acr/new/page.tsx
git commit -m "feat: add metadata fields to Add Employee form (gender, DOB, pay, qualifications, etc.)"
```

---

## Task 9 — Verify end-to-end

- [ ] **Step 1: Start backend**

```bash
cd backend && npm run start:dev
```

Expected: `smart-acr-api started on port 4000` with no migration errors.

- [ ] **Step 2: Start frontend**

```bash
cd frontend && npm run dev
```

Expected: Next.js starts on port 3000 with no TypeScript errors.

- [ ] **Step 3: Manual smoke test**

1. Log in as Clerk
2. Go to "Initiate New ACR" → "Add Employee Manually"
3. Select template "Inspector / SI / ASI"
4. Fill required fields + Father's Name, Deputation Type, Qualifications
5. Click "Add to Master Database"
6. Expected: Employee created, success toast shown
7. Search for the created employee — confirm they appear
8. Create an ACR for that employee
9. On Step 2 (Fill ACR Form), verify PART-I fields auto-populate from employee record

- [ ] **Step 4: Commit any last fixes**

```bash
git add -A
git commit -m "fix: post-implementation corrections from smoke test"
```

---

## Self-Review

**Spec coverage check:**
- ✅ Gender field added (scalar on Employee + DTO + form)
- ✅ DOB, BasicPay, AppointmentToBpsDate (scalar fields)
- ✅ Qualifications, FatherName, DeputationType, NatureOfDuties (scalar fields)
- ✅ PersonnelNumber, ServiceGroup (BPS 17-18 specific)
- ✅ LicenseType, VehicleType (Driver specific)
- ✅ TrainingCoursesText (free text, all templates)
- ✅ EmployeeTrainingCourse relation table (structured, BPS 17-18)
- ✅ EmployeeDisciplinaryRecord relation table
- ✅ EmployeeReward relation table
- ✅ EmployeeLanguageProficiency relation table
- ✅ PATCH /employees/:id/metadata endpoint
- ✅ mapEmployee extended
- ✅ Frontend Add-Employee form sections
- ✅ Cascade deletes on all 4 child tables
- ✅ All new DB fields are nullable (no data migration needed)

**Type consistency:** `TrainingCourseDto`, `DisciplinaryRecordDto`, `RewardDto`, `LanguageProficiencyDto` defined in Task 2 and re-used (imported) in Task 2 update-employee.dto.ts. `mapEmployee` returns field names that match `EmployeeSummary` interface added in Task 6.

**No placeholders:** All code blocks are complete and exact.
