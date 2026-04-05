import {
  AcrWorkflowState,
  FileAssetKind,
  LanguageMode,
  NotificationType,
  PrismaClient,
  TemplateFamilyCode,
  UserRole,
} from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "ChangeMe@123";
const DEFAULT_IP = "10.10.14.22";

type ScopedRoleInput = {
  role: UserRole;
  wingId?: string | null;
  zoneId?: string | null;
  officeId?: string | null;
};

function shiftDate(base: Date, days = 0, hours = 0) {
  const value = new Date(base);
  value.setUTCDate(value.getUTCDate() + days);
  value.setUTCHours(value.getUTCHours() + hours);
  return value;
}

function dateFromNow(days: number, hours = 9) {
  const value = new Date();
  value.setUTCHours(hours, 0, 0, 0);
  value.setUTCDate(value.getUTCDate() + days);
  return value;
}

function fixedDate(isoDate: string) {
  return new Date(`${isoDate}T09:00:00.000Z`);
}

function fiscalPeriod(startYear: number) {
  return {
    from: new Date(Date.UTC(startYear, 6, 1, 0, 0, 0)),
    to: new Date(Date.UTC(startYear + 1, 5, 30, 0, 0, 0)),
    label: `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`,
  };
}

function calculateServiceYears(joiningDate: Date) {
  const diff = Date.now() - joiningDate.getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25)));
}

async function resetDatabase() {
  await prisma.authChallenge.deleteMany();
  await prisma.archiveSnapshot.deleteMany();
  await prisma.fileAsset.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.acrTimelineEntry.deleteMany();
  await prisma.acrRecord.deleteMany();
  await prisma.templateVersion.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.session.deleteMany();
  await prisma.userRoleAssignment.deleteMany();
  await prisma.adminSetting.deleteMany();
  await prisma.user.deleteMany();
  await prisma.office.deleteMany();
  await prisma.zone.deleteMany();
  await prisma.wing.deleteMany();
}

async function createUser(input: {
  username: string;
  email: string;
  badgeNo: string;
  displayName: string;
  mobileNumber?: string | null;
  passwordHash: string;
  twoFactorEnabled?: boolean;
  wingId?: string | null;
  zoneId?: string | null;
  officeId?: string | null;
  roles: ScopedRoleInput[];
}) {
  const { roles, ...userData } = input;
  const user = await prisma.user.upsert({
    where: { email: userData.email },
    update: userData,
    create: userData,
  });

  await prisma.userRoleAssignment.deleteMany({
    where: { userId: user.id },
  });

  await prisma.userRoleAssignment.createMany({
    data: roles.map((role) => ({
      userId: user.id,
      role: role.role,
      wingId: role.wingId ?? null,
      zoneId: role.zoneId ?? null,
      officeId: role.officeId ?? null,
    })),
  });

  return user;
}

function timelineSeed(
  acrRecordId: string,
  actorId: string | null,
  actorRole: string,
  action: string,
  status: "completed" | "active" | "pending" | "returned",
  createdAt: Date,
  remarks?: string,
) {
  return {
    acrRecordId,
    actorId,
    actorRole,
    action,
    status,
    remarks,
    createdAt,
  };
}

function auditSeed(
  actorId: string | null,
  actorRole: string,
  action: string,
  createdAt: Date,
  details: string,
  acrRecordId?: string,
) {
  return {
    actorId,
    acrRecordId,
    action,
    actorRole,
    ipAddress: DEFAULT_IP,
    details,
    createdAt,
  };
}

function documentPath(acrNo: string) {
  return `archive/${acrNo.replaceAll("/", "-")}.pdf`;
}

async function main() {
  await resetDatabase();

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const now = new Date();
  const currentFiscalStartYear = now.getUTCMonth() >= 6 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  const currentFiscal = fiscalPeriod(currentFiscalStartYear);
  const previousFiscal = fiscalPeriod(currentFiscalStartYear - 1);

  const wings = {
    administration: await prisma.wing.create({ data: { code: "ADM", name: "Administration Wing" } }),
    immigration: await prisma.wing.create({ data: { code: "IMM", name: "Immigration Wing" } }),
    antiCorruption: await prisma.wing.create({ data: { code: "ACC", name: "Anti-Corruption Wing" } }),
    cyberCrime: await prisma.wing.create({ data: { code: "CYB", name: "Cyber Crime Wing" } }),
  };

  const zones = {
    islamabad: await prisma.zone.create({
      data: { code: "ICT", name: "Islamabad Capital Zone", wingId: wings.administration.id },
    }),
    punjab: await prisma.zone.create({
      data: { code: "PNJ", name: "Punjab Zone", wingId: wings.immigration.id },
    }),
    kpk: await prisma.zone.create({
      data: { code: "KPK", name: "Khyber Pakhtunkhwa Zone", wingId: wings.antiCorruption.id },
    }),
    sindh: await prisma.zone.create({
      data: { code: "SDH", name: "Sindh Zone", wingId: wings.cyberCrime.id },
    }),
  };

  const offices = {
    hq: await prisma.office.create({
      data: { code: "HQ-ISB", name: "FIA HQ Islamabad", wingId: wings.administration.id, zoneId: zones.islamabad.id },
    }),
    secretBranch: await prisma.office.create({
      data: { code: "SB-ISB", name: "Secret Branch Cell Islamabad", wingId: wings.administration.id, zoneId: zones.islamabad.id },
    }),
    rawalpindi: await prisma.office.create({
      data: { code: "RWP-ADM", name: "Administration Office Rawalpindi", wingId: wings.administration.id, zoneId: zones.islamabad.id },
    }),
    lahore: await prisma.office.create({
      data: { code: "LHE-IMM", name: "Immigration Circle Lahore", wingId: wings.immigration.id, zoneId: zones.punjab.id },
    }),
    faisalabad: await prisma.office.create({
      data: { code: "FSD-IMM", name: "Immigration Desk Faisalabad", wingId: wings.immigration.id, zoneId: zones.punjab.id },
    }),
    peshawar: await prisma.office.create({
      data: { code: "PEW-ACC", name: "Anti-Corruption Circle Peshawar", wingId: wings.antiCorruption.id, zoneId: zones.kpk.id },
    }),
    karachi: await prisma.office.create({
      data: { code: "KHI-CYB", name: "Cyber Crime Reporting Centre Karachi", wingId: wings.cyberCrime.id, zoneId: zones.sindh.id },
    }),
    hyderabad: await prisma.office.create({
      data: { code: "HYD-CYB", name: "Cyber Crime Desk Hyderabad", wingId: wings.cyberCrime.id, zoneId: zones.sindh.id },
    }),
  };

  // Internal-only seeded demo accounts used to exercise the FIA workflow chain.
  const users = {
    superAdmin: await createUser({
      username: "it.ops",
      email: "it.ops@fia.gov.pk",
      badgeNo: "FIA-OPS-0001",
      displayName: "Hamza Qureshi",
      mobileNumber: "0300-7000001",
      passwordHash,
      wingId: wings.administration.id,
      zoneId: zones.islamabad.id,
      officeId: offices.hq.id,
      roles: [
        { role: UserRole.SUPER_ADMIN, wingId: wings.administration.id, zoneId: zones.islamabad.id, officeId: offices.hq.id },
        { role: UserRole.IT_OPS, wingId: wings.administration.id, zoneId: zones.islamabad.id, officeId: offices.hq.id },
      ],
    }),
    clerkHq: await createUser({
      username: "zahid.ullah",
      email: "zahid.ullah@fia.gov.pk",
      badgeNo: "FIA-CLK-0101",
      displayName: "Zahid Ullah",
      mobileNumber: "0300-7001101",
      passwordHash,
      wingId: wings.administration.id,
      zoneId: zones.islamabad.id,
      officeId: offices.hq.id,
      roles: [{ role: UserRole.CLERK, wingId: wings.administration.id, zoneId: zones.islamabad.id, officeId: offices.hq.id }],
    }),
    clerkLahore: await createUser({
      username: "clerk.lhr",
      email: "clerk.lhr@fia.gov.pk",
      badgeNo: "FIA-CLK-0201",
      displayName: "Adnan Hussain",
      mobileNumber: "0300-7000201",
      passwordHash,
      wingId: wings.immigration.id,
      zoneId: zones.punjab.id,
      officeId: offices.lahore.id,
      roles: [{ role: UserRole.CLERK, wingId: wings.immigration.id, zoneId: zones.punjab.id, officeId: offices.lahore.id }],
    }),
    clerkPeshawar: await createUser({
      username: "clerk.psh",
      email: "clerk.psh@fia.gov.pk",
      badgeNo: "FIA-CLK-0301",
      displayName: "Waqas Ahmad",
      mobileNumber: "0300-7000301",
      passwordHash,
      wingId: wings.antiCorruption.id,
      zoneId: zones.kpk.id,
      officeId: offices.peshawar.id,
      roles: [{ role: UserRole.CLERK, wingId: wings.antiCorruption.id, zoneId: zones.kpk.id, officeId: offices.peshawar.id }],
    }),
    clerkKarachi: await createUser({
      username: "clerk.khi",
      email: "clerk.khi@fia.gov.pk",
      badgeNo: "FIA-CLK-0401",
      displayName: "Rimsha Khalid",
      mobileNumber: "0300-7000401",
      passwordHash,
      wingId: wings.cyberCrime.id,
      zoneId: zones.sindh.id,
      officeId: offices.karachi.id,
      roles: [{ role: UserRole.CLERK, wingId: wings.cyberCrime.id, zoneId: zones.sindh.id, officeId: offices.karachi.id }],
    }),
    reportingHq: await createUser({
      username: "muhammad.sarmad",
      email: "muhammad.sarmad@fia.gov.pk",
      badgeNo: "FIA-RO-1101",
      displayName: "Muhammad Sarmad",
      mobileNumber: "0300-7011101",
      passwordHash,
      wingId: wings.administration.id,
      zoneId: zones.islamabad.id,
      officeId: offices.hq.id,
      roles: [{ role: UserRole.REPORTING_OFFICER, wingId: wings.administration.id, zoneId: zones.islamabad.id, officeId: offices.hq.id }],
    }),
    reportingLahore: await createUser({
      username: "khalid.mehmood",
      email: "khalid.mehmood@fia.gov.pk",
      badgeNo: "FIA-RO-1201",
      displayName: "DSP Khalid Mehmood",
      mobileNumber: "0300-7011201",
      passwordHash,
      wingId: wings.immigration.id,
      zoneId: zones.punjab.id,
      officeId: offices.lahore.id,
      roles: [{ role: UserRole.REPORTING_OFFICER, wingId: wings.immigration.id, zoneId: zones.punjab.id, officeId: offices.lahore.id }],
    }),
    reportingPeshawar: await createUser({
      username: "kamran.ali",
      email: "kamran.ali@fia.gov.pk",
      badgeNo: "FIA-RO-1301",
      displayName: "DSP Kamran Ali",
      mobileNumber: "0300-7011301",
      passwordHash,
      wingId: wings.antiCorruption.id,
      zoneId: zones.kpk.id,
      officeId: offices.peshawar.id,
      roles: [{ role: UserRole.REPORTING_OFFICER, wingId: wings.antiCorruption.id, zoneId: zones.kpk.id, officeId: offices.peshawar.id }],
    }),
    reportingKarachi: await createUser({
      username: "zafar.iqbal",
      email: "zafar.iqbal@fia.gov.pk",
      badgeNo: "FIA-RO-1401",
      displayName: "DSP Zafar Iqbal",
      mobileNumber: "0300-7011401",
      passwordHash,
      wingId: wings.cyberCrime.id,
      zoneId: zones.sindh.id,
      officeId: offices.karachi.id,
      roles: [{ role: UserRole.REPORTING_OFFICER, wingId: wings.cyberCrime.id, zoneId: zones.sindh.id, officeId: offices.karachi.id }],
    }),
    countersigningHq: await createUser({
      username: "afzal.khan",
      email: "afzal.khan@fia.gov.pk",
      badgeNo: "FIA-CS-2101",
      displayName: "Afzal Khan SSP",
      mobileNumber: "0300-7022101",
      passwordHash,
      wingId: wings.administration.id,
      zoneId: zones.islamabad.id,
      officeId: offices.hq.id,
      roles: [{ role: UserRole.COUNTERSIGNING_OFFICER, wingId: wings.administration.id, zoneId: zones.islamabad.id, officeId: offices.hq.id }],
    }),
    countersigningLahore: await createUser({
      username: "anwar.haq",
      email: "anwar.haq@fia.gov.pk",
      badgeNo: "FIA-CS-2201",
      displayName: "SP Anwar Ul Haq",
      mobileNumber: "0300-7022201",
      passwordHash,
      wingId: wings.immigration.id,
      zoneId: zones.punjab.id,
      officeId: offices.lahore.id,
      roles: [{ role: UserRole.COUNTERSIGNING_OFFICER, wingId: wings.immigration.id, zoneId: zones.punjab.id, officeId: offices.lahore.id }],
    }),
    countersigningPeshawar: await createUser({
      username: "bashir.ahmad",
      email: "bashir.ahmad@fia.gov.pk",
      badgeNo: "FIA-CS-2301",
      displayName: "SP Bashir Ahmad",
      mobileNumber: "0300-7022301",
      passwordHash,
      wingId: wings.antiCorruption.id,
      zoneId: zones.kpk.id,
      officeId: offices.peshawar.id,
      roles: [{ role: UserRole.COUNTERSIGNING_OFFICER, wingId: wings.antiCorruption.id, zoneId: zones.kpk.id, officeId: offices.peshawar.id }],
    }),
    countersigningKarachi: await createUser({
      username: "rizwan.ahmed",
      email: "rizwan.ahmed@fia.gov.pk",
      badgeNo: "FIA-CS-2401",
      displayName: "SP Rizwan Ahmed",
      mobileNumber: "0300-7022401",
      passwordHash,
      wingId: wings.cyberCrime.id,
      zoneId: zones.sindh.id,
      officeId: offices.karachi.id,
      roles: [{ role: UserRole.COUNTERSIGNING_OFFICER, wingId: wings.cyberCrime.id, zoneId: zones.sindh.id, officeId: offices.karachi.id }],
    }),
    secretBranch: await createUser({
      username: "nazia.ambreen",
      email: "nazia.ambreen@fia.gov.pk",
      badgeNo: "FIA-SB-3101",
      displayName: "Nazia Ambreen",
      mobileNumber: "0300-7033101",
      passwordHash,
      wingId: wings.administration.id,
      zoneId: zones.islamabad.id,
      officeId: offices.secretBranch.id,
      roles: [{ role: UserRole.SECRET_BRANCH, wingId: wings.administration.id, zoneId: zones.islamabad.id, officeId: offices.secretBranch.id }],
    }),
    wingOversight: await createUser({
      username: "wing.oversight",
      email: "wing.oversight@fia.gov.pk",
      badgeNo: "FIA-WO-4101",
      displayName: "Ayesha Tariq",
      mobileNumber: "0300-7044101",
      passwordHash,
      wingId: wings.immigration.id,
      zoneId: zones.punjab.id,
      officeId: offices.lahore.id,
      roles: [{ role: UserRole.WING_OVERSIGHT, wingId: wings.immigration.id, zoneId: zones.punjab.id, officeId: offices.lahore.id }],
    }),
    zonalOversight: await createUser({
      username: "zonal.oversight",
      email: "zonal.oversight@fia.gov.pk",
      badgeNo: "FIA-ZO-4201",
      displayName: "Imran Nawaz",
      mobileNumber: "0300-7044201",
      passwordHash,
      wingId: wings.cyberCrime.id,
      zoneId: zones.sindh.id,
      officeId: offices.karachi.id,
      roles: [{ role: UserRole.ZONAL_OVERSIGHT, wingId: wings.cyberCrime.id, zoneId: zones.sindh.id, officeId: offices.karachi.id }],
    }),
    dgViewer: await createUser({
      username: "dr.anwar.saleem",
      email: "dr.anwar.saleem@fia.gov.pk",
      badgeNo: "FIA-DG-5101",
      displayName: "Dr Anwar Saleem",
      mobileNumber: "0300-7055101",
      passwordHash,
      wingId: wings.administration.id,
      zoneId: zones.islamabad.id,
      officeId: offices.hq.id,
      roles: [
        { role: UserRole.DG, wingId: wings.administration.id, zoneId: zones.islamabad.id, officeId: offices.hq.id },
        { role: UserRole.EXECUTIVE_VIEWER, wingId: wings.administration.id, zoneId: zones.islamabad.id, officeId: offices.hq.id },
      ],
    }),
    employeeFatima: await createUser({
      username: "fatima.employee",
      email: "fatima.zahra.employee@fia.gov.pk",
      badgeNo: "FIA-EMP-6101",
      displayName: "Fatima Zahra",
      mobileNumber: "0345-3333333",
      passwordHash,
      wingId: wings.administration.id,
      zoneId: zones.islamabad.id,
      officeId: offices.hq.id,
      roles: [{ role: UserRole.EMPLOYEE, wingId: wings.administration.id, zoneId: zones.islamabad.id, officeId: offices.hq.id }],
    }),
    employeeAsma: await createUser({
      username: "asma.employee",
      email: "asma.bibi.employee@fia.gov.pk",
      badgeNo: "FIA-EMP-6201",
      displayName: "Asma Bibi",
      mobileNumber: "0300-9876543",
      passwordHash,
      wingId: wings.antiCorruption.id,
      zoneId: zones.kpk.id,
      officeId: offices.peshawar.id,
      roles: [{ role: UserRole.EMPLOYEE, wingId: wings.antiCorruption.id, zoneId: zones.kpk.id, officeId: offices.peshawar.id }],
    }),
  };

  const templates = {
    assistantLegacy: await prisma.templateVersion.create({ data: { family: TemplateFamilyCode.ASSISTANT_UDC_LDC, code: "S-121-C-2025", version: "2025.2", title: "Confidential Report Form for Assistants / UDC / LDC", languageMode: LanguageMode.ENGLISH, requiresCountersigning: true, pageCount: 4, isActive: false } }),
    assistantCurrent: await prisma.templateVersion.create({ data: { family: TemplateFamilyCode.ASSISTANT_UDC_LDC, code: "S-121-C-2026", version: "2026.1", title: "Confidential Report Form for Assistants / UDC / LDC", languageMode: LanguageMode.ENGLISH, requiresCountersigning: true, pageCount: 4 } }),
    apsLegacy: await prisma.templateVersion.create({ data: { family: TemplateFamilyCode.APS_STENOTYPIST, code: "S-121-E-2025", version: "2025.2", title: "Annual Restricted Report Form for APS / Stenotypist", languageMode: LanguageMode.BILINGUAL, requiresCountersigning: false, pageCount: 8, isActive: false } }),
    apsCurrent: await prisma.templateVersion.create({ data: { family: TemplateFamilyCode.APS_STENOTYPIST, code: "S-121-E-2026", version: "2026.1", title: "Annual Restricted Report Form for APS / Stenotypist", languageMode: LanguageMode.BILINGUAL, requiresCountersigning: false, pageCount: 8 } }),
    inspectorLegacy: await prisma.templateVersion.create({ data: { family: TemplateFamilyCode.INSPECTOR_SI_ASI, code: "FIA-INS-2025", version: "2025.4", title: "Annual Confidential Report for Inspector / Inspector Legal / SI / ASI", languageMode: LanguageMode.ENGLISH, requiresCountersigning: true, pageCount: 6, isActive: false } }),
    inspectorCurrent: await prisma.templateVersion.create({ data: { family: TemplateFamilyCode.INSPECTOR_SI_ASI, code: "FIA-INS-2026", version: "2026.1", title: "Annual Confidential Report for Inspector / Inspector Legal / SI / ASI", languageMode: LanguageMode.ENGLISH, requiresCountersigning: true, pageCount: 6 } }),
    superintendentLegacy: await prisma.templateVersion.create({ data: { family: TemplateFamilyCode.SUPERINTENDENT_AINCHARGE, code: "S-121-B-2025", version: "2025.2", title: "Annual Restricted Report Form for Superintendent / Assistant Incharge", languageMode: LanguageMode.BILINGUAL, requiresCountersigning: true, pageCount: 4, isActive: false } }),
    superintendentCurrent: await prisma.templateVersion.create({ data: { family: TemplateFamilyCode.SUPERINTENDENT_AINCHARGE, code: "S-121-B-2026", version: "2026.1", title: "Annual Restricted Report Form for Superintendent / Assistant Incharge", languageMode: LanguageMode.BILINGUAL, requiresCountersigning: true, pageCount: 4 } }),
  };

  async function createEmployee(data: {
    userId?: string | null;
    serviceNumber: string;
    name: string;
    rank: string;
    designation: string;
    bps: number;
    cnic: string;
    mobile: string;
    email: string;
    posting: string;
    joiningDate: Date;
    address: string;
    templateFamily: TemplateFamilyCode;
    wingId: string;
    zoneId: string;
    officeId: string;
    reportingOfficerId?: string | null;
    countersigningOfficerId?: string | null;
  }) {
    return prisma.employee.create({
      data: {
        ...data,
        userId: data.userId ?? null,
        reportingOfficerId: data.reportingOfficerId ?? null,
        countersigningOfficerId: data.countersigningOfficerId ?? null,
        serviceYears: calculateServiceYears(data.joiningDate),
      },
    });
  }

  const employees = {
    fatima: await createEmployee({ userId: users.employeeFatima.id, serviceNumber: "EMP-1001", name: "Fatima Zahra", rank: "Upper Division Clerk", designation: "UDC", bps: 9, cnic: "61101-3333333-2", mobile: "0345-3333333", email: "fatima.zahra@fia.gov.pk", posting: "Records Section", joiningDate: fixedDate("2020-02-10"), address: "House 22, Jinnah Avenue, Islamabad", templateFamily: TemplateFamilyCode.ASSISTANT_UDC_LDC, wingId: wings.administration.id, zoneId: zones.islamabad.id, officeId: offices.hq.id, reportingOfficerId: users.reportingHq.id, countersigningOfficerId: users.countersigningHq.id }),
    abdul: await createEmployee({ serviceNumber: "EMP-1002", name: "Abdul Rehman Siddiqui", rank: "Superintendent", designation: "Superintendent", bps: 16, cnic: "35301-7777777-9", mobile: "0311-7777777", email: "abdul.rehman@fia.gov.pk", posting: "Administration Superintendent", joiningDate: fixedDate("2008-11-05"), address: "Street 9, Satellite Town, Rawalpindi", templateFamily: TemplateFamilyCode.SUPERINTENDENT_AINCHARGE, wingId: wings.administration.id, zoneId: zones.islamabad.id, officeId: offices.rawalpindi.id, reportingOfficerId: users.reportingHq.id, countersigningOfficerId: users.countersigningHq.id }),
    bilal: await createEmployee({ serviceNumber: "EMP-1003", name: "Bilal Hassan", rank: "Assistant", designation: "Assistant", bps: 15, cnic: "37405-2456789-4", mobile: "0307-1122334", email: "bilal.hassan@fia.gov.pk", posting: "General Administration Desk", joiningDate: fixedDate("2017-04-19"), address: "Gulraiz Housing Scheme, Rawalpindi", templateFamily: TemplateFamilyCode.ASSISTANT_UDC_LDC, wingId: wings.administration.id, zoneId: zones.islamabad.id, officeId: offices.rawalpindi.id, reportingOfficerId: users.reportingHq.id, countersigningOfficerId: users.countersigningHq.id }),
    tariq: await createEmployee({ serviceNumber: "EMP-1004", name: "Muhammad Tariq Malik", rank: "Sub Inspector", designation: "Immigration Officer", bps: 14, cnic: "35202-1234567-1", mobile: "0321-4567890", email: "m.tariq@fia.gov.pk", posting: "Immigration Desk Officer", joiningDate: fixedDate("2015-03-15"), address: "House 12, Street 4, Gulberg III, Lahore", templateFamily: TemplateFamilyCode.INSPECTOR_SI_ASI, wingId: wings.immigration.id, zoneId: zones.punjab.id, officeId: offices.lahore.id, reportingOfficerId: users.reportingLahore.id, countersigningOfficerId: users.countersigningLahore.id }),
    naila: await createEmployee({ serviceNumber: "EMP-1005", name: "Naila Yasmin", rank: "Lower Division Clerk", designation: "LDC", bps: 7, cnic: "33100-1111111-8", mobile: "0301-4443322", email: "naila.yasmin@fia.gov.pk", posting: "Counter Support Desk", joiningDate: fixedDate("2019-09-02"), address: "Madina Town, Faisalabad", templateFamily: TemplateFamilyCode.ASSISTANT_UDC_LDC, wingId: wings.immigration.id, zoneId: zones.punjab.id, officeId: offices.faisalabad.id, reportingOfficerId: users.reportingLahore.id, countersigningOfficerId: users.countersigningLahore.id }),
    imran: await createEmployee({ serviceNumber: "EMP-1006", name: "Imran Saeed", rank: "Assistant", designation: "Assistant", bps: 15, cnic: "35201-9876543-5", mobile: "0312-9988776", email: "imran.saeed@fia.gov.pk", posting: "Immigration Records Review", joiningDate: fixedDate("2016-01-12"), address: "Johar Town, Lahore", templateFamily: TemplateFamilyCode.ASSISTANT_UDC_LDC, wingId: wings.immigration.id, zoneId: zones.punjab.id, officeId: offices.lahore.id, reportingOfficerId: users.reportingLahore.id, countersigningOfficerId: users.countersigningLahore.id }),
    asma: await createEmployee({ userId: users.employeeAsma.id, serviceNumber: "EMP-1007", name: "Asma Bibi", rank: "Assistant Private Secretary", designation: "APS", bps: 14, cnic: "37405-9876543-0", mobile: "0300-9876543", email: "asma.bibi@fia.gov.pk", posting: "APS to Zonal Director", joiningDate: fixedDate("2018-06-01"), address: "Plot 45, Hayatabad Phase 2, Peshawar", templateFamily: TemplateFamilyCode.APS_STENOTYPIST, wingId: wings.antiCorruption.id, zoneId: zones.kpk.id, officeId: offices.peshawar.id, reportingOfficerId: users.reportingPeshawar.id }),
    yasir: await createEmployee({ serviceNumber: "EMP-1008", name: "Yasir Mehmood", rank: "Assistant Sub Inspector", designation: "Investigation Officer", bps: 11, cnic: "17301-1234432-6", mobile: "0336-7788990", email: "yasir.mehmood@fia.gov.pk", posting: "Inquiry & Vigilance Desk", joiningDate: fixedDate("2014-10-20"), address: "University Road, Peshawar", templateFamily: TemplateFamilyCode.INSPECTOR_SI_ASI, wingId: wings.antiCorruption.id, zoneId: zones.kpk.id, officeId: offices.peshawar.id, reportingOfficerId: users.reportingPeshawar.id, countersigningOfficerId: users.countersigningPeshawar.id }),
    rashid: await createEmployee({ serviceNumber: "EMP-1009", name: "Rashid Ali Khan", rank: "Inspector", designation: "Cybercrime Inspector", bps: 16, cnic: "42201-5555555-3", mobile: "0333-5555555", email: "rashid.khan@fia.gov.pk", posting: "Digital Forensics Officer", joiningDate: fixedDate("2010-09-20"), address: "Block C, Clifton, Karachi", templateFamily: TemplateFamilyCode.INSPECTOR_SI_ASI, wingId: wings.cyberCrime.id, zoneId: zones.sindh.id, officeId: offices.karachi.id, reportingOfficerId: users.reportingKarachi.id, countersigningOfficerId: users.countersigningKarachi.id }),
    hina: await createEmployee({ serviceNumber: "EMP-1010", name: "Hina Noor", rank: "Stenotypist", designation: "Stenotypist", bps: 14, cnic: "42101-7654321-0", mobile: "0315-1212121", email: "hina.noor@fia.gov.pk", posting: "Case Documentation Cell", joiningDate: fixedDate("2021-08-14"), address: "Qasimabad, Hyderabad", templateFamily: TemplateFamilyCode.APS_STENOTYPIST, wingId: wings.cyberCrime.id, zoneId: zones.sindh.id, officeId: offices.hyderabad.id, reportingOfficerId: users.reportingKarachi.id }),
    javed: await createEmployee({ serviceNumber: "EMP-1011", name: "Javed Iqbal", rank: "Assistant Incharge", designation: "Assistant Incharge", bps: 16, cnic: "42101-9988776-5", mobile: "0348-5566778", email: "javed.iqbal@fia.gov.pk", posting: "Cyber Operations Supervisor", joiningDate: fixedDate("2012-02-28"), address: "Scheme 33, Karachi", templateFamily: TemplateFamilyCode.SUPERINTENDENT_AINCHARGE, wingId: wings.cyberCrime.id, zoneId: zones.sindh.id, officeId: offices.karachi.id, reportingOfficerId: users.reportingKarachi.id, countersigningOfficerId: users.countersigningKarachi.id }),
  };

  async function createAcr(data: { acrNo: string; employeeId: string; initiatedById: string; reportingOfficerId: string; countersigningOfficerId?: string | null; currentHolderId?: string | null; templateVersionId: string; workflowState: AcrWorkflowState; statusLabel: string; reportingPeriodFrom: Date; reportingPeriodTo: Date; dueDate: Date; createdAt: Date; completedDate?: Date | null; archivedAt?: Date | null; isPriority?: boolean; correctionRemarks?: string | null; performanceScore?: number | null; formData?: unknown; }) {
    return prisma.acrRecord.create({
      data: {
        ...data,
        countersigningOfficerId: data.countersigningOfficerId ?? null,
        currentHolderId: data.currentHolderId ?? null,
        completedDate: data.completedDate ?? null,
        archivedAt: data.archivedAt ?? null,
        isPriority: data.isPriority ?? false,
        correctionRemarks: data.correctionRemarks ?? null,
        performanceScore: data.performanceScore ?? null,
      } as never,
    });
  }

  const acrs = {
    draftBilal: await createAcr({ acrNo: `FIA/ACR/${currentFiscal.label}/ADM/001`, employeeId: employees.bilal.id, initiatedById: users.clerkHq.id, reportingOfficerId: users.reportingHq.id, countersigningOfficerId: users.countersigningHq.id, currentHolderId: users.clerkHq.id, templateVersionId: templates.assistantCurrent.id, workflowState: AcrWorkflowState.DRAFT, statusLabel: "Draft", reportingPeriodFrom: currentFiscal.from, reportingPeriodTo: currentFiscal.to, dueDate: dateFromNow(7), createdAt: dateFromNow(-2), formData: { sectionA: { integrity: "Good", punctuality: "Very Good" } } }),
    draftImran: await createAcr({ acrNo: `FIA/ACR/${currentFiscal.label}/IMM/002`, employeeId: employees.imran.id, initiatedById: users.clerkLahore.id, reportingOfficerId: users.reportingLahore.id, countersigningOfficerId: users.countersigningLahore.id, currentHolderId: users.clerkLahore.id, templateVersionId: templates.assistantCurrent.id, workflowState: AcrWorkflowState.DRAFT, statusLabel: "Draft", reportingPeriodFrom: currentFiscal.from, reportingPeriodTo: currentFiscal.to, dueDate: dateFromNow(10), createdAt: dateFromNow(-1), formData: { sectionA: { discipline: "Draft saved for verification" } } }),
    pendingReportingTariq: await createAcr({ acrNo: `FIA/ACR/${currentFiscal.label}/IMM/014`, employeeId: employees.tariq.id, initiatedById: users.clerkLahore.id, reportingOfficerId: users.reportingLahore.id, countersigningOfficerId: users.countersigningLahore.id, currentHolderId: users.reportingLahore.id, templateVersionId: templates.inspectorCurrent.id, workflowState: AcrWorkflowState.PENDING_REPORTING, statusLabel: "Pending Reporting Officer", reportingPeriodFrom: currentFiscal.from, reportingPeriodTo: currentFiscal.to, dueDate: dateFromNow(3), createdAt: dateFromNow(-7), isPriority: true, formData: { stage: "reporting", narrative: "Priority immigration desk performance case." } }),
    overdueReportingRashid: await createAcr({ acrNo: `FIA/ACR/${currentFiscal.label}/CYB/021`, employeeId: employees.rashid.id, initiatedById: users.clerkKarachi.id, reportingOfficerId: users.reportingKarachi.id, countersigningOfficerId: users.countersigningKarachi.id, currentHolderId: users.reportingKarachi.id, templateVersionId: templates.inspectorCurrent.id, workflowState: AcrWorkflowState.PENDING_REPORTING, statusLabel: "Pending Reporting Officer", reportingPeriodFrom: currentFiscal.from, reportingPeriodTo: currentFiscal.to, dueDate: dateFromNow(-6), createdAt: dateFromNow(-16), formData: { stage: "reporting", risk: "Overdue due to pending supporting note." } }),
    apsPendingAsma: await createAcr({ acrNo: `FIA/ACR/${currentFiscal.label}/ACC/009`, employeeId: employees.asma.id, initiatedById: users.clerkPeshawar.id, reportingOfficerId: users.reportingPeshawar.id, currentHolderId: users.reportingPeshawar.id, templateVersionId: templates.apsCurrent.id, workflowState: AcrWorkflowState.PENDING_REPORTING, statusLabel: "Pending Reporting Officer", reportingPeriodFrom: currentFiscal.from, reportingPeriodTo: currentFiscal.to, dueDate: dateFromNow(2), createdAt: dateFromNow(-5), performanceScore: 78, formData: { stage: "reporting", shorthandSpeed: "Excellent" } }),
    pendingCountersigningAbdul: await createAcr({ acrNo: `FIA/ACR/${currentFiscal.label}/ADM/028`, employeeId: employees.abdul.id, initiatedById: users.clerkHq.id, reportingOfficerId: users.reportingHq.id, countersigningOfficerId: users.countersigningHq.id, currentHolderId: users.countersigningHq.id, templateVersionId: templates.superintendentCurrent.id, workflowState: AcrWorkflowState.PENDING_COUNTERSIGNING, statusLabel: "Pending Countersigning", reportingPeriodFrom: currentFiscal.from, reportingPeriodTo: currentFiscal.to, dueDate: dateFromNow(4), createdAt: dateFromNow(-12), isPriority: true, performanceScore: 89, formData: { stage: "countersigning", remarks: "Ready for countersignature review." } }),
    submittedSecretFatima: await createAcr({ acrNo: `FIA/ACR/${currentFiscal.label}/ADM/030`, employeeId: employees.fatima.id, initiatedById: users.clerkHq.id, reportingOfficerId: users.reportingHq.id, countersigningOfficerId: users.countersigningHq.id, currentHolderId: users.secretBranch.id, templateVersionId: templates.assistantCurrent.id, workflowState: AcrWorkflowState.SUBMITTED_TO_SECRET_BRANCH, statusLabel: "Submitted to Secret Branch", reportingPeriodFrom: currentFiscal.from, reportingPeriodTo: currentFiscal.to, dueDate: dateFromNow(1), createdAt: dateFromNow(-15), performanceScore: 91, formData: { stage: "secret_branch", summary: "Final packet forwarded to archive desk." } }),
    returnedHina: await createAcr({ acrNo: `FIA/ACR/${currentFiscal.label}/CYB/018`, employeeId: employees.hina.id, initiatedById: users.clerkKarachi.id, reportingOfficerId: users.reportingKarachi.id, currentHolderId: users.clerkKarachi.id, templateVersionId: templates.apsCurrent.id, workflowState: AcrWorkflowState.RETURNED, statusLabel: "Returned", reportingPeriodFrom: currentFiscal.from, reportingPeriodTo: currentFiscal.to, dueDate: dateFromNow(-3), createdAt: dateFromNow(-20), correctionRemarks: "Posting history and bilingual remarks section need correction before resubmission.", formData: { stage: "returned", issue: "Posting history mismatch." } }),
    pendingCountersigningJaved: await createAcr({ acrNo: `FIA/ACR/${currentFiscal.label}/CYB/022`, employeeId: employees.javed.id, initiatedById: users.clerkKarachi.id, reportingOfficerId: users.reportingKarachi.id, countersigningOfficerId: users.countersigningKarachi.id, currentHolderId: users.countersigningKarachi.id, templateVersionId: templates.superintendentCurrent.id, workflowState: AcrWorkflowState.PENDING_COUNTERSIGNING, statusLabel: "Pending Countersigning", reportingPeriodFrom: currentFiscal.from, reportingPeriodTo: currentFiscal.to, dueDate: dateFromNow(1), createdAt: dateFromNow(-9), isPriority: true, performanceScore: 87, formData: { stage: "countersigning", note: "Priority cyber operations leadership case." } }),
    archivedYasirCurrent: await createAcr({ acrNo: `FIA/ACR/${currentFiscal.label}/ACC/004`, employeeId: employees.yasir.id, initiatedById: users.clerkPeshawar.id, reportingOfficerId: users.reportingPeshawar.id, countersigningOfficerId: users.countersigningPeshawar.id, currentHolderId: users.secretBranch.id, templateVersionId: templates.inspectorCurrent.id, workflowState: AcrWorkflowState.ARCHIVED, statusLabel: "Archived", reportingPeriodFrom: currentFiscal.from, reportingPeriodTo: currentFiscal.to, dueDate: dateFromNow(-20), createdAt: dateFromNow(-35), completedDate: dateFromNow(-10), archivedAt: dateFromNow(-10), performanceScore: 86, formData: { final: true, summary: "Archived current fiscal ASI record." } }),
    archivedNailaPrevious: await createAcr({ acrNo: `FIA/ACR/${previousFiscal.label}/IMM/077`, employeeId: employees.naila.id, initiatedById: users.clerkLahore.id, reportingOfficerId: users.reportingLahore.id, countersigningOfficerId: users.countersigningLahore.id, currentHolderId: users.secretBranch.id, templateVersionId: templates.assistantLegacy.id, workflowState: AcrWorkflowState.ARCHIVED, statusLabel: "Archived", reportingPeriodFrom: previousFiscal.from, reportingPeriodTo: previousFiscal.to, dueDate: dateFromNow(-210), createdAt: dateFromNow(-250), completedDate: dateFromNow(-205), archivedAt: dateFromNow(-205), performanceScore: 90, formData: { legacyTemplate: true, summary: "Archived LDC record from previous fiscal cycle." } }),
    archivedRashidPrevious: await createAcr({ acrNo: `FIA/ACR/${previousFiscal.label}/CYB/054`, employeeId: employees.rashid.id, initiatedById: users.clerkKarachi.id, reportingOfficerId: users.reportingKarachi.id, countersigningOfficerId: users.countersigningKarachi.id, currentHolderId: users.secretBranch.id, templateVersionId: templates.inspectorLegacy.id, workflowState: AcrWorkflowState.ARCHIVED, statusLabel: "Archived", reportingPeriodFrom: previousFiscal.from, reportingPeriodTo: previousFiscal.to, dueDate: dateFromNow(-185), createdAt: dateFromNow(-215), completedDate: dateFromNow(-175), archivedAt: dateFromNow(-175), performanceScore: 88, formData: { legacyTemplate: true, summary: "Archived cybercrime inspector record." } }),
    archivedAsmaPrevious: await createAcr({ acrNo: `FIA/ACR/${previousFiscal.label}/ACC/043`, employeeId: employees.asma.id, initiatedById: users.clerkPeshawar.id, reportingOfficerId: users.reportingPeshawar.id, currentHolderId: users.secretBranch.id, templateVersionId: templates.apsLegacy.id, workflowState: AcrWorkflowState.ARCHIVED, statusLabel: "Archived", reportingPeriodFrom: previousFiscal.from, reportingPeriodTo: previousFiscal.to, dueDate: dateFromNow(-195), createdAt: dateFromNow(-230), completedDate: dateFromNow(-188), archivedAt: dateFromNow(-188), performanceScore: 84, formData: { legacyTemplate: true, apsFlow: true, summary: "APS record archived without countersigning stage." } }),
  };

  await prisma.acrTimelineEntry.createMany({
    data: [
      timelineSeed(acrs.draftBilal.id, users.clerkHq.id, "Clerk", "Draft Created", "completed", shiftDate(acrs.draftBilal.createdAt, 0, 1)),
      timelineSeed(acrs.draftImran.id, users.clerkLahore.id, "Clerk", "Draft Created", "completed", shiftDate(acrs.draftImran.createdAt, 0, 1)),

      timelineSeed(acrs.pendingReportingTariq.id, users.clerkLahore.id, "Clerk", "Draft Created", "completed", shiftDate(acrs.pendingReportingTariq.createdAt, 0, 1)),
      timelineSeed(acrs.pendingReportingTariq.id, users.clerkLahore.id, "Clerk", "Submitted to Reporting Officer", "completed", shiftDate(acrs.pendingReportingTariq.createdAt, 0, 4)),
      timelineSeed(acrs.pendingReportingTariq.id, users.reportingLahore.id, "Reporting Officer", "Under Review", "active", shiftDate(acrs.pendingReportingTariq.createdAt, 1, 2), "Priority ACR under active review."),

      timelineSeed(acrs.overdueReportingRashid.id, users.clerkKarachi.id, "Clerk", "Draft Created", "completed", shiftDate(acrs.overdueReportingRashid.createdAt, 0, 1)),
      timelineSeed(acrs.overdueReportingRashid.id, users.clerkKarachi.id, "Clerk", "Submitted to Reporting Officer", "completed", shiftDate(acrs.overdueReportingRashid.createdAt, 0, 5)),
      timelineSeed(acrs.overdueReportingRashid.id, users.reportingKarachi.id, "Reporting Officer", "Pending Review", "active", shiftDate(acrs.overdueReportingRashid.createdAt, 1, 1), "Supporting documents awaited from reporting section."),

      timelineSeed(acrs.apsPendingAsma.id, users.clerkPeshawar.id, "Clerk", "Draft Created", "completed", shiftDate(acrs.apsPendingAsma.createdAt, 0, 1)),
      timelineSeed(acrs.apsPendingAsma.id, users.clerkPeshawar.id, "Clerk", "Submitted to Reporting Officer", "completed", shiftDate(acrs.apsPendingAsma.createdAt, 0, 4)),
      timelineSeed(acrs.apsPendingAsma.id, users.reportingPeshawar.id, "Reporting Officer", "Remarks in Progress", "active", shiftDate(acrs.apsPendingAsma.createdAt, 1, 2), "APS flow will go directly to Secret Branch after reporting review."),

      timelineSeed(acrs.pendingCountersigningAbdul.id, users.clerkHq.id, "Clerk", "Draft Created", "completed", shiftDate(acrs.pendingCountersigningAbdul.createdAt, 0, 1)),
      timelineSeed(acrs.pendingCountersigningAbdul.id, users.clerkHq.id, "Clerk", "Submitted to Reporting Officer", "completed", shiftDate(acrs.pendingCountersigningAbdul.createdAt, 0, 3)),
      timelineSeed(acrs.pendingCountersigningAbdul.id, users.reportingHq.id, "Reporting Officer", "Forwarded to Countersigning", "completed", shiftDate(acrs.pendingCountersigningAbdul.createdAt, 2, 2), "Reporting review completed with positive remarks."),
      timelineSeed(acrs.pendingCountersigningAbdul.id, users.countersigningHq.id, "Countersigning Officer", "Countersigning Review", "active", shiftDate(acrs.pendingCountersigningAbdul.createdAt, 3, 1)),

      timelineSeed(acrs.submittedSecretFatima.id, users.clerkHq.id, "Clerk", "Draft Created", "completed", shiftDate(acrs.submittedSecretFatima.createdAt, 0, 1)),
      timelineSeed(acrs.submittedSecretFatima.id, users.clerkHq.id, "Clerk", "Submitted to Reporting Officer", "completed", shiftDate(acrs.submittedSecretFatima.createdAt, 0, 4)),
      timelineSeed(acrs.submittedSecretFatima.id, users.reportingHq.id, "Reporting Officer", "Forwarded to Countersigning", "completed", shiftDate(acrs.submittedSecretFatima.createdAt, 1, 3)),
      timelineSeed(acrs.submittedSecretFatima.id, users.countersigningHq.id, "Countersigning Officer", "Submitted to Secret Branch", "completed", shiftDate(acrs.submittedSecretFatima.createdAt, 2, 4)),
      timelineSeed(acrs.submittedSecretFatima.id, users.secretBranch.id, "Secret Branch", "Ready for Archive", "pending", shiftDate(acrs.submittedSecretFatima.createdAt, 3, 1)),

      timelineSeed(acrs.returnedHina.id, users.clerkKarachi.id, "Clerk", "Draft Created", "completed", shiftDate(acrs.returnedHina.createdAt, 0, 1)),
      timelineSeed(acrs.returnedHina.id, users.clerkKarachi.id, "Clerk", "Submitted to Reporting Officer", "completed", shiftDate(acrs.returnedHina.createdAt, 0, 3)),
      timelineSeed(acrs.returnedHina.id, users.reportingKarachi.id, "Reporting Officer", "Returned to Clerk", "returned", shiftDate(acrs.returnedHina.createdAt, 1, 2), acrs.returnedHina.correctionRemarks ?? undefined),

      timelineSeed(acrs.pendingCountersigningJaved.id, users.clerkKarachi.id, "Clerk", "Draft Created", "completed", shiftDate(acrs.pendingCountersigningJaved.createdAt, 0, 1)),
      timelineSeed(acrs.pendingCountersigningJaved.id, users.clerkKarachi.id, "Clerk", "Submitted to Reporting Officer", "completed", shiftDate(acrs.pendingCountersigningJaved.createdAt, 0, 4)),
      timelineSeed(acrs.pendingCountersigningJaved.id, users.reportingKarachi.id, "Reporting Officer", "Forwarded to Countersigning", "completed", shiftDate(acrs.pendingCountersigningJaved.createdAt, 2, 0)),
      timelineSeed(acrs.pendingCountersigningJaved.id, users.countersigningKarachi.id, "Countersigning Officer", "Countersigning Review", "active", shiftDate(acrs.pendingCountersigningJaved.createdAt, 3, 2), "Priority countersigning queue item."),

      timelineSeed(acrs.archivedYasirCurrent.id, users.clerkPeshawar.id, "Clerk", "Draft Created", "completed", shiftDate(acrs.archivedYasirCurrent.createdAt, 0, 1)),
      timelineSeed(acrs.archivedYasirCurrent.id, users.reportingPeshawar.id, "Reporting Officer", "Forwarded to Countersigning", "completed", shiftDate(acrs.archivedYasirCurrent.createdAt, 2, 1)),
      timelineSeed(acrs.archivedYasirCurrent.id, users.countersigningPeshawar.id, "Countersigning Officer", "Submitted to Secret Branch", "completed", shiftDate(acrs.archivedYasirCurrent.createdAt, 4, 2)),
      timelineSeed(acrs.archivedYasirCurrent.id, users.secretBranch.id, "Secret Branch", "Archived", "completed", acrs.archivedYasirCurrent.archivedAt ?? shiftDate(acrs.archivedYasirCurrent.createdAt, 6, 0)),

      timelineSeed(acrs.archivedNailaPrevious.id, users.clerkLahore.id, "Clerk", "Draft Created", "completed", shiftDate(acrs.archivedNailaPrevious.createdAt, 0, 1)),
      timelineSeed(acrs.archivedNailaPrevious.id, users.reportingLahore.id, "Reporting Officer", "Forwarded to Countersigning", "completed", shiftDate(acrs.archivedNailaPrevious.createdAt, 3, 2)),
      timelineSeed(acrs.archivedNailaPrevious.id, users.secretBranch.id, "Secret Branch", "Archived", "completed", acrs.archivedNailaPrevious.archivedAt ?? shiftDate(acrs.archivedNailaPrevious.createdAt, 6, 0)),

      timelineSeed(acrs.archivedRashidPrevious.id, users.clerkKarachi.id, "Clerk", "Draft Created", "completed", shiftDate(acrs.archivedRashidPrevious.createdAt, 0, 1)),
      timelineSeed(acrs.archivedRashidPrevious.id, users.reportingKarachi.id, "Reporting Officer", "Forwarded to Countersigning", "completed", shiftDate(acrs.archivedRashidPrevious.createdAt, 2, 2)),
      timelineSeed(acrs.archivedRashidPrevious.id, users.secretBranch.id, "Secret Branch", "Archived", "completed", acrs.archivedRashidPrevious.archivedAt ?? shiftDate(acrs.archivedRashidPrevious.createdAt, 5, 0)),

      timelineSeed(acrs.archivedAsmaPrevious.id, users.clerkPeshawar.id, "Clerk", "Draft Created", "completed", shiftDate(acrs.archivedAsmaPrevious.createdAt, 0, 1)),
      timelineSeed(acrs.archivedAsmaPrevious.id, users.reportingPeshawar.id, "Reporting Officer", "Submitted to Secret Branch", "completed", shiftDate(acrs.archivedAsmaPrevious.createdAt, 2, 1), "APS path completed without countersigning."),
      timelineSeed(acrs.archivedAsmaPrevious.id, users.secretBranch.id, "Secret Branch", "Archived", "completed", acrs.archivedAsmaPrevious.archivedAt ?? shiftDate(acrs.archivedAsmaPrevious.createdAt, 3, 0)),
    ],
  });

  await prisma.auditLog.createMany({
    data: [
      auditSeed(users.superAdmin.id, "Super Admin", "Login", dateFromNow(-1, 8), "Super admin signed in for configuration review."),
      auditSeed(users.superAdmin.id, "IT Ops", "Admin Configuration Change", dateFromNow(-1, 9), "Updated due-day thresholds for current appraisal cycle."),
      auditSeed(users.superAdmin.id, "IT Ops", "Template Version Change", dateFromNow(-8, 10), "Published 2026.1 active template versions for all four families."),
      auditSeed(users.superAdmin.id, "Super Admin", "Hierarchy Override", dateFromNow(-6, 11), "Reviewed temporary reporting chain override for Cyber Crime Desk Hyderabad."),
      auditSeed(users.clerkHq.id, "Clerk", "ACR Created", shiftDate(acrs.draftBilal.createdAt, 0, 1), "Created draft ACR for Bilal Hassan.", acrs.draftBilal.id),
      auditSeed(users.clerkLahore.id, "Clerk", "Draft Save", shiftDate(acrs.draftImran.createdAt, 0, 1), "Saved draft for Imran Saeed pending employee verification.", acrs.draftImran.id),
      auditSeed(users.clerkLahore.id, "Clerk", "Submit", shiftDate(acrs.pendingReportingTariq.createdAt, 0, 4), "Submitted Tariq Malik ACR to Reporting Officer.", acrs.pendingReportingTariq.id),
      auditSeed(users.reportingKarachi.id, "Reporting Officer", "Return", shiftDate(acrs.returnedHina.createdAt, 1, 2), "Returned Hina Noor record for correction.", acrs.returnedHina.id),
      auditSeed(users.reportingHq.id, "Reporting Officer", "Sign", shiftDate(acrs.pendingCountersigningAbdul.createdAt, 2, 2), "Reporting remarks signed for Abdul Rehman Siddiqui.", acrs.pendingCountersigningAbdul.id),
      auditSeed(users.countersigningHq.id, "Countersigning Officer", "Countersign", dateFromNow(-4, 15), "Countersigning remarks completed for Fatima Zahra packet before Secret Branch submission.", acrs.submittedSecretFatima.id),
      auditSeed(users.secretBranch.id, "Secret Branch", "Archive", acrs.archivedYasirCurrent.archivedAt ?? dateFromNow(-10, 9), "Archived authoritative PDF for Yasir Mehmood.", acrs.archivedYasirCurrent.id),
      auditSeed(users.secretBranch.id, "Secret Branch", "Export / Download", dateFromNow(-3, 14), "Downloaded archived record for internal review board.", acrs.archivedNailaPrevious.id),
      auditSeed(users.dgViewer.id, "DG", "Leadership Dashboard View", dateFromNow(-2, 10), "Opened leadership analytics dashboard for wing-wise trend review."),
      auditSeed(null, "System", "Failed Auth", dateFromNow(-1, 7), "Invalid password attempt blocked for username 'zahid.ullah@fia.gov.pk'."),
    ],
  });

  await prisma.notification.createMany({
    data: [
      { userId: users.clerkHq.id, acrRecordId: acrs.submittedSecretFatima.id, type: NotificationType.success, title: "Secret Branch Received", message: "Fatima Zahra's ACR packet has been received by Secret Branch and is pending archive closure.", createdAt: dateFromNow(-1, 11) },
      { userId: users.reportingLahore.id, acrRecordId: acrs.pendingReportingTariq.id, type: NotificationType.info, title: "Priority ACR Awaiting Review", message: "Priority ACR for Muhammad Tariq Malik is assigned to your queue.", createdAt: dateFromNow(-1, 10) },
      { userId: users.reportingKarachi.id, acrRecordId: acrs.overdueReportingRashid.id, type: NotificationType.warning, title: "Overdue Review Alert", message: "Rashid Ali Khan's ACR is overdue and requires immediate reporting remarks.", createdAt: dateFromNow(-1, 9) },
      { userId: users.countersigningHq.id, acrRecordId: acrs.pendingCountersigningAbdul.id, type: NotificationType.danger, title: "Priority Countersigning Escalation", message: "Abdul Rehman Siddiqui's priority ACR is awaiting countersigning action.", createdAt: dateFromNow(-1, 8) },
      { userId: users.clerkKarachi.id, acrRecordId: acrs.returnedHina.id, type: NotificationType.warning, title: "Returned for Correction", message: "Hina Noor's APS record was returned with remarks. Please update and resubmit.", createdAt: dateFromNow(-2, 15), readAt: dateFromNow(-2, 16) },
      { userId: users.secretBranch.id, acrRecordId: acrs.submittedSecretFatima.id, type: NotificationType.info, title: "Ready to Archive", message: "One ACR packet is ready for final archive verification today.", createdAt: dateFromNow(-1, 12) },
      { userId: users.employeeFatima.id, acrRecordId: acrs.submittedSecretFatima.id, type: NotificationType.success, title: "Status Update", message: "Your current ACR has moved to Secret Branch for finalization.", createdAt: dateFromNow(-1, 13) },
      { userId: users.employeeAsma.id, acrRecordId: acrs.apsPendingAsma.id, type: NotificationType.info, title: "Reporting Review in Progress", message: "Your APS record is currently with the Reporting Officer.", createdAt: dateFromNow(-1, 14) },
      { userId: null, type: NotificationType.info, title: "Cycle Reminder", message: `Current ${currentFiscal.label} ACR cycle remains open. Please complete all pending reviews before due dates lapse.`, createdAt: dateFromNow(-1, 7) },
    ],
  });

  await prisma.fileAsset.createMany({
    data: [
      { acrRecordId: acrs.pendingReportingTariq.id, uploadedById: users.reportingLahore.id, kind: FileAssetKind.SIGNATURE, fileName: "khalid-mehmood-signature.png", mimeType: "image/png", storagePath: "signatures/khalid-mehmood-signature.png" },
      { acrRecordId: acrs.pendingCountersigningAbdul.id, uploadedById: users.reportingHq.id, kind: FileAssetKind.SIGNATURE, fileName: "muhammad-sarmad-signature.png", mimeType: "image/png", storagePath: "signatures/muhammad-sarmad-signature.png" },
      { acrRecordId: acrs.pendingCountersigningAbdul.id, uploadedById: users.countersigningHq.id, kind: FileAssetKind.STAMP, fileName: "afzal-khan-stamp.png", mimeType: "image/png", storagePath: "stamps/afzal-khan-stamp.png" },
      { acrRecordId: acrs.submittedSecretFatima.id, uploadedById: users.secretBranch.id, kind: FileAssetKind.DOCUMENT, fileName: "fatima-secret-branch-packet.pdf", mimeType: "application/pdf", storagePath: documentPath(acrs.submittedSecretFatima.acrNo) },
      { acrRecordId: acrs.archivedYasirCurrent.id, uploadedById: users.secretBranch.id, kind: FileAssetKind.DOCUMENT, fileName: "yasir-archived.pdf", mimeType: "application/pdf", storagePath: documentPath(acrs.archivedYasirCurrent.acrNo) },
      { acrRecordId: acrs.archivedNailaPrevious.id, uploadedById: users.secretBranch.id, kind: FileAssetKind.DOCUMENT, fileName: "naila-archived.pdf", mimeType: "application/pdf", storagePath: documentPath(acrs.archivedNailaPrevious.acrNo) },
      { acrRecordId: acrs.archivedRashidPrevious.id, uploadedById: users.secretBranch.id, kind: FileAssetKind.DOCUMENT, fileName: "rashid-archived.pdf", mimeType: "application/pdf", storagePath: documentPath(acrs.archivedRashidPrevious.acrNo) },
      { acrRecordId: acrs.archivedAsmaPrevious.id, uploadedById: users.secretBranch.id, kind: FileAssetKind.DOCUMENT, fileName: "asma-archived.pdf", mimeType: "application/pdf", storagePath: documentPath(acrs.archivedAsmaPrevious.acrNo) },
    ],
  });

  await prisma.archiveSnapshot.createMany({
    data: [
      { acrRecordId: acrs.archivedYasirCurrent.id, archivedById: users.secretBranch.id, documentPath: documentPath(acrs.archivedYasirCurrent.acrNo), checksum: `${acrs.archivedYasirCurrent.id}-checksum`, immutableHash: `${acrs.archivedYasirCurrent.id}-immutable` },
      { acrRecordId: acrs.archivedNailaPrevious.id, archivedById: users.secretBranch.id, documentPath: documentPath(acrs.archivedNailaPrevious.acrNo), checksum: `${acrs.archivedNailaPrevious.id}-checksum`, immutableHash: `${acrs.archivedNailaPrevious.id}-immutable` },
      { acrRecordId: acrs.archivedRashidPrevious.id, archivedById: users.secretBranch.id, documentPath: documentPath(acrs.archivedRashidPrevious.acrNo), checksum: `${acrs.archivedRashidPrevious.id}-checksum`, immutableHash: `${acrs.archivedRashidPrevious.id}-immutable` },
      { acrRecordId: acrs.archivedAsmaPrevious.id, archivedById: users.secretBranch.id, documentPath: documentPath(acrs.archivedAsmaPrevious.acrNo), checksum: `${acrs.archivedAsmaPrevious.id}-checksum`, immutableHash: `${acrs.archivedAsmaPrevious.id}-immutable` },
    ],
  });

  await prisma.adminSetting.createMany({
    data: [
      { key: "workflow.due_days.reporting", value: 10, updatedById: users.superAdmin.id },
      { key: "workflow.due_days.countersigning", value: 7, updatedById: users.superAdmin.id },
      { key: "workflow.due_days.secret_branch", value: 5, updatedById: users.superAdmin.id },
      { key: "workflow.priority_escalation_days", value: 3, updatedById: users.superAdmin.id },
      { key: "employee.self_service_enabled", value: true, updatedById: users.superAdmin.id },
      { key: "notifications.email_digest_enabled", value: false, updatedById: users.superAdmin.id },
      { key: "archive.export_watermark", value: "Official Use Only", updatedById: users.superAdmin.id },
      { key: "templates.default_language_mode", value: "BILINGUAL", updatedById: users.superAdmin.id },
    ],
  });

  console.info("Smart ACR demo seed completed.");
  console.info(`Demo password for all accounts: ${DEMO_PASSWORD}`);
  console.info("Suggested demo logins:");
  console.info(" - it.ops");
  console.info(" - zahid.ullah@fia.gov.pk");
  console.info(" - clerk.lhr");
  console.info(" - muhammad.sarmad@fia.gov.pk");
  console.info(" - afzal.khan@fia.gov.pk");
  console.info(" - nazia.ambreen@fia.gov.pk");
  console.info(" - dr.anwar.saleem@fia.gov.pk");
  console.info(" - fatima.employee");
  console.info(" - asma.employee");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
