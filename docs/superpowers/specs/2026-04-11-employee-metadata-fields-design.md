# Employee Metadata Fields — Design Spec

**Date:** 2026-04-11  
**Status:** Awaiting user approval  
**Scope:** DB schema, backend DTOs/service/mapper, API endpoint, frontend Add-Employee form  

---

## Problem

ACR/PER forms (PART-I) require ~16 fields about the employee that the clerk must fill in manually every time because they are not stored in the `Employee` model. This means data is entered redundantly per-form instead of once per employee. The goal is to store these fields in the database so the form auto-fills from the employee record.

---

## Forms Analyzed

| Template | Form Code | Relevant PART-I fields |
|---|---|---|
| Assistants / UDC / LDC | S-121-C | DOB, Basic Pay, Date of appt to BPS, Qualifications, Training, Nature of duties |
| APS / Stenotypist | S-121-E | DOB, Basic Pay, Date of appt to BS, Qualifications, Training |
| Inspector / SI / ASI | FIA-INS | Father name, Post held, Rank/Grade, Training, Enquiry, Punishment, Reward, Deputation type |
| Superintendent / A.Incharge | S-121-B | DOB, Basic Pay, Date of appt to BS, Qualifications, Training, Nature of duties |
| Car Drivers / Despatch Riders | S-121-F | DOB, Present Pay, License type, Vehicle type |
| BPS 17-18 Officers | PER-17-18 | Personnel no., DOB, Date of entry, Academic quals, Languages, Structured training table |

---

## New Database Models

### 1. Scalar fields added to `Employee`

All nullable so existing records are unaffected.

```prisma
dateOfBirth              DateTime?
basicPay                 Int?          // monthly pay in PKR
appointmentToBpsDate     DateTime?     // date of appointment to current BPS/BS
qualifications           String?       // e.g. "M.A. (Urdu), B.A."
fatherName               String?       // S/o ... (Inspector form)
deputationType           DeputationType? // enum: DIRECT | DEPUTATIONIST
natureOfDuties           String?       // free text — what duties the employee performs
personnelNumber          String?       // BPS 17-18 PER only
serviceGroup             String?       // BPS 17-18: Service/Group field
licenseType              String?       // Car Drivers only — e.g. "LTV", "HTV"
vehicleType              String?       // Car Drivers only — e.g. "Toyota Corolla"
trainingCoursesText      String?       // Simple free-text for forms that don't need structured data
```

New enum:
```prisma
enum DeputationType {
  DIRECT
  DEPUTATIONIST
}
```

---

### 2. `EmployeeTrainingCourse` (relation table)

Used for the structured training table in BPS 17-18 PER. Also available for other templates that want structured data.

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
```

---

### 3. `EmployeeDisciplinaryRecord` (relation table)

Used for Inspector/SI/ASI form fields (v) departmental enquiry and (vi) major/minor punishment.

```prisma
enum DisciplinaryRecordType {
  ENQUIRY
  MAJOR_PUNISHMENT
  MINOR_PUNISHMENT
}

model EmployeeDisciplinaryRecord {
  id          String                 @id @default(cuid())
  employeeId  String
  type        DisciplinaryRecordType
  description String
  year        Int?
  outcome     String?                // e.g. "Exonerated", "Penalty imposed", "Pending"
  awardedDate DateTime?
  createdAt   DateTime               @default(now())
  employee    Employee               @relation("EmployeeDisciplinaryRecords", fields: [employeeId], references: [id], onDelete: Cascade)

  @@index([employeeId])
}
```

---

### 4. `EmployeeReward` (relation table)

Used for Inspector/SI/ASI form field (vii) Any Reward / Commendation Certificate / Letter of Appreciation.

```prisma
enum RewardType {
  REWARD
  COMMENDATION_CERTIFICATE
  LETTER_OF_APPRECIATION
}

model EmployeeReward {
  id          String     @id @default(cuid())
  employeeId  String
  type        RewardType
  description String
  awardedDate DateTime?
  awardedBy   String?    // authority who issued the award
  createdAt   DateTime   @default(now())
  employee    Employee   @relation("EmployeeRewards", fields: [employeeId], references: [id], onDelete: Cascade)

  @@index([employeeId])
}
```

---

### 5. `EmployeeLanguageProficiency` (relation table)

Used for BPS 17-18 PER form — "Knowledge of languages (speaking, reading, writing)".

```prisma
enum LanguageProficiencyLevel {
  NONE
  BASIC
  GOOD
  EXCELLENT
}

model EmployeeLanguageProficiency {
  id         String                   @id @default(cuid())
  employeeId String
  language   String                   // e.g. "Urdu", "English", "Punjabi"
  speaking   LanguageProficiencyLevel @default(NONE)
  reading    LanguageProficiencyLevel @default(NONE)
  writing    LanguageProficiencyLevel @default(NONE)
  createdAt  DateTime                 @default(now())
  employee   Employee                 @relation("EmployeeLanguages", fields: [employeeId], references: [id], onDelete: Cascade)

  @@unique([employeeId, language])
  @@index([employeeId])
}
```

---

### Updated `Employee` model — new relations

```prisma
trainingCourses      EmployeeTrainingCourse[]        @relation("EmployeeTrainingCourses")
disciplinaryRecords  EmployeeDisciplinaryRecord[]    @relation("EmployeeDisciplinaryRecords")
rewards              EmployeeReward[]                @relation("EmployeeRewards")
languages            EmployeeLanguageProficiency[]   @relation("EmployeeLanguages")
```

---

## Migration

One Prisma migration: `20260411_employee_metadata_fields`

- `ALTER TABLE employees ADD COLUMN ...` for each new scalar field (all nullable, no default required)
- `CREATE TABLE employee_training_courses ...`
- `CREATE TABLE employee_disciplinary_records ...`
- `CREATE TABLE employee_rewards ...`
- `CREATE TABLE employee_language_proficiencies ...`
- New enum types: `DeputationType`, `DisciplinaryRecordType`, `RewardType`, `LanguageProficiencyLevel`

No data migration needed — all new fields are optional.

---

## Backend Changes

### DTOs

**`CreateEmployeeDto`** — add all new optional scalar fields:
- `dateOfBirth?: string` (ISO date string)
- `basicPay?: number`
- `appointmentToBpsDate?: string`
- `qualifications?: string`
- `fatherName?: string`
- `deputationType?: DeputationType`
- `natureOfDuties?: string`
- `personnelNumber?: string`
- `serviceGroup?: string`
- `licenseType?: string`
- `vehicleType?: string`
- `trainingCoursesText?: string`
- `trainingCourses?: Array<{ courseName, durationFrom?, durationTo?, institution?, country? }>`
- `disciplinaryRecords?: Array<{ type, description, year?, outcome?, awardedDate? }>`
- `rewards?: Array<{ type, description, awardedDate?, awardedBy? }>`
- `languages?: Array<{ language, speaking, reading, writing }>`

**`UpdateEmployeeDto`** (new) — same fields, all optional, for `PATCH /employees/:id`.

### Service (`employees.service.ts`)

- `create()`: extend Prisma `employee.create` to accept the new scalar fields; use nested `create` for the 4 relation tables if arrays are provided
- `update(employeeId, dto)` (new method): `PATCH` support — update scalar fields, and for relation tables use `deleteMany` + `createMany` (replace strategy, simpler than diffing)
- `EMPLOYEE_ORG_INCLUDE`: add `trainingCourses`, `disciplinaryRecords`, `rewards`, `languages` to the include object

### Mapper (`view-mappers.ts` → `mapEmployee`)

Add all new fields to the returned object. The frontend and ACR auto-fill will pick them up automatically through the existing `employeeSnapshot` path.

### Controller (`employees.controller.ts`)

Add `PATCH /employees/:id` route that calls `employeesService.update(id, dto)` — CLERK and SUPER_ADMIN roles only.

---

## Frontend Changes

### Add Employee form / modal

Add input groups for the new fields, organized by relevance:

**Always shown (all templates):**
- Date of Birth (date picker)
- Basic Pay (number input, PKR)
- Date of Appointment to BPS (date picker)
- Qualifications (textarea)
- Nature of Duties (textarea — shows if template is Assistants or Superintendent)
- Father's Name (text input — shows if template is Inspector)
- Deputation Type (dropdown: Direct / Deputationist — shows if template is Inspector)
- Training Courses (free-text textarea for all templates + structured table add/remove for BPS 17-18)

**Driver-specific (shown only when templateFamily = CAR_DRIVER):**
- License Type (text input or dropdown)
- Vehicle Type (text input)

**Inspector-specific (shown only when templateFamily = INSPECTOR):**
- Disciplinary Records (add/remove rows: type, description, year, outcome)
- Rewards (add/remove rows: type, description, awarded date, awarded by)

**BPS 17-18 specific (shown only when templateFamily = OFFICER_17_18):**
- Personnel Number (text input)
- Service/Group (text input)
- Language Proficiency (add/remove rows: language + speaking/reading/writing dropdowns)

### ACR form auto-fill

No changes needed to `InteractiveForm.tsx` auto-fill logic — it already pattern-matches `data-replica-prefill` attributes. The new fields will be available in the employee snapshot and will flow through automatically once the field label keywords in the templates match (e.g. `date-of-birth`, `qualifications`, `father-name`). Any new keywords that don't match today will need a simple entry in the `PREFILL_PATTERNS` map in `InteractiveForm.tsx`.

---

## What stays in `clerkSection` (NOT moved to Employee)

- Training courses attended **during the specific reporting period** — these are period-specific, not permanent record
- Period-specific disciplinary remarks — per-form annotation
- Reporting officer signature and period dates — already on `AcrRecord`

---

## Spec Self-Review

- No TBD sections
- All 4 new relation tables have `onDelete: Cascade` so no orphan rows
- `DeputationType`, `DisciplinaryRecordType`, `RewardType`, `LanguageProficiencyLevel` enums are all exhaustive
- Scope is focused: only adds metadata fields, does not change ACR workflow
- Update endpoint uses replace strategy (deleteMany + createMany) for relation tables — simple and correct for admin-managed data
- `trainingCoursesText` and structured `trainingCourses` coexist (Option C) — frontend shows both inputs, mapper returns both
