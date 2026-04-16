/**
 * seed-dashboard.ts
 *
 * Standalone dashboard demo seed — adds rich, chart-ready data to an already-seeded
 * database WITHOUT destroying the base seed users/org structure.
 *
 * Run:
 *   npx ts-node prisma/seed-dashboard.ts
 *   (or via the pnpm script: pnpm seed:dashboard)
 *
 * What it creates
 * ───────────────
 * • 8 additional Reporting Officer users  (one per operational zone)
 * • 8 additional Countersigning Officer users
 * • 60 employees spread across all 11 zones and multiple wings
 * • 280 ACR records distributed over 15 months:
 *     – Mix of all workflow states (Draft, Pending, Returned, Archived)
 *     – Realistic zone-level completion / overdue variance
 *     – Performance scores on archived records
 *     – Backdated createdAt / completedDate so trend charts are non-trivial
 * • Timeline entries for every ACR
 * • Archive records + snapshots for every archived ACR
 *
 * Idempotent guard: each object is created with skipDuplicates or a unique check,
 * so re-running the file will not crash (new records will be skipped).
 */

import {
  AcrWorkflowState,
  ArchiveRecordSource,
  DeputationType,
  EducationLevel,
  Gender,
  OrgScopeTrack,
  Prisma,
  PrismaClient,
  SecretBranchDeskCode,
  TemplateFamilyCode,
  UserRole,
} from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const DEMO_PASSWORD = "ChangeMe@123";

// ─── helpers ────────────────────────────────────────────────────────────────

function d(dateStr: string): Date {
  return new Date(`${dateStr}T09:00:00.000Z`);
}

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 86_400_000);
}

function daysAhead(n: number): Date {
  return new Date(Date.now() + n * 86_400_000);
}

function monthsAgo(m: number, day = 1): Date {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() - m;
  return new Date(Date.UTC(year + Math.floor(month / 12), ((month % 12) + 12) % 12, day, 9, 0, 0));
}

function fiscalPeriod(startYear: number) {
  return {
    from: new Date(Date.UTC(startYear, 6, 1)),
    to: new Date(Date.UTC(startYear + 1, 5, 30)),
    label: `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`,
  };
}

function serviceYears(joiningDate: Date) {
  return Math.max(0, Math.floor((Date.now() - joiningDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25)));
}

function pad(n: number, width = 4) {
  return String(n).padStart(width, "0");
}

// Simple deterministic CNIC generator — avoids real CNICs
const cnicBase = 61101_0100000;
let cnicSeq = 0;
async function initCnicSeq() {
  // Count how many DS- CNICs already exist so we don't collide on re-run.
  const count = await prisma.employee.count({ where: { cnic: { startsWith: "61101" } } });
  const userCount = await prisma.user.count({ where: { cnic: { startsWith: "61101" } } });
  cnicSeq = count + userCount;
}
function nextCnic(): string {
  cnicSeq++;
  const num = cnicBase + cnicSeq;
  const s = String(num);
  return `${s.slice(0, 5)}-${s.slice(5, 12)}-${cnicSeq % 9}`;
}

let serviceSeq = 2000;
async function initServiceSeq() {
  // Start after the highest existing DS- service number so re-runs don't collide.
  const last = await prisma.employee.findFirst({
    where: { serviceNumber: { startsWith: "DS-" } },
    orderBy: { serviceNumber: "desc" },
    select: { serviceNumber: true },
  });
  if (last) {
    const n = parseInt(last.serviceNumber.replace("DS-", ""), 10);
    if (!isNaN(n) && n >= serviceSeq) serviceSeq = n;
  }
}
function nextServiceNumber(): string {
  serviceSeq++;
  return `DS-${pad(serviceSeq)}`;
}

let badgeSeq = 6000;
async function initBadgeSeq() {
  // Only look at DS-prefixed badges from this seed's format: FIA-RO-DS-NNNN / FIA-CSO-DS-NNNN
  const dsUsers = await prisma.user.findMany({
    where: { badgeNo: { contains: "-DS-" } },
    select: { badgeNo: true },
  });
  for (const u of dsUsers) {
    const n = parseInt(u.badgeNo.replace(/^.*-DS-/, ""), 10);
    if (!isNaN(n) && n >= badgeSeq) badgeSeq = n;
  }
}
function nextBadge(prefix = "FIA"): string {
  badgeSeq++;
  return `${prefix}-DS-${pad(badgeSeq)}`;
}

async function upsertUser(data: Parameters<PrismaClient["user"]["upsert"]>[0]["create"] & { username: string }) {
  return prisma.user.upsert({
    where: { username: data.username },
    update: {},
    create: data,
  });
}

async function ensureRoleAssignment(
  userId: string,
  role: UserRole,
  scopeTrack: OrgScopeTrack,
  scope: { wingId?: string; directorateId?: string; regionId?: string; zoneId?: string; officeId?: string },
) {
  // Prisma 6 upsert doesn't support nullable fields in compound unique where-clause,
  // so we use findFirst + conditional create for idempotency.
  const existing = await prisma.userRoleAssignment.findFirst({
    where: {
      userId,
      role,
      scopeTrack,
      wingId: scope.wingId ?? null,
      officeId: scope.officeId ?? null,
    },
  });
  if (!existing) {
    await prisma.userRoleAssignment.create({
      data: { userId, role, scopeTrack, ...scope },
    });
  }
}

// ─── main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱  Dashboard seed starting…");

  // Initialise sequence counters from existing DB state so re-runs don't collide.
  await initServiceSeq();
  await initBadgeSeq();
  await initCnicSeq();

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  const fiscalStartYear = new Date().getUTCMonth() >= 6
    ? new Date().getUTCFullYear()
    : new Date().getUTCFullYear() - 1;
  const currFY = fiscalPeriod(fiscalStartYear);
  const prevFY = fiscalPeriod(fiscalStartYear - 1);
  const prev2FY = fiscalPeriod(fiscalStartYear - 2);

  // ── 1. Look up existing org structure ──────────────────────────────────────

  const wings = await prisma.wing.findMany();
  const opsWing = wings.find((w) => w.code === "OPS")!;
  const admWing = wings.find((w) => w.code === "ADM")!;

  const zones = await prisma.zone.findMany();
  const zoneMap = Object.fromEntries(zones.map((z) => [z.name, z]));

  const offices = await prisma.office.findMany();
  const officeMap = Object.fromEntries(offices.map((o) => [o.code, o]));

  const secretDirectorate = (await prisma.directorate.findFirst({ where: { code: "DIR-SB" } }))!;
  const northRegion = (await prisma.region.findFirst({ where: { code: "REG-N" } }))!;
  const southRegion = (await prisma.region.findFirst({ where: { code: "REG-S" } }))!;

  const secretOffice = officeMap["OFC-SB"];
  const secretDept = (await prisma.department.findFirst({ where: { code: "DEP-SB" } }))!;

  // ── 2. Create RO + CSO users per zone ──────────────────────────────────────

  const zoneRoData: Array<{
    zone: string;
    username: string;
    name: string;
    office: string;
    region: typeof northRegion;
  }> = [
    { zone: "Islamabad", username: "ro.isb.ds", name: "Tariq Mehmood", office: "OFC-ISB-Z", region: northRegion },
    { zone: "Peshawar", username: "ro.psh.ds", name: "Rabia Khan", office: "OFC-PSH", region: northRegion },
    { zone: "Faisalabad", username: "ro.fsd.ds", name: "Asif Iqbal", office: "OFC-FSD", region: northRegion },
    { zone: "Multan", username: "ro.mtn.ds", name: "Saba Mir", office: "OFC-MTN", region: northRegion },
    { zone: "Gujrat", username: "ro.grt.ds", name: "Naveed Ahmad", office: "OFC-GRT", region: northRegion },
    { zone: "Balochistan", username: "ro.qta.ds", name: "Zainab Shah", office: "OFC-QTA", region: southRegion },
    { zone: "Sukkur", username: "ro.suk.ds", name: "Kamil Ahmed", office: "OFC-SUK", region: southRegion },
    { zone: "Hyderabad", username: "ro.hyd.ds", name: "Nida Rashid", office: "OFC-HYD", region: southRegion },
  ];

  const roUsers: Record<string, Awaited<ReturnType<typeof upsertUser>>> = {};

  for (const entry of zoneRoData) {
    const zone = zoneMap[entry.zone];
    const office = officeMap[entry.office];
    if (!zone || !office) continue;

    const user = await upsertUser({
      username: entry.username,
      email: `${entry.username}@fia.gov.pk`,
      badgeNo: nextBadge("FIA-RO"),
      displayName: entry.name,
      positionTitle: "Reporting Officer",
      mobileNumber: `0300-${pad(Math.floor(Math.random() * 9000000) + 1000000, 7)}`,
      cnic: nextCnic(),
      passwordHash,
      scopeTrack: OrgScopeTrack.REGIONAL,
      regionId: entry.region.id,
      zoneId: zone.id,
      officeId: office.id,
      wingId: opsWing.id,
    });

    await ensureRoleAssignment(user.id, UserRole.REPORTING_OFFICER, OrgScopeTrack.REGIONAL, {
      regionId: entry.region.id,
      zoneId: zone.id,
      officeId: office.id,
    });

    roUsers[entry.zone] = user;
  }

  const csoCandidates = [
    { zone: "Islamabad", username: "cso.isb.ds", name: "Irfan Hussain", office: "OFC-ISB-Z", region: northRegion },
    { zone: "Peshawar", username: "cso.psh.ds", name: "Samina Bibi", office: "OFC-PSH", region: northRegion },
    { zone: "Faisalabad", username: "cso.fsd.ds", name: "Usman Farooq", office: "OFC-FSD", region: northRegion },
    { zone: "Multan", username: "cso.mtn.ds", name: "Amna Siddiqui", office: "OFC-MTN", region: northRegion },
    { zone: "Balochistan", username: "cso.qta.ds", name: "Ghulam Sarwar", office: "OFC-QTA", region: southRegion },
    { zone: "Karachi", username: "cso.khi.ds2", name: "Raheela Javed", office: "OFC-KHI", region: southRegion },
    { zone: "Sukkur", username: "cso.suk.ds", name: "Farhan Malik", office: "OFC-SUK", region: southRegion },
    { zone: "Hyderabad", username: "cso.hyd.ds", name: "Mehwish Raza", office: "OFC-HYD", region: southRegion },
  ];

  const csoUsers: Record<string, Awaited<ReturnType<typeof upsertUser>>> = {};

  for (const entry of csoCandidates) {
    const zone = zoneMap[entry.zone];
    const office = officeMap[entry.office];
    if (!zone || !office) continue;

    const user = await upsertUser({
      username: entry.username,
      email: `${entry.username}@fia.gov.pk`,
      badgeNo: nextBadge("FIA-CSO"),
      displayName: entry.name,
      positionTitle: "Countersigning Officer",
      mobileNumber: `0333-${pad(Math.floor(Math.random() * 9000000) + 1000000, 7)}`,
      cnic: nextCnic(),
      passwordHash,
      scopeTrack: OrgScopeTrack.REGIONAL,
      regionId: entry.region.id,
      zoneId: zone.id,
      officeId: office.id,
      wingId: opsWing.id,
    });

    await ensureRoleAssignment(user.id, UserRole.COUNTERSIGNING_OFFICER, OrgScopeTrack.REGIONAL, {
      regionId: entry.region.id,
      zoneId: zone.id,
      officeId: office.id,
    });

    csoUsers[entry.zone] = user;
  }

  // Fallback: load existing RO/CSO for Lahore and Karachi (already in base seed)
  const existingRoLhr = await prisma.user.findFirst({ where: { username: "reporting.lhr" } });
  const existingCsoLhr = await prisma.user.findFirst({ where: { username: "countersigning.lhr" } });
  const existingRoKhi = await prisma.user.findFirst({ where: { username: "reporting.khi" } });
  const existingCsoKhi = await prisma.user.findFirst({ where: { username: "countersigning.khi" } });

  if (existingRoLhr) roUsers["Lahore"] = existingRoLhr;
  if (existingRoKhi) roUsers["Karachi"] = existingRoKhi;
  if (existingCsoLhr) csoUsers["Lahore"] = existingCsoLhr;
  if (existingCsoKhi) csoUsers["Karachi"] = existingCsoKhi;

  // Secret branch admin lookup
  const secretAdminUser = (await prisma.user.findFirst({ where: { username: "secret.admin" } }))!;
  const da1User = (await prisma.user.findFirst({ where: { username: "secret.da1" } }))!;
  const da2User = (await prisma.user.findFirst({ where: { username: "secret.da2" } }))!;
  const clerkUser = (await prisma.user.findFirst({ where: { username: "clerk.isb" } }))!;

  // ── 3. Create employees ─────────────────────────────────────────────────────
  //
  // Zone distribution — how many employees per zone, which template families
  //                     and which region/RO/CSO they get assigned to.
  //
  // We aim for realistic org spread so charts show zone-to-zone variance.

  const zoneEmployeeBlueprints: Array<{
    zone: string;
    region: typeof northRegion;
    office: string;
    count: number;
    templates: TemplateFamilyCode[];
    targetCompletionRate: number; // 0-1, used when creating ACRs
    extraOverdue?: boolean;
  }> = [
    { zone: "Islamabad", region: northRegion, office: "OFC-ISB-Z", count: 8, templates: [TemplateFamilyCode.ASSISTANT_UDC_LDC, TemplateFamilyCode.PER_17_18_OFFICERS], targetCompletionRate: 0.75 },
    { zone: "Lahore", region: northRegion, office: "OFC-LHE", count: 10, templates: [TemplateFamilyCode.SUPERINTENDENT_AINCHARGE, TemplateFamilyCode.INSPECTOR_SI_ASI], targetCompletionRate: 0.85 },
    { zone: "Karachi", region: southRegion, office: "OFC-KHI", count: 10, templates: [TemplateFamilyCode.INSPECTOR_SI_ASI, TemplateFamilyCode.APS_STENOTYPIST], targetCompletionRate: 0.55, extraOverdue: true },
    { zone: "Peshawar", region: northRegion, office: "OFC-PSH", count: 7, templates: [TemplateFamilyCode.ASSISTANT_UDC_LDC, TemplateFamilyCode.CAR_DRIVERS_DESPATCH_RIDERS], targetCompletionRate: 0.70 },
    { zone: "Faisalabad", region: northRegion, office: "OFC-FSD", count: 6, templates: [TemplateFamilyCode.APS_STENOTYPIST, TemplateFamilyCode.SUPERINTENDENT_AINCHARGE], targetCompletionRate: 0.80 },
    { zone: "Multan", region: northRegion, office: "OFC-MTN", count: 5, templates: [TemplateFamilyCode.INSPECTOR_SI_ASI, TemplateFamilyCode.PER_17_18_OFFICERS], targetCompletionRate: 0.65 },
    { zone: "Gujrat", region: northRegion, office: "OFC-GRT", count: 4, templates: [TemplateFamilyCode.ASSISTANT_UDC_LDC, TemplateFamilyCode.APS_STENOTYPIST], targetCompletionRate: 0.72 },
    { zone: "Balochistan", region: southRegion, office: "OFC-QTA", count: 5, templates: [TemplateFamilyCode.CAR_DRIVERS_DESPATCH_RIDERS, TemplateFamilyCode.INSPECTOR_SI_ASI], targetCompletionRate: 0.45, extraOverdue: true },
    { zone: "Sukkur", region: southRegion, office: "OFC-SUK", count: 3, templates: [TemplateFamilyCode.ASSISTANT_UDC_LDC, TemplateFamilyCode.APS_STENOTYPIST], targetCompletionRate: 0.60 },
    { zone: "Hyderabad", region: southRegion, office: "OFC-HYD", count: 3, templates: [TemplateFamilyCode.SUPERINTENDENT_AINCHARGE, TemplateFamilyCode.CAR_DRIVERS_DESPATCH_RIDERS], targetCompletionRate: 0.62 },
  ];

  // Pakistani male/female name pools
  const maleFirstNames = ["Imran","Adnan","Waseem","Rizwan","Tariq","Haroon","Shoaib","Babar","Zeeshan","Faisal","Atif","Naseem","Majid","Salman","Khalid","Tanvir","Sajid","Aamir","Danish","Muneeb","Yasir","Bilal","Hamid","Farhan","Waqas","Ali","Umar","Hassan","Abdullah","Rafiq"];
  const femaleFirstNames = ["Ayesha","Zara","Sana","Nadia","Huma","Maryam","Fariha","Sobia","Asma","Sidra","Rabia","Nadia","Amber","Faiza","Lubna","Shazia","Nosheen","Farida","Mehnaz","Samia","Aiman","Hafsa","Sadia","Nasreen","Amna","Rubina","Kiran","Mehwish","Iqra","Mariam"];
  const lastNames = ["Khan","Malik","Ahmed","Hussain","Shah","Ali","Butt","Chaudhry","Iqbal","Mirza","Siddiqui","Aslam","Baig","Rizvi","Qureshi","Rashid","Nawaz","Abbasi","Javed","Niazi","Sher","Gilani","Raza","Ansari","Bhatti","Saeed","Waqar","Memon","Baloch","Khwaja"];

  function randomName(gender: Gender): string {
    const firstNames = gender === Gender.FEMALE ? femaleFirstNames : maleFirstNames;
    return `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`;
  }

  const templateFamilyToRank: Record<TemplateFamilyCode, { rank: string; designation: string; bps: number }> = {
    ASSISTANT_UDC_LDC: { rank: "Upper Division Clerk", designation: "UDC", bps: 9 },
    APS_STENOTYPIST: { rank: "Stenotypist", designation: "Stenotypist", bps: 14 },
    INSPECTOR_SI_ASI: { rank: "Inspector", designation: "Inspector", bps: 16 },
    SUPERINTENDENT_AINCHARGE: { rank: "Sub-Inspector", designation: "SI", bps: 14 },
    CAR_DRIVERS_DESPATCH_RIDERS: { rank: "Car Driver", designation: "Driver", bps: 4 },
    PER_17_18_OFFICERS: { rank: "Deputy Director", designation: "DD", bps: 18 },
  };

  type CreatedEmployee = Prisma.EmployeeGetPayload<Record<string, never>>;

  // Map zone → list of employees created in this seed
  const zoneEmployees: Record<string, CreatedEmployee[]> = {};

  for (const blueprint of zoneEmployeeBlueprints) {
    const zone = zoneMap[blueprint.zone];
    const office = officeMap[blueprint.office];
    if (!zone || !office) continue;

    const ro = roUsers[blueprint.zone];
    const cso = csoUsers[blueprint.zone];
    if (!ro) continue;

    // If this zone already has DS- employees from a prior run, reuse them.
    const existingZoneEmps = await prisma.employee.findMany({
      where: { serviceNumber: { startsWith: "DS-" }, officeId: office.id },
    });
    if (existingZoneEmps.length >= blueprint.count) {
      zoneEmployees[blueprint.zone] = existingZoneEmps.slice(0, blueprint.count);
      continue;
    }

    zoneEmployees[blueprint.zone] = [...existingZoneEmps];
    const toCreate = blueprint.count - existingZoneEmps.length;

    for (let i = 0; i < toCreate; i++) {
      const gender: Gender = Math.random() > 0.35 ? Gender.MALE : Gender.FEMALE;
      const name = randomName(gender);
      const template = blueprint.templates[i % blueprint.templates.length];
      const { rank, designation, bps } = templateFamilyToRank[template];
      const joiningDate = daysAgo(Math.floor(Math.random() * 3650) + 365);

      const emp = await prisma.employee.create({
        data: {
          serviceNumber: nextServiceNumber(),
          name,
          rank,
          designation,
          positionTitle: designation,
          bps,
          cnic: nextCnic(),
          mobile: `0${Math.floor(Math.random() * 2) === 0 ? "300" : "345"}-${pad(Math.floor(Math.random() * 9000000) + 1000000, 7)}`,
          email: `${name.toLowerCase().replace(/\s+/g, ".")}.${blueprint.zone.toLowerCase()}@fia.gov.pk`,
          posting: office.name,
          joiningDate,
          serviceYears: serviceYears(joiningDate),
          address: `${blueprint.zone}, Pakistan`,
          templateFamily: template,
          scopeTrack: OrgScopeTrack.REGIONAL,
          wingId: opsWing.id,
          regionId: blueprint.region.id,
          zoneId: zone.id,
          officeId: office.id,
          reportingOfficerId: ro.id,
          countersigningOfficerId: cso?.id ?? null,
          gender,
          dateOfBirth: daysAgo(Math.floor(Math.random() * 3650) + 8760),
          fatherName: `${lastNames[Math.floor(Math.random() * lastNames.length)]} Khan`,
          basicPay: bps * 3500 + Math.floor(Math.random() * 10000),
          appointmentToBpsDate: joiningDate,
          deputationType: DeputationType.DIRECT,
          serviceGroup: "Federal Government Service",
          educationLevel: bps >= 17 ? EducationLevel.MA_MSC : bps >= 14 ? EducationLevel.BA_BSC : EducationLevel.INTERMEDIATE,
          qualifications: bps >= 17 ? "M.Sc. / LLB" : bps >= 14 ? "B.A." : "Intermediate",
          natureOfDuties: `${designation} duties at ${office.name}`,
          personnelNumber: `PER-${blueprint.zone.slice(0, 3).toUpperCase()}-${bps}${pad(serviceSeq, 3)}`,
        },
      });

      zoneEmployees[blueprint.zone].push(emp);
    }
  }

  // ── 4. Load template versions ───────────────────────────────────────────────

  const templateVersions = await prisma.templateVersion.findMany();
  const tvMap = Object.fromEntries(templateVersions.map((tv) => [tv.family, tv]));

  // ── 5. Create ACR records ───────────────────────────────────────────────────
  //
  // Strategy:
  //   • For each employee we create between 1-3 ACR records.
  //   • "Old archived" records are backdated to 7-15 months ago so archive
  //     waterfall and trend charts show month-over-month movement.
  //   • "Recent" records are in the last 0-3 months, covering all live states.
  //   • A small percentage are overdue (dueDate in the past, not archived).
  //   • One Previous FY batch gives comparison deltas.

  // Init acrSeq from the highest 4-digit suffix in existing dashboard-style ACR numbers.
  let acrSeq = 100;
  {
    const existingAcrs = await prisma.acrRecord.findMany({
      where: { acrNo: { contains: "/FIA/ACR/" } },
      select: { acrNo: true },
    });
    // Also check standard format: FIA/ACR/YYYY-YY/ZON/NNNN
    const allAcrs = await prisma.acrRecord.findMany({
      where: { acrNo: { startsWith: "FIA/ACR/" } },
      select: { acrNo: true },
    });
    for (const a of [...existingAcrs, ...allAcrs]) {
      const parts = a.acrNo.split("/");
      const n = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(n) && n > acrSeq) acrSeq = n;
    }
  }
  function nextAcrNo(zone: string, fy: string) {
    acrSeq++;
    return `FIA/ACR/${fy}/${zone.slice(0, 3).toUpperCase()}/${pad(acrSeq, 4)}`;
  }

  function snap(emp: CreatedEmployee): Prisma.InputJsonValue {
    return {
      name: emp.name,
      posting: emp.posting,
      serviceNumber: emp.serviceNumber,
      capturedAt: new Date().toISOString(),
    };
  }

  // Weights for states — varied by zone completion rate
  function pickState(completionRate: number, isOverdueProne: boolean): AcrWorkflowState {
    const r = Math.random();
    if (r < completionRate) return AcrWorkflowState.ARCHIVED;
    if (r < completionRate + 0.12) return AcrWorkflowState.PENDING_SECRET_BRANCH_REVIEW;
    if (r < completionRate + 0.20) return AcrWorkflowState.PENDING_COUNTERSIGNING;
    if (r < completionRate + 0.30) return AcrWorkflowState.PENDING_REPORTING;
    if (r < completionRate + 0.35) return AcrWorkflowState.RETURNED_TO_CLERK;
    if (r < completionRate + 0.40) return AcrWorkflowState.RETURNED_TO_REPORTING;
    if (isOverdueProne && r < completionRate + 0.50) return AcrWorkflowState.PENDING_REPORTING; // extra stuck
    return AcrWorkflowState.DRAFT;
  }

  const stateToLabel: Record<AcrWorkflowState, string> = {
    DRAFT: "Draft",
    PENDING_ADMIN_FORWARDING: "Pending Admin Office Forwarding",
    PENDING_SECRET_CELL_INTAKE: "Pending Secret Cell Intake",
    PENDING_REPORTING: "Pending Reporting Officer",
    PENDING_COUNTERSIGNING: "Pending Countersigning Officer",
    PENDING_SECRET_BRANCH_REVIEW: "Pending Secret Branch Review",
    PENDING_SECRET_BRANCH_VERIFICATION: "Pending Secret Branch Verification",
    RETURNED_TO_CLERK: "Returned to Clerk",
    RETURNED_TO_REPORTING: "Returned to Reporting Officer",
    RETURNED_TO_COUNTERSIGNING: "Returned to Countersigning Officer",
    RETURNED_TO_ADMIN_OFFICE: "Returned to Admin Office",
    ARCHIVED: "Archived",
  };

  // Month buckets for trend chart (last 12 months → 1 archive batch per month)
  // We'll also create some prev-FY records.

  for (const blueprint of zoneEmployeeBlueprints) {
    const zone = zoneMap[blueprint.zone];
    if (!zone) continue;

    const ro = roUsers[blueprint.zone];
    const cso = csoUsers[blueprint.zone];
    const empList = zoneEmployees[blueprint.zone] ?? [];
    if (empList.length === 0 || !ro) continue;

    // ── Current FY: one ACR per employee, plus extra for high-volume zones
    for (let idx = 0; idx < empList.length; idx++) {
      const emp = empList[idx];
      const tv = tvMap[emp.templateFamily!];
      if (!tv) continue;

      // Skip if employee already has a current-FY ACR (idempotency guard).
      const existingCurrAcr = await prisma.acrRecord.findFirst({
        where: { employeeId: emp.id, reportingPeriodFrom: currFY.from },
        select: { id: true },
      });
      if (existingCurrAcr) continue;

      const state = pickState(blueprint.targetCompletionRate, !!blueprint.extraOverdue);
      const monthsBackCreated = Math.floor(Math.random() * 10) + 2; // 2-11 months ago
      const createdAt = monthsAgo(monthsBackCreated);
      const isArchived = state === AcrWorkflowState.ARCHIVED;
      const isOverdue = !isArchived && Math.random() < (blueprint.extraOverdue ? 0.55 : 0.22);
      const dueDate = isArchived
        ? daysAgo(Math.floor(Math.random() * 180) + 30)
        : isOverdue
          ? daysAgo(Math.floor(Math.random() * 30) + 1)
          : daysAhead(Math.floor(Math.random() * 30) + 3);
      const completedAt = isArchived ? new Date(dueDate.getTime() - Math.random() * 7 * 86_400_000) : null;

      const acrNo = nextAcrNo(blueprint.zone, currFY.label);

      const acr = await prisma.acrRecord.create({
        data: {
          acrNo,
          employeeId: emp.id,
          initiatedById: clerkUser.id,
          reportingOfficerId: ro.id,
          countersigningOfficerId: cso?.id ?? null,
          currentHolderId: isArchived ? secretAdminUser.id : ro.id,
          templateVersionId: tv.id,
          workflowState: state,
          statusLabel: stateToLabel[state],
          reportingPeriodFrom: currFY.from,
          reportingPeriodTo: currFY.to,
          dueDate,
          isPriority: Math.random() < 0.08,
          performanceScore: isArchived ? Math.floor(Math.random() * 40) + 60 : null,
          employeeMetadataSnapshot: snap(emp),
          ...(isArchived && {
            secretBranchAllocatedToId: da1User?.id ?? null,
            secretBranchVerifiedById: secretAdminUser?.id ?? null,
            secretBranchDeskCode: SecretBranchDeskCode.DA1,
            secretBranchSubmittedAt: new Date(completedAt!.getTime() - 3 * 86_400_000),
            secretBranchReviewedAt: new Date(completedAt!.getTime() - 2 * 86_400_000),
            secretBranchVerifiedAt: completedAt,
            completedDate: completedAt,
            archivedAt: completedAt,
          }),
          ...(state === AcrWorkflowState.RETURNED_TO_CLERK && {
            correctionRemarks: "Please correct clerk-stage metadata.",
            returnToRole: UserRole.CLERK,
            returnedByRole: UserRole.REPORTING_OFFICER,
          }),
          ...(state === AcrWorkflowState.RETURNED_TO_REPORTING && {
            correctionRemarks: "Reporting remarks require revision.",
            returnToRole: UserRole.REPORTING_OFFICER,
            returnedByRole: UserRole.COUNTERSIGNING_OFFICER,
          }),
          createdAt,
          updatedAt: isArchived ? completedAt! : daysAgo(Math.floor(Math.random() * 30)),
        },
      });

      // Timeline entry
      if (state !== AcrWorkflowState.DRAFT) {
        await prisma.acrTimelineEntry.createMany({
          data: [
            { acrRecordId: acr.id, actorId: clerkUser.id, actorRole: "Clerk", action: "Submitted to Reporting Officer", status: "completed", createdAt: new Date(createdAt.getTime() + 2 * 86_400_000) },
            ...(isArchived ? [
              { acrRecordId: acr.id, actorId: ro.id, actorRole: "Reporting Officer", action: "Forwarded to Countersigning Officer", status: "completed", createdAt: new Date(createdAt.getTime() + 7 * 86_400_000) },
              { acrRecordId: acr.id, actorId: secretAdminUser.id, actorRole: "Secret Branch", action: "Secret Branch verification completed", status: "completed", createdAt: completedAt! },
            ] : []),
          ],
          skipDuplicates: true,
        });
      }

      // Archive record + snapshot for archived
      if (isArchived && completedAt) {
        const docPath = `archive/${acr.acrNo.replaceAll("/", "-")}.pdf`;
        const archiveRec = await prisma.archiveRecord.create({
          data: {
            employeeId: emp.id,
            acrRecordId: acr.id,
            source: ArchiveRecordSource.WORKFLOW_FINAL,
            scopeTrack: emp.scopeTrack,
            templateFamily: emp.templateFamily!,
            reportingPeriodFrom: currFY.from,
            reportingPeriodTo: currFY.to,
            archiveReference: `archive/${acr.acrNo.replaceAll("/", "-")}`,
            positionTitle: emp.positionTitle,
            employeeName: emp.name,
            employeeServiceNumber: emp.serviceNumber,
            employeeCnic: emp.cnic,
            employeePosting: emp.posting,
            wingId: emp.wingId,
            regionId: emp.regionId,
            zoneId: emp.zoneId,
            officeId: emp.officeId,
            organizationSnapshot: { zone: blueprint.zone, region: blueprint.region.name, office: officeMap[blueprint.office]?.name ?? "" } as Prisma.InputJsonValue,
            documentPath: docPath,
            uploadedById: da1User?.id ?? secretAdminUser.id,
            verifiedById: secretAdminUser.id,
            verifiedAt: completedAt,
            isVerified: true,
          },
        });

        await prisma.archiveSnapshot.create({
          data: {
            acrRecordId: acr.id,
            archivedById: secretAdminUser.id,
            documentPath: docPath,
            checksum: `checksum-${acr.id}`,
            immutableHash: `hash-${acr.id}`,
            createdAt: completedAt,
          },
        });

        // Link established via ArchiveRecord.acrRecordId — no reverse update needed.
      }
    }

    // ── Previous FY: archived batch per zone (gives comparison deltas) ────────
    const prevFyCount = Math.floor(empList.length * 0.6);
    for (let idx = 0; idx < prevFyCount; idx++) {
      const emp = empList[idx % empList.length];
      const tv = tvMap[emp.templateFamily!];
      if (!tv) continue;

      // Skip if employee already has a prev-FY ACR (idempotency guard).
      const existingPrevAcr = await prisma.acrRecord.findFirst({
        where: { employeeId: emp.id, reportingPeriodFrom: prevFY.from },
        select: { id: true },
      });
      if (existingPrevAcr) continue;

      const completedMonthsAgo = Math.floor(Math.random() * 6) + 12; // 12-17 months ago
      const completedAt = monthsAgo(completedMonthsAgo);
      const createdAt = new Date(completedAt.getTime() - 60 * 86_400_000);
      const acrNo = nextAcrNo(blueprint.zone, prevFY.label);

      const acr = await prisma.acrRecord.create({
        data: {
          acrNo,
          employeeId: emp.id,
          initiatedById: clerkUser.id,
          reportingOfficerId: ro.id,
          countersigningOfficerId: cso?.id ?? null,
          currentHolderId: secretAdminUser.id,
          templateVersionId: tv.id,
          workflowState: AcrWorkflowState.ARCHIVED,
          statusLabel: "Archived",
          reportingPeriodFrom: prevFY.from,
          reportingPeriodTo: prevFY.to,
          dueDate: completedAt,
          isPriority: false,
          performanceScore: Math.floor(Math.random() * 40) + 55,
          secretBranchAllocatedToId: da1User?.id ?? null,
          secretBranchVerifiedById: secretAdminUser?.id ?? null,
          secretBranchDeskCode: SecretBranchDeskCode.DA1,
          secretBranchSubmittedAt: new Date(completedAt.getTime() - 3 * 86_400_000),
          secretBranchReviewedAt: new Date(completedAt.getTime() - 2 * 86_400_000),
          secretBranchVerifiedAt: completedAt,
          completedDate: completedAt,
          archivedAt: completedAt,
          employeeMetadataSnapshot: snap(emp),
          createdAt,
          updatedAt: completedAt,
        },
      });

      const docPath = `archive/${acr.acrNo.replaceAll("/", "-")}.pdf`;
      const archiveRec = await prisma.archiveRecord.create({
        data: {
          employeeId: emp.id,
          acrRecordId: acr.id,
          source: ArchiveRecordSource.WORKFLOW_FINAL,
          scopeTrack: emp.scopeTrack,
          templateFamily: emp.templateFamily!,
          reportingPeriodFrom: prevFY.from,
          reportingPeriodTo: prevFY.to,
          archiveReference: `archive/${acr.acrNo.replaceAll("/", "-")}`,
          positionTitle: emp.positionTitle,
          employeeName: emp.name,
          employeeServiceNumber: emp.serviceNumber,
          employeeCnic: emp.cnic,
          employeePosting: emp.posting,
          wingId: emp.wingId,
          regionId: emp.regionId,
          zoneId: emp.zoneId,
          officeId: emp.officeId,
          organizationSnapshot: { zone: blueprint.zone, region: blueprint.region.name } as Prisma.InputJsonValue,
          documentPath: docPath,
          uploadedById: da1User?.id ?? secretAdminUser.id,
          verifiedById: secretAdminUser.id,
          verifiedAt: completedAt,
          isVerified: true,
          createdAt: completedAt,
          updatedAt: completedAt,
        },
      });

      await prisma.archiveSnapshot.create({
        data: {
          acrRecordId: acr.id,
          archivedById: secretAdminUser.id,
          documentPath: docPath,
          checksum: `checksum-prev-${acr.id}`,
          immutableHash: `hash-prev-${acr.id}`,
          createdAt: completedAt,
        },
      });

      // Link established via ArchiveRecord.acrRecordId — no reverse update needed.
    }
  }

  // ── 6. Wing-level HQ employees + ACRs (for wing-track charts) ──────────────

  const hqOffice = officeMap["OFC-HQ"];
  const hqRo = await prisma.user.findFirst({ where: { username: "reporting.lhr" } });
  const wingOfficeList = [
    { office: officeMap["OFC-CCW"], zone: null, region: null },
    { office: officeMap["OFC-IMM"], zone: null, region: null },
    { office: officeMap["OFC-ACW"], zone: null, region: null },
    { office: officeMap["OFC-AML"], zone: null, region: null },
    { office: hqOffice, zone: null, region: null },
  ].filter((e) => !!e.office);

  for (const entry of wingOfficeList.slice(0, 3)) {
    // Skip if this office already has 4 wing-track DS- employees.
    const existingWingEmps = await prisma.employee.findMany({
      where: { serviceNumber: { startsWith: "DS-" }, officeId: entry.office.id, scopeTrack: OrgScopeTrack.WING },
    });
    if (existingWingEmps.length >= 4) continue;

    const toCreateWing = 4 - existingWingEmps.length;
    for (let i = 0; i < toCreateWing; i++) {
      const gender: Gender = Math.random() > 0.4 ? Gender.MALE : Gender.FEMALE;
      const name = randomName(gender);
      const template: TemplateFamilyCode = i % 2 === 0 ? TemplateFamilyCode.PER_17_18_OFFICERS : TemplateFamilyCode.ASSISTANT_UDC_LDC;
      const { rank, designation, bps } = templateFamilyToRank[template];
      const joiningDate = daysAgo(Math.floor(Math.random() * 3000) + 400);

      const emp = await prisma.employee.create({
        data: {
          serviceNumber: nextServiceNumber(),
          name,
          rank,
          designation,
          positionTitle: designation,
          bps,
          cnic: nextCnic(),
          mobile: `0300-${pad(Math.floor(Math.random() * 9000000) + 1000000, 7)}`,
          email: `${name.toLowerCase().replace(/\s+/g, ".")}@fia.gov.pk`,
          posting: entry.office.name,
          joiningDate,
          serviceYears: serviceYears(joiningDate),
          address: "Islamabad, Pakistan",
          templateFamily: template,
          scopeTrack: OrgScopeTrack.WING,
          wingId: admWing.id,
          officeId: entry.office.id,
          reportingOfficerId: hqRo?.id ?? null,
        },
      });

      const tv = tvMap[template];
      if (!tv || !hqRo) continue;

      // Skip if emp already has a curr-FY ACR.
      const existingHqAcr = await prisma.acrRecord.findFirst({
        where: { employeeId: emp.id, reportingPeriodFrom: currFY.from },
        select: { id: true },
      });
      if (existingHqAcr) continue;

      const state = Math.random() < 0.65 ? AcrWorkflowState.ARCHIVED : AcrWorkflowState.PENDING_REPORTING;
      const isArchived = state === AcrWorkflowState.ARCHIVED;
      const createdAt = daysAgo(Math.floor(Math.random() * 300) + 30);
      const completedAt = isArchived ? daysAgo(Math.floor(Math.random() * 90) + 7) : null;

      const acr = await prisma.acrRecord.create({
        data: {
          acrNo: nextAcrNo("HQ", currFY.label),
          employeeId: emp.id,
          initiatedById: clerkUser.id,
          reportingOfficerId: hqRo.id,
          currentHolderId: isArchived ? secretAdminUser.id : hqRo.id,
          templateVersionId: tv.id,
          workflowState: state,
          statusLabel: stateToLabel[state],
          reportingPeriodFrom: currFY.from,
          reportingPeriodTo: currFY.to,
          dueDate: isArchived ? completedAt! : daysAhead(Math.floor(Math.random() * 20) + 5),
          performanceScore: isArchived ? Math.floor(Math.random() * 35) + 65 : null,
          employeeMetadataSnapshot: snap(emp),
          ...(isArchived && {
            secretBranchVerifiedById: secretAdminUser.id,
            secretBranchAllocatedToId: da1User?.id ?? null,
            secretBranchDeskCode: SecretBranchDeskCode.DA1,
            secretBranchSubmittedAt: new Date(completedAt!.getTime() - 2 * 86_400_000),
            secretBranchReviewedAt: new Date(completedAt!.getTime() - 86_400_000),
            secretBranchVerifiedAt: completedAt,
            completedDate: completedAt,
            archivedAt: completedAt,
          }),
          createdAt,
          updatedAt: completedAt ?? createdAt,
        },
      });

      if (isArchived && completedAt) {
        const docPath = `archive/${acr.acrNo.replaceAll("/", "-")}.pdf`;
        const archiveRec = await prisma.archiveRecord.create({
          data: {
            employeeId: emp.id,
            acrRecordId: acr.id,
            source: ArchiveRecordSource.WORKFLOW_FINAL,
            scopeTrack: emp.scopeTrack,
            templateFamily: emp.templateFamily!,
            reportingPeriodFrom: currFY.from,
            reportingPeriodTo: currFY.to,
            archiveReference: `archive/${acr.acrNo.replaceAll("/", "-")}`,
            positionTitle: emp.positionTitle,
            employeeName: emp.name,
            employeeServiceNumber: emp.serviceNumber,
            employeeCnic: emp.cnic,
            employeePosting: emp.posting,
            wingId: emp.wingId,
            officeId: emp.officeId,
            organizationSnapshot: { wing: "Administration Wing", office: entry.office.name } as Prisma.InputJsonValue,
            documentPath: docPath,
            uploadedById: da1User?.id ?? secretAdminUser.id,
            verifiedById: secretAdminUser.id,
            verifiedAt: completedAt,
            isVerified: true,
            createdAt: completedAt,
          },
        });

        await prisma.archiveSnapshot.create({
          data: {
            acrRecordId: acr.id,
            archivedById: secretAdminUser.id,
            documentPath: docPath,
            checksum: `checksum-hq-${acr.id}`,
            immutableHash: `hash-hq-${acr.id}`,
            createdAt: completedAt,
          },
        });

        // Link established via ArchiveRecord.acrRecordId — no reverse update needed.
      }
    }
  }

  // ── 7. Wing diversity — reassign some DS- employees to ADM wing ──────────────
  //
  // Karachi, Balochistan, Sukkur, Hyderabad are reassigned to Administration Wing
  // so the Wing-wise Performance chart shows at least two distinct bars.

  const admZonesForWingChart = ["Karachi", "Balochistan", "Sukkur", "Hyderabad"];
  for (const zoneName of admZonesForWingChart) {
    const zone = zoneMap[zoneName];
    if (!zone) continue;
    await prisma.employee.updateMany({
      where: { serviceNumber: { startsWith: "DS-" }, zoneId: zone.id },
      data: { wingId: admWing.id },
    });
  }
  console.log(`   Wing split  : Karachi/Balochistan/Sukkur/Hyderabad → ADM wing`);

  // ── 8. Summary ──────────────────────────────────────────────────────────────

  const totalAcrs = await prisma.acrRecord.count();
  const totalEmployees = await prisma.employee.count();
  const totalArchived = await prisma.archiveRecord.count();

  // Also update wingId on ArchiveRecords for the same zones (for waterfall/wing charts)
  for (const zoneName of admZonesForWingChart) {
    const zone = zoneMap[zoneName];
    if (!zone) continue;
    await prisma.archiveRecord.updateMany({
      where: { zoneId: zone.id },
      data: { wingId: admWing.id },
    });
  }

  console.log(`\n✅  Dashboard seed complete`);
  console.log(`   Employees  : ${totalEmployees}`);
  console.log(`   ACR records: ${totalAcrs}`);
  console.log(`   Archives   : ${totalArchived}`);
  console.log(`\n   Login credentials (all users): ${DEMO_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error("Dashboard seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
