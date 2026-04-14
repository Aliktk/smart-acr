import {
  AcrWorkflowState,
  ArchiveRecordSource,
  DeputationType,
  EducationLevel,
  Gender,
  LanguageMode,
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

function dateAt(date: string) {
  return new Date(`${date}T09:00:00.000Z`);
}

function shiftDays(base: Date, days: number) {
  const value = new Date(base);
  value.setDate(value.getDate() + days);
  return value;
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

async function resetDatabase() {
  await prisma.authChallenge.deleteMany();
  await prisma.archiveSnapshot.deleteMany();
  await prisma.fileAsset.deleteMany();
  await prisma.archiveRecord.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.acrTimelineEntry.deleteMany();
  await prisma.acrRecord.deleteMany();
  await prisma.templateVersion.deleteMany();
  await prisma.secretBranchRoutingRule.deleteMany();
  await prisma.authorityMatrixRule.deleteMany();
  await prisma.secretBranchStaffProfile.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.session.deleteMany();
  await prisma.userRoleAssignment.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.adminSetting.deleteMany();
  await prisma.userAsset.deleteMany();
  await prisma.user.deleteMany();
  await prisma.department.deleteMany();
  await prisma.office.deleteMany();
  await prisma.cell.deleteMany();
  await prisma.branch.deleteMany();
  await prisma.station.deleteMany();
  await prisma.circle.deleteMany();
  await prisma.zone.deleteMany();
  await prisma.region.deleteMany();
  await prisma.directorate.deleteMany();
  await prisma.wing.deleteMany();
}

async function createUser(input: {
  username: string;
  email: string;
  badgeNo: string;
  displayName: string;
  positionTitle?: string;
  mobileNumber?: string;
  cnic?: string;
  passwordHash: string;
  departmentName?: string;
  scopeTrack?: OrgScopeTrack;
  wingId?: string | null;
  directorateId?: string | null;
  regionId?: string | null;
  zoneId?: string | null;
  circleId?: string | null;
  stationId?: string | null;
  branchId?: string | null;
  cellId?: string | null;
  officeId?: string | null;
  departmentId?: string | null;
  roles: Array<{ role: UserRole; scopeTrack?: OrgScopeTrack; wingId?: string | null; directorateId?: string | null; regionId?: string | null; zoneId?: string | null; circleId?: string | null; stationId?: string | null; branchId?: string | null; cellId?: string | null; officeId?: string | null; departmentId?: string | null }>;
  secretBranchProfile?: { deskCode: SecretBranchDeskCode; canManageUsers?: boolean; canVerify?: boolean };
}) {
  const { roles, secretBranchProfile, ...userData } = input;
  const user = await prisma.user.create({ data: userData });
  await prisma.userRoleAssignment.createMany({
    data: roles.map((role) => ({
      userId: user.id,
      role: role.role,
      scopeTrack: role.scopeTrack ?? input.scopeTrack ?? OrgScopeTrack.WING,
      wingId: role.wingId ?? null,
      directorateId: role.directorateId ?? null,
      regionId: role.regionId ?? null,
      zoneId: role.zoneId ?? null,
      circleId: role.circleId ?? null,
      stationId: role.stationId ?? null,
      branchId: role.branchId ?? null,
      cellId: role.cellId ?? null,
      officeId: role.officeId ?? null,
      departmentId: role.departmentId ?? null,
    })),
  });

  if (secretBranchProfile) {
    await prisma.secretBranchStaffProfile.create({
      data: {
        userId: user.id,
        deskCode: secretBranchProfile.deskCode,
        canManageUsers: secretBranchProfile.canManageUsers ?? false,
        canVerify: secretBranchProfile.canVerify ?? false,
      },
    });
  }

  return user;
}

async function main() {
  await resetDatabase();

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const fiscalStartYear = new Date().getUTCMonth() >= 6 ? new Date().getUTCFullYear() : new Date().getUTCFullYear() - 1;
  const currentFiscal = fiscalPeriod(fiscalStartYear);
  const previousFiscal = fiscalPeriod(fiscalStartYear - 1);

  const operationsWing = await prisma.wing.create({ data: { code: "OPS", name: "Operations Wing" } });
  const adminWing = await prisma.wing.create({ data: { code: "ADM", name: "Administration Wing" } });

  const northDirectorate = await prisma.directorate.create({ data: { code: "DIR-N", name: "Northern Operations Directorate", wingId: operationsWing.id } });
  const southDirectorate = await prisma.directorate.create({ data: { code: "DIR-S", name: "Southern Operations Directorate", wingId: operationsWing.id } });
  const secretDirectorate = await prisma.directorate.create({ data: { code: "DIR-SB", name: "Secret Branch Directorate", wingId: adminWing.id } });

  const northRegion = await prisma.region.create({ data: { code: "REG-N", name: "North Region" } });
  const southRegion = await prisma.region.create({ data: { code: "REG-S", name: "South Region" } });

  const northZones = await Promise.all(["Islamabad", "Peshawar", "Kohat", "Lahore", "Faisalabad", "Gujrat", "Multan"].map((name) =>
    prisma.zone.create({ data: { code: `ZN-${name.toUpperCase().replace(/[^A-Z0-9]+/g, "-")}`, name, wingId: operationsWing.id, regionId: northRegion.id } }),
  ));
  const southZones = await Promise.all(["Balochistan", "Karachi", "Sukkur", "Hyderabad"].map((name) =>
    prisma.zone.create({ data: { code: `ZN-${name.toUpperCase().replace(/[^A-Z0-9]+/g, "-")}`, name, wingId: operationsWing.id, regionId: southRegion.id } }),
  ));

  const zoneByName = Object.fromEntries([...northZones, ...southZones].map((zone) => [zone.name, zone])) as Record<string, typeof northZones[number]>;

  const isbCircle = await prisma.circle.create({ data: { code: "CIR-ISB-AIR", name: "Islamabad Airport Circle", wingId: operationsWing.id, regionId: northRegion.id, zoneId: zoneByName.Islamabad.id } });
  const lhrCircle = await prisma.circle.create({ data: { code: "CIR-LHE-OPS", name: "Lahore Operational Circle", wingId: operationsWing.id, regionId: northRegion.id, zoneId: zoneByName.Lahore.id } });
  const khiCircle = await prisma.circle.create({ data: { code: "CIR-KHI-SEA", name: "Karachi Seaport Circle", wingId: operationsWing.id, regionId: southRegion.id, zoneId: zoneByName.Karachi.id } });

  const isbStation = await prisma.station.create({ data: { code: "ST-ISB-AIR", name: "Airport Station Islamabad", wingId: operationsWing.id, regionId: northRegion.id, zoneId: zoneByName.Islamabad.id, circleId: isbCircle.id } });
  const lhrStation = await prisma.station.create({ data: { code: "ST-LHE", name: "Lahore Main Station", wingId: operationsWing.id, regionId: northRegion.id, zoneId: zoneByName.Lahore.id, circleId: lhrCircle.id } });
  const khiStation = await prisma.station.create({ data: { code: "ST-KHI-SEA", name: "Seaport Station Karachi", wingId: operationsWing.id, regionId: southRegion.id, zoneId: zoneByName.Karachi.id, circleId: khiCircle.id } });

  const secretBranch = await prisma.branch.create({ data: { code: "BR-SB", name: "Secret Branch HQ", wingId: adminWing.id, zoneId: zoneByName.Islamabad.id, stationId: isbStation.id } });
  const lhrBranch = await prisma.branch.create({ data: { code: "BR-LHE", name: "Lahore Operations Branch", wingId: operationsWing.id, regionId: northRegion.id, zoneId: zoneByName.Lahore.id, circleId: lhrCircle.id, stationId: lhrStation.id } });
  const khiBranch = await prisma.branch.create({ data: { code: "BR-KHI", name: "Karachi Operations Branch", wingId: operationsWing.id, regionId: southRegion.id, zoneId: zoneByName.Karachi.id, circleId: khiCircle.id, stationId: khiStation.id } });

  const archiveCell = await prisma.cell.create({ data: { code: "CELL-ARCH", name: "Archive Cell", wingId: adminWing.id, zoneId: zoneByName.Islamabad.id, stationId: isbStation.id, branchId: secretBranch.id } });

  // --- HQ Wing Offices ---
  const hqOffice = await prisma.office.create({ data: { code: "OFC-HQ", name: "FIA Headquarters Islamabad", scopeTrack: OrgScopeTrack.WING, wingId: adminWing.id, directorateId: secretDirectorate.id } });
  const secretOffice = await prisma.office.create({ data: { code: "OFC-SB", name: "Secret Branch Office Islamabad", scopeTrack: OrgScopeTrack.WING, wingId: adminWing.id, directorateId: secretDirectorate.id } });
  const hrmOffice = await prisma.office.create({ data: { code: "OFC-HRM", name: "HRM Wing Islamabad", scopeTrack: OrgScopeTrack.WING, wingId: adminWing.id } });
  const trainingOffice = await prisma.office.create({ data: { code: "OFC-TRG", name: "FIA Academy / Training Wing", scopeTrack: OrgScopeTrack.WING, wingId: adminWing.id } });
  const technicalOffice = await prisma.office.create({ data: { code: "OFC-TECH", name: "Technical Wing Islamabad", scopeTrack: OrgScopeTrack.WING, wingId: operationsWing.id } });
  const cyberCrimeOffice = await prisma.office.create({ data: { code: "OFC-CCW", name: "Cyber Crime Wing Islamabad", scopeTrack: OrgScopeTrack.WING, wingId: operationsWing.id } });
  const immigrationOffice = await prisma.office.create({ data: { code: "OFC-IMM", name: "Immigration Wing Islamabad", scopeTrack: OrgScopeTrack.WING, wingId: operationsWing.id } });
  const acwOffice = await prisma.office.create({ data: { code: "OFC-ACW", name: "Anti-Corruption Wing Islamabad", scopeTrack: OrgScopeTrack.WING, wingId: operationsWing.id } });
  const amlOffice = await prisma.office.create({ data: { code: "OFC-AML", name: "AML-CFT Wing Islamabad", scopeTrack: OrgScopeTrack.WING, wingId: operationsWing.id } });
  const ctwOffice = await prisma.office.create({ data: { code: "OFC-CTW", name: "Counter-Terrorism Wing", scopeTrack: OrgScopeTrack.WING, wingId: operationsWing.id } });
  const ncbOffice = await prisma.office.create({ data: { code: "OFC-NCB", name: "NCB-Interpol Wing", scopeTrack: OrgScopeTrack.WING, wingId: operationsWing.id } });
  const ibmsOffice = await prisma.office.create({ data: { code: "OFC-IBMS", name: "IBMS Wing Islamabad", scopeTrack: OrgScopeTrack.WING, wingId: operationsWing.id } });
  const lawOffice = await prisma.office.create({ data: { code: "OFC-LAW", name: "Legal / Law Wing", scopeTrack: OrgScopeTrack.WING, wingId: adminWing.id } });
  const piabOffice = await prisma.office.create({ data: { code: "OFC-PIAB", name: "PIAB Wing Islamabad", scopeTrack: OrgScopeTrack.WING, wingId: adminWing.id } });
  const iprOffice = await prisma.office.create({ data: { code: "OFC-IPR", name: "IPR Wing Islamabad", scopeTrack: OrgScopeTrack.WING, wingId: operationsWing.id } });

  // --- Zonal Offices ---
  const lhrOffice = await prisma.office.create({ data: { code: "OFC-LHE", name: "FIA Lahore Zone Office", scopeTrack: OrgScopeTrack.REGIONAL, regionId: northRegion.id, zoneId: zoneByName.Lahore.id, circleId: lhrCircle.id, stationId: lhrStation.id, branchId: lhrBranch.id } });
  const khiOffice = await prisma.office.create({ data: { code: "OFC-KHI", name: "FIA Karachi Zone Office", scopeTrack: OrgScopeTrack.REGIONAL, regionId: southRegion.id, zoneId: zoneByName.Karachi.id, circleId: khiCircle.id, stationId: khiStation.id, branchId: khiBranch.id } });
  const isbZoneOffice = await prisma.office.create({ data: { code: "OFC-ISB-Z", name: "FIA Islamabad Zone Office", scopeTrack: OrgScopeTrack.REGIONAL, regionId: northRegion.id, zoneId: zoneByName.Islamabad.id, circleId: isbCircle.id, stationId: isbStation.id } });
  const pshZoneOffice = await prisma.office.create({ data: { code: "OFC-PSH", name: "FIA Peshawar Zone Office", scopeTrack: OrgScopeTrack.REGIONAL, regionId: northRegion.id, zoneId: zoneByName.Peshawar.id } });
  const fsdZoneOffice = await prisma.office.create({ data: { code: "OFC-FSD", name: "FIA Faisalabad Zone Office", scopeTrack: OrgScopeTrack.REGIONAL, regionId: northRegion.id, zoneId: zoneByName.Faisalabad.id } });
  const mtnZoneOffice = await prisma.office.create({ data: { code: "OFC-MTN", name: "FIA Multan Zone Office", scopeTrack: OrgScopeTrack.REGIONAL, regionId: northRegion.id, zoneId: zoneByName.Multan.id } });
  const grtZoneOffice = await prisma.office.create({ data: { code: "OFC-GRT", name: "FIA Gujrat Zone Office", scopeTrack: OrgScopeTrack.REGIONAL, regionId: northRegion.id, zoneId: zoneByName.Gujrat.id } });
  const quettaZoneOffice = await prisma.office.create({ data: { code: "OFC-QTA", name: "FIA Balochistan Zone Office", scopeTrack: OrgScopeTrack.REGIONAL, regionId: southRegion.id, zoneId: zoneByName.Balochistan.id } });
  const sukZoneOffice = await prisma.office.create({ data: { code: "OFC-SUK", name: "FIA Sukkur Zone Office", scopeTrack: OrgScopeTrack.REGIONAL, regionId: southRegion.id, zoneId: zoneByName.Sukkur.id } });
  const hydZoneOffice = await prisma.office.create({ data: { code: "OFC-HYD", name: "FIA Hyderabad Zone Office", scopeTrack: OrgScopeTrack.REGIONAL, regionId: southRegion.id, zoneId: zoneByName.Hyderabad.id } });

  // --- Departments per HQ Office ---
  const adminDepartment = await prisma.department.create({ data: { code: "DEP-ADM", name: "Administration", officeId: hqOffice.id } });
  await prisma.department.create({ data: { code: "DEP-HQ-ACC", name: "Accounts", officeId: hqOffice.id } });
  await prisma.department.create({ data: { code: "DEP-HQ-LOG", name: "Logistics", officeId: hqOffice.id } });
  await prisma.department.create({ data: { code: "DEP-HQ-SEC", name: "Security", officeId: hqOffice.id } });
  await prisma.department.create({ data: { code: "DEP-HQ-ENG", name: "Engineering", officeId: hqOffice.id } });
  await prisma.department.create({ data: { code: "DEP-HQ-BUD", name: "Budget & Finance", officeId: hqOffice.id } });
  await prisma.department.create({ data: { code: "DEP-HQ-TPT", name: "Transport", officeId: hqOffice.id } });
  await prisma.department.create({ data: { code: "DEP-HQ-OPS", name: "Operations", officeId: hqOffice.id } });
  const secretDepartment = await prisma.department.create({ data: { code: "DEP-SB", name: "Secret Branch", officeId: secretOffice.id } });
  await prisma.department.create({ data: { code: "DEP-SB-DP", name: "Departmental Proceedings", officeId: secretOffice.id } });
  await prisma.department.create({ data: { code: "DEP-SB-PC", name: "Policy & Coordination", officeId: secretOffice.id } });

  // HRM departments
  await prisma.department.create({ data: { code: "DEP-HRM-HR1", name: "HR-I", officeId: hrmOffice.id } });
  await prisma.department.create({ data: { code: "DEP-HRM-HR2", name: "HR-II", officeId: hrmOffice.id } });
  await prisma.department.create({ data: { code: "DEP-HRM-HR3", name: "HR-III", officeId: hrmOffice.id } });
  await prisma.department.create({ data: { code: "DEP-HRM-COORD", name: "Coordination", officeId: hrmOffice.id } });
  await prisma.department.create({ data: { code: "DEP-HRM-WELFARE", name: "Welfare", officeId: hrmOffice.id } });
  await prisma.department.create({ data: { code: "DEP-PIAB-SC", name: "Secret Cell", officeId: piabOffice.id } });
  await prisma.department.create({ data: { code: "DEP-PIAB-DP", name: "Departmental Proceedings", officeId: piabOffice.id } });
  await prisma.department.create({ data: { code: "DEP-PIAB-PC", name: "Performance & Coordination", officeId: piabOffice.id } });

  // Cyber Crime Wing departments
  await prisma.department.create({ data: { code: "DEP-CCW-ADM", name: "Administration (CCW)", officeId: cyberCrimeOffice.id } });
  await prisma.department.create({ data: { code: "DEP-CCW-CCRC", name: "Cyber Crime Reporting Centre", officeId: cyberCrimeOffice.id } });
  await prisma.department.create({ data: { code: "DEP-CCW-OPS", name: "Operations (CCW)", officeId: cyberCrimeOffice.id } });
  await prisma.department.create({ data: { code: "DEP-CCW-LAW", name: "Legal (CCW)", officeId: cyberCrimeOffice.id } });

  // Immigration Wing departments
  await prisma.department.create({ data: { code: "DEP-IMM-OPS", name: "Immigration Operations", officeId: immigrationOffice.id } });
  await prisma.department.create({ data: { code: "DEP-IMM-AHS", name: "Anti-Human Smuggling", officeId: immigrationOffice.id } });
  await prisma.department.create({ data: { code: "DEP-IMM-LIA", name: "Immigration Liaison", officeId: immigrationOffice.id } });

  // ACW departments
  await prisma.department.create({ data: { code: "DEP-ACW-PAC", name: "Public Accounts Committee", officeId: acwOffice.id } });
  await prisma.department.create({ data: { code: "DEP-ACW-CCRO", name: "Central Crime Record Office", officeId: acwOffice.id } });
  await prisma.department.create({ data: { code: "DEP-ACW-IE", name: "Inspection & Evaluation", officeId: acwOffice.id } });
  await prisma.department.create({ data: { code: "DEP-ACW-CMU", name: "Complaint Management Unit", officeId: acwOffice.id } });
  await prisma.department.create({ data: { code: "DEP-ACW-CMS", name: "Case Management System", officeId: acwOffice.id } });

  // AML-CFT departments
  await prisma.department.create({ data: { code: "DEP-AML-OPS", name: "AML Operations", officeId: amlOffice.id } });
  await prisma.department.create({ data: { code: "DEP-AML-LAW", name: "AML Legal", officeId: amlOffice.id } });

  // CTW departments
  await prisma.department.create({ data: { code: "DEP-CTW-OPS", name: "CTW Operations", officeId: ctwOffice.id } });
  await prisma.department.create({ data: { code: "DEP-CTW-ADM", name: "CTW Administration", officeId: ctwOffice.id } });

  // IBMS departments
  await prisma.department.create({ data: { code: "DEP-IBMS-NET", name: "Networks", officeId: ibmsOffice.id } });
  await prisma.department.create({ data: { code: "DEP-IBMS-AWL", name: "Analysis & Watch List", officeId: ibmsOffice.id } });
  await prisma.department.create({ data: { code: "DEP-IBMS-DBMS", name: "Database Management", officeId: ibmsOffice.id } });
  await prisma.department.create({ data: { code: "DEP-IBMS-SMS", name: "System Management & Security", officeId: ibmsOffice.id } });
  await prisma.department.create({ data: { code: "DEP-IBMS-DEV", name: "Development", officeId: ibmsOffice.id } });

  // Zonal office departments (common pattern)
  const opsDepartment = await prisma.department.create({ data: { code: "DEP-OPS", name: "Operations", officeId: lhrOffice.id } });
  for (const zonalOffice of [lhrOffice, khiOffice, isbZoneOffice, pshZoneOffice, fsdZoneOffice, mtnZoneOffice, grtZoneOffice, quettaZoneOffice, sukZoneOffice, hydZoneOffice]) {
    if (zonalOffice.id === lhrOffice.id) continue; // already created
    const prefix = zonalOffice.code.replace("OFC-", "");
    await prisma.department.createMany({
      data: [
        { code: `DEP-${prefix}-ACC`, name: "Anti-Corruption Circle", officeId: zonalOffice.id },
        { code: `DEP-${prefix}-CBC`, name: "Commercial Banking Circle", officeId: zonalOffice.id },
        { code: `DEP-${prefix}-CCC`, name: "Corporate Crime Circle", officeId: zonalOffice.id },
        { code: `DEP-${prefix}-SBC`, name: "State Bank Circle", officeId: zonalOffice.id },
        { code: `DEP-${prefix}-AHTC`, name: "Anti-Human Trafficking Circle", officeId: zonalOffice.id },
        { code: `DEP-${prefix}-IMM`, name: "Immigration", officeId: zonalOffice.id },
        { code: `DEP-${prefix}-ATU`, name: "Anti-Trafficking Unit", officeId: zonalOffice.id },
        { code: `DEP-${prefix}-ADM`, name: "Administration", officeId: zonalOffice.id },
        { code: `DEP-${prefix}-IM`, name: "Inspection & Monitoring", officeId: zonalOffice.id },
        { code: `DEP-${prefix}-ACCT`, name: "Accounts", officeId: zonalOffice.id },
      ],
      skipDuplicates: true,
    });
  }

  const users = {
    superAdmin: await createUser({
      username: "it.ops",
      email: "it.ops@fia.gov.pk",
      badgeNo: "FIA-OPS-0001",
      displayName: "Hamza Qureshi",
      positionTitle: "IT Operations Lead",
      mobileNumber: "0300-7000001",
      cnic: "61101-0000001-3",
      passwordHash,
      scopeTrack: OrgScopeTrack.WING,
      wingId: adminWing.id,
      officeId: hqOffice.id,
      departmentId: adminDepartment.id,
      departmentName: adminDepartment.name,
      roles: [
        { role: UserRole.SUPER_ADMIN, scopeTrack: OrgScopeTrack.WING, wingId: adminWing.id, directorateId: secretDirectorate.id, officeId: hqOffice.id, departmentId: adminDepartment.id },
        { role: UserRole.IT_OPS, scopeTrack: OrgScopeTrack.WING, wingId: adminWing.id, directorateId: secretDirectorate.id, officeId: hqOffice.id, departmentId: adminDepartment.id },
      ],
    }),
    clerk: await createUser({
      username: "clerk.isb",
      email: "clerk.isb@fia.gov.pk",
      badgeNo: "FIA-CLK-1001",
      displayName: "Zahid Ullah",
      positionTitle: "Clerk",
      mobileNumber: "0300-7001101",
      cnic: "61101-1100101-5",
      passwordHash,
      scopeTrack: OrgScopeTrack.WING,
      wingId: adminWing.id,
      directorateId: secretDirectorate.id,
      officeId: hqOffice.id,
      departmentId: adminDepartment.id,
      departmentName: adminDepartment.name,
      roles: [{ role: UserRole.CLERK, scopeTrack: OrgScopeTrack.WING, wingId: adminWing.id, directorateId: secretDirectorate.id, officeId: hqOffice.id, departmentId: adminDepartment.id }],
    }),
    reporting: await createUser({
      username: "reporting.lhr",
      email: "reporting.lhr@fia.gov.pk",
      badgeNo: "FIA-RO-2001",
      displayName: "DSP Khalid Mehmood",
      positionTitle: "Reporting Officer",
      mobileNumber: "0300-7011201",
      cnic: "35202-2001201-7",
      passwordHash,
      scopeTrack: OrgScopeTrack.REGIONAL,
      regionId: northRegion.id,
      zoneId: zoneByName.Lahore.id,
      circleId: lhrCircle.id,
      stationId: lhrStation.id,
      branchId: lhrBranch.id,
      officeId: lhrOffice.id,
      roles: [{ role: UserRole.REPORTING_OFFICER, scopeTrack: OrgScopeTrack.REGIONAL, regionId: northRegion.id, zoneId: zoneByName.Lahore.id, circleId: lhrCircle.id, stationId: lhrStation.id, branchId: lhrBranch.id, officeId: lhrOffice.id }],
    }),
    reportingKarachi: await createUser({
      username: "reporting.khi",
      email: "reporting.khi@fia.gov.pk",
      badgeNo: "FIA-RO-2002",
      displayName: "DSP Zafar Iqbal",
      positionTitle: "Reporting Officer",
      mobileNumber: "0300-7011301",
      cnic: "42201-2002301-9",
      passwordHash,
      scopeTrack: OrgScopeTrack.REGIONAL,
      regionId: southRegion.id,
      zoneId: zoneByName.Karachi.id,
      circleId: khiCircle.id,
      stationId: khiStation.id,
      branchId: khiBranch.id,
      officeId: khiOffice.id,
      roles: [{ role: UserRole.REPORTING_OFFICER, scopeTrack: OrgScopeTrack.REGIONAL, regionId: southRegion.id, zoneId: zoneByName.Karachi.id, circleId: khiCircle.id, stationId: khiStation.id, branchId: khiBranch.id, officeId: khiOffice.id }],
    }),
    countersigning: await createUser({
      username: "countersigning.lhr",
      email: "countersigning.lhr@fia.gov.pk",
      badgeNo: "FIA-CS-3001",
      displayName: "SP Anwar Ul Haq",
      positionTitle: "Assistant Director",
      mobileNumber: "0300-7022201",
      cnic: "35202-3001201-1",
      passwordHash,
      scopeTrack: OrgScopeTrack.REGIONAL,
      regionId: northRegion.id,
      zoneId: zoneByName.Lahore.id,
      circleId: lhrCircle.id,
      stationId: lhrStation.id,
      branchId: lhrBranch.id,
      officeId: lhrOffice.id,
      roles: [{ role: UserRole.COUNTERSIGNING_OFFICER, scopeTrack: OrgScopeTrack.REGIONAL, regionId: northRegion.id, zoneId: zoneByName.Lahore.id, circleId: lhrCircle.id, stationId: lhrStation.id, branchId: lhrBranch.id, officeId: lhrOffice.id }],
    }),
    countersigningKarachi: await createUser({
      username: "countersigning.khi",
      email: "countersigning.khi@fia.gov.pk",
      badgeNo: "FIA-CS-3002",
      displayName: "SP Rizwan Ahmed",
      positionTitle: "Assistant Director",
      mobileNumber: "0300-7022301",
      cnic: "42201-3002301-3",
      passwordHash,
      scopeTrack: OrgScopeTrack.REGIONAL,
      regionId: southRegion.id,
      zoneId: zoneByName.Karachi.id,
      circleId: khiCircle.id,
      stationId: khiStation.id,
      branchId: khiBranch.id,
      officeId: khiOffice.id,
      roles: [{ role: UserRole.COUNTERSIGNING_OFFICER, scopeTrack: OrgScopeTrack.REGIONAL, regionId: southRegion.id, zoneId: zoneByName.Karachi.id, circleId: khiCircle.id, stationId: khiStation.id, branchId: khiBranch.id, officeId: khiOffice.id }],
    }),
    dg: await createUser({
      username: "dg.portal",
      email: "dg.portal@fia.gov.pk",
      badgeNo: "FIA-DG-0101",
      displayName: "Dr Anwar Saleem",
      positionTitle: "DG",
      mobileNumber: "0300-7055101",
      cnic: "61101-5510101-7",
      passwordHash,
      scopeTrack: OrgScopeTrack.WING,
      wingId: adminWing.id,
      directorateId: secretDirectorate.id,
      officeId: hqOffice.id,
      roles: [
        { role: UserRole.DG, scopeTrack: OrgScopeTrack.WING, wingId: adminWing.id, directorateId: secretDirectorate.id, officeId: hqOffice.id },
        { role: UserRole.EXECUTIVE_VIEWER, scopeTrack: OrgScopeTrack.WING, wingId: adminWing.id, directorateId: secretDirectorate.id, officeId: hqOffice.id },
      ],
    }),
    secretAdmin: await createUser({
      username: "secret.admin",
      email: "secret.admin@fia.gov.pk",
      badgeNo: "FIA-SB-4001",
      displayName: "Nazia Ambreen",
      positionTitle: "Assistant Director Secret Branch",
      mobileNumber: "0300-7033101",
      cnic: "61101-4001101-8",
      passwordHash,
      scopeTrack: OrgScopeTrack.WING,
      wingId: adminWing.id,
      directorateId: secretDirectorate.id,
      officeId: secretOffice.id,
      departmentId: secretDepartment.id,
      departmentName: secretDepartment.name,
      roles: [{ role: UserRole.SECRET_BRANCH, scopeTrack: OrgScopeTrack.WING, wingId: adminWing.id, directorateId: secretDirectorate.id, officeId: secretOffice.id, departmentId: secretDepartment.id }],
      secretBranchProfile: { deskCode: SecretBranchDeskCode.AD_SECRET_BRANCH, canManageUsers: true, canVerify: true },
    }),
    da1: await createUser({
      username: "secret.da1",
      email: "secret.da1@fia.gov.pk",
      badgeNo: "FIA-SB-4002",
      displayName: "Sadia Malik",
      positionTitle: "DA1",
      mobileNumber: "0300-7033102",
      cnic: "61101-4002102-4",
      passwordHash,
      scopeTrack: OrgScopeTrack.WING,
      wingId: adminWing.id,
      directorateId: secretDirectorate.id,
      officeId: secretOffice.id,
      departmentId: secretDepartment.id,
      departmentName: secretDepartment.name,
      roles: [{ role: UserRole.SECRET_BRANCH, scopeTrack: OrgScopeTrack.WING, wingId: adminWing.id, directorateId: secretDirectorate.id, officeId: secretOffice.id, departmentId: secretDepartment.id }],
      secretBranchProfile: { deskCode: SecretBranchDeskCode.DA1 },
    }),
    da2: await createUser({
      username: "secret.da2",
      email: "secret.da2@fia.gov.pk",
      badgeNo: "FIA-SB-4003",
      displayName: "Aamir Shahzad",
      positionTitle: "DA2",
      mobileNumber: "0300-7033103",
      cnic: "35202-4003103-2",
      passwordHash,
      scopeTrack: OrgScopeTrack.WING,
      wingId: adminWing.id,
      directorateId: secretDirectorate.id,
      officeId: secretOffice.id,
      departmentId: secretDepartment.id,
      departmentName: secretDepartment.name,
      roles: [{ role: UserRole.SECRET_BRANCH, scopeTrack: OrgScopeTrack.WING, wingId: adminWing.id, directorateId: secretDirectorate.id, officeId: secretOffice.id, departmentId: secretDepartment.id }],
      secretBranchProfile: { deskCode: SecretBranchDeskCode.DA2 },
    }),
    da3: await createUser({
      username: "secret.da3",
      email: "secret.da3@fia.gov.pk",
      badgeNo: "FIA-SB-4004",
      displayName: "Faiza Noor",
      positionTitle: "DA3",
      mobileNumber: "0300-7033104",
      cnic: "61101-4004104-6",
      passwordHash,
      scopeTrack: OrgScopeTrack.WING,
      wingId: adminWing.id,
      directorateId: secretDirectorate.id,
      officeId: secretOffice.id,
      departmentId: secretDepartment.id,
      departmentName: secretDepartment.name,
      roles: [{ role: UserRole.SECRET_BRANCH, scopeTrack: OrgScopeTrack.WING, wingId: adminWing.id, directorateId: secretDirectorate.id, officeId: secretOffice.id, departmentId: secretDepartment.id }],
      secretBranchProfile: { deskCode: SecretBranchDeskCode.DA3 },
    }),
    da4: await createUser({
      username: "secret.da4",
      email: "secret.da4@fia.gov.pk",
      badgeNo: "FIA-SB-4005",
      displayName: "Kamran Nadeem",
      positionTitle: "DA4",
      mobileNumber: "0300-7033105",
      cnic: "35202-4005105-8",
      passwordHash,
      scopeTrack: OrgScopeTrack.WING,
      wingId: adminWing.id,
      directorateId: secretDirectorate.id,
      officeId: secretOffice.id,
      departmentId: secretDepartment.id,
      departmentName: secretDepartment.name,
      roles: [{ role: UserRole.SECRET_BRANCH, scopeTrack: OrgScopeTrack.WING, wingId: adminWing.id, directorateId: secretDirectorate.id, officeId: secretOffice.id, departmentId: secretDepartment.id }],
      secretBranchProfile: { deskCode: SecretBranchDeskCode.DA4 },
    }),
    fatimaUser: await createUser({
      username: "fatima.employee",
      email: "fatima.zahra.employee@fia.gov.pk",
      badgeNo: "FIA-EMP-5001",
      displayName: "Fatima Zahra",
      positionTitle: "UDC",
      mobileNumber: "0345-3333333",
      cnic: "61101-3333333-2",
      passwordHash,
      scopeTrack: OrgScopeTrack.WING,
      wingId: adminWing.id,
      directorateId: secretDirectorate.id,
      officeId: hqOffice.id,
      roles: [{ role: UserRole.EMPLOYEE, scopeTrack: OrgScopeTrack.WING, wingId: adminWing.id, directorateId: secretDirectorate.id, officeId: hqOffice.id }],
    }),
    bilalUser: await createUser({
      username: "bilal.employee",
      email: "bilal.hassan.employee@fia.gov.pk",
      badgeNo: "FIA-EMP-5002",
      displayName: "Bilal Hassan",
      positionTitle: "Assistant",
      mobileNumber: "0300-1112223",
      cnic: "35202-1234567-1",
      passwordHash,
      scopeTrack: OrgScopeTrack.REGIONAL,
      regionId: northRegion.id,
      zoneId: zoneByName.Lahore.id,
      circleId: lhrCircle.id,
      stationId: lhrStation.id,
      branchId: lhrBranch.id,
      officeId: lhrOffice.id,
      roles: [{ role: UserRole.EMPLOYEE, scopeTrack: OrgScopeTrack.REGIONAL, regionId: northRegion.id, zoneId: zoneByName.Lahore.id, circleId: lhrCircle.id, stationId: lhrStation.id, branchId: lhrBranch.id, officeId: lhrOffice.id }],
    }),
    hinaUser: await createUser({
      username: "hina.employee",
      email: "hina.noor.employee@fia.gov.pk",
      badgeNo: "FIA-EMP-5003",
      displayName: "Hina Noor",
      positionTitle: "Inspector",
      mobileNumber: "0300-1234567",
      cnic: "42101-1234567-8",
      passwordHash,
      scopeTrack: OrgScopeTrack.REGIONAL,
      regionId: southRegion.id,
      zoneId: zoneByName.Karachi.id,
      circleId: khiCircle.id,
      stationId: khiStation.id,
      branchId: khiBranch.id,
      officeId: khiOffice.id,
      roles: [{ role: UserRole.EMPLOYEE, scopeTrack: OrgScopeTrack.REGIONAL, regionId: southRegion.id, zoneId: zoneByName.Karachi.id, circleId: khiCircle.id, stationId: khiStation.id, branchId: khiBranch.id, officeId: khiOffice.id }],
    }),
  };

  const templateVersions = {
    assistant: await prisma.templateVersion.create({ data: { family: TemplateFamilyCode.ASSISTANT_UDC_LDC, code: "S-121-C-2026", version: "2026.1", title: "Assistant / UDC / LDC", languageMode: LanguageMode.ENGLISH, requiresCountersigning: true, pageCount: 4 } }),
    aps: await prisma.templateVersion.create({ data: { family: TemplateFamilyCode.APS_STENOTYPIST, code: "S-121-E-2026", version: "2026.1", title: "APS / Stenotypist", languageMode: LanguageMode.BILINGUAL, requiresCountersigning: false, pageCount: 8 } }),
    inspector: await prisma.templateVersion.create({ data: { family: TemplateFamilyCode.INSPECTOR_SI_ASI, code: "FIA-INS-2026", version: "2026.1", title: "Inspector / SI / ASI", languageMode: LanguageMode.ENGLISH, requiresCountersigning: true, pageCount: 6 } }),
    superintendent: await prisma.templateVersion.create({ data: { family: TemplateFamilyCode.SUPERINTENDENT_AINCHARGE, code: "S-121-B-2026", version: "2026.1", title: "Superintendent / Assistant Incharge", languageMode: LanguageMode.BILINGUAL, requiresCountersigning: true, pageCount: 4 } }),
    drivers: await prisma.templateVersion.create({ data: { family: TemplateFamilyCode.CAR_DRIVERS_DESPATCH_RIDERS, code: "S-121-F-2026", version: "2026.1", title: "Car Drivers / Despatch Riders", languageMode: LanguageMode.BILINGUAL, requiresCountersigning: true, pageCount: 7 } }),
    per1718: await prisma.templateVersion.create({ data: { family: TemplateFamilyCode.PER_17_18_OFFICERS, code: "PER-17-18-2026", version: "2026.1", title: "BPS 17 & 18 Officers PER", languageMode: LanguageMode.BILINGUAL, requiresCountersigning: true, pageCount: 11 } }),
  };

  await prisma.secretBranchRoutingRule.createMany({
    data: [
      { templateFamily: TemplateFamilyCode.ASSISTANT_UDC_LDC, reviewDeskCode: SecretBranchDeskCode.DA1, verificationDeskCode: SecretBranchDeskCode.AD_SECRET_BRANCH },
      { templateFamily: TemplateFamilyCode.APS_STENOTYPIST, reviewDeskCode: SecretBranchDeskCode.DA2, verificationDeskCode: SecretBranchDeskCode.AD_SECRET_BRANCH },
      { templateFamily: TemplateFamilyCode.INSPECTOR_SI_ASI, reviewDeskCode: SecretBranchDeskCode.DA3, verificationDeskCode: SecretBranchDeskCode.AD_SECRET_BRANCH },
      { templateFamily: TemplateFamilyCode.SUPERINTENDENT_AINCHARGE, reviewDeskCode: SecretBranchDeskCode.DA4, verificationDeskCode: SecretBranchDeskCode.AD_SECRET_BRANCH },
      { templateFamily: TemplateFamilyCode.CAR_DRIVERS_DESPATCH_RIDERS, reviewDeskCode: SecretBranchDeskCode.DA2, verificationDeskCode: SecretBranchDeskCode.AD_SECRET_BRANCH },
      { templateFamily: TemplateFamilyCode.PER_17_18_OFFICERS, reviewDeskCode: SecretBranchDeskCode.DA4, verificationDeskCode: SecretBranchDeskCode.AD_SECRET_BRANCH },
    ],
  });

  const employees = {
    fatima: await prisma.employee.create({
      data: {
        userId: users.fatimaUser.id,
        serviceNumber: "EMP-1001",
        name: "Fatima Zahra",
        rank: "Upper Division Clerk",
        designation: "UDC",
        positionTitle: "UDC",
        bps: 9,
        cnic: "61101-3333333-2",
        mobile: "0345-3333333",
        email: "fatima.zahra.employee@fia.gov.pk",
        posting: "FIA Headquarters Islamabad",
        joiningDate: dateAt("2018-03-12"),
        serviceYears: serviceYears(dateAt("2018-03-12")),
        address: "G-11 Markaz, Islamabad",
        templateFamily: TemplateFamilyCode.ASSISTANT_UDC_LDC,
        scopeTrack: OrgScopeTrack.WING,
        wingId: adminWing.id,
        directorateId: secretDirectorate.id,
        officeId: hqOffice.id,
        departmentId: adminDepartment.id,
        reportingOfficerId: users.reporting.id,
        countersigningOfficerId: users.countersigning.id,
        // Metadata for ACR auto-fill
        gender: Gender.FEMALE,
        dateOfBirth: dateAt("1990-07-15"),
        fatherName: "Muhammad Zahra Khan",
        spouseName: "Usman Ali",
        basicPay: 32000,
        appointmentToBpsDate: dateAt("2018-03-12"),
        deputationType: DeputationType.DIRECT,
        serviceGroup: "Federal Government Service",
        educationLevel: EducationLevel.BA_BSC,
        qualifications: "B.A. (Economics), Allama Iqbal Open University",
        natureOfDuties: "Handling office correspondence, maintaining official records, typing and documentation, coordination with departments.",
        personnelNumber: "PER-HQ-9001",
        trainingCoursesText: "Basic Office Management (2019), Government Secretariat Training (2021)",
      },
    }),
    bilal: await prisma.employee.create({
      data: {
        userId: users.bilalUser.id,
        serviceNumber: "EMP-1002",
        name: "Bilal Hassan",
        rank: "Assistant",
        designation: "Assistant",
        positionTitle: "Assistant",
        bps: 15,
        cnic: "35202-1234567-1",
        mobile: "0300-1112223",
        email: "bilal.hassan.employee@fia.gov.pk",
        posting: "Lahore Regional Operations Office",
        joiningDate: dateAt("2016-06-01"),
        serviceYears: serviceYears(dateAt("2016-06-01")),
        address: "Model Town, Lahore",
        templateFamily: TemplateFamilyCode.SUPERINTENDENT_AINCHARGE,
        scopeTrack: OrgScopeTrack.REGIONAL,
        regionId: northRegion.id,
        zoneId: zoneByName.Lahore.id,
        circleId: lhrCircle.id,
        stationId: lhrStation.id,
        branchId: lhrBranch.id,
        officeId: lhrOffice.id,
        departmentId: opsDepartment.id,
        reportingOfficerId: users.reporting.id,
        countersigningOfficerId: users.countersigning.id,
        // Metadata for ACR auto-fill
        gender: Gender.MALE,
        dateOfBirth: dateAt("1988-11-20"),
        fatherName: "Ghulam Hassan",
        basicPay: 58000,
        appointmentToBpsDate: dateAt("2016-06-01"),
        deputationType: DeputationType.DIRECT,
        serviceGroup: "Federal Government Service",
        educationLevel: EducationLevel.MA_MSC,
        qualifications: "M.A. (Public Administration), University of the Punjab",
        natureOfDuties: "Supervising clerical staff, managing administrative workflows, coordinating with zone-level operations, processing personnel files.",
        personnelNumber: "PER-LHR-15002",
        trainingCoursesText: "Advanced Administration Course (2018), Anti-Corruption Awareness Workshop (2020), Digital Records Management (2022)",
      },
    }),
    hina: await prisma.employee.create({
      data: {
        userId: users.hinaUser.id,
        serviceNumber: "EMP-1003",
        name: "Hina Noor",
        rank: "Inspector",
        designation: "Inspector",
        positionTitle: "Inspector",
        bps: 16,
        cnic: "42101-1234567-8",
        mobile: "0300-1234567",
        email: "hina.noor.employee@fia.gov.pk",
        posting: "Karachi Seaport Office",
        joiningDate: dateAt("2015-08-18"),
        serviceYears: serviceYears(dateAt("2015-08-18")),
        address: "DHA Karachi",
        templateFamily: TemplateFamilyCode.INSPECTOR_SI_ASI,
        scopeTrack: OrgScopeTrack.REGIONAL,
        regionId: southRegion.id,
        zoneId: zoneByName.Karachi.id,
        circleId: khiCircle.id,
        stationId: khiStation.id,
        branchId: khiBranch.id,
        officeId: khiOffice.id,
        reportingOfficerId: users.reportingKarachi.id,
        countersigningOfficerId: users.countersigningKarachi.id,
        // Metadata for ACR auto-fill
        gender: Gender.FEMALE,
        dateOfBirth: dateAt("1986-04-03"),
        fatherName: "Noor Muhammad",
        spouseName: "Imran Akhtar",
        basicPay: 65000,
        appointmentToBpsDate: dateAt("2015-08-18"),
        deputationType: DeputationType.DIRECT,
        serviceGroup: "Police Service of Pakistan (PSP)",
        educationLevel: EducationLevel.MA_MSC,
        qualifications: "M.A. (Criminology), University of Karachi",
        natureOfDuties: "Investigation of financial crimes at seaport, coordination with customs and port authorities, supervision of sub-inspectors, preparation of investigation reports.",
        personnelNumber: "PER-KHI-16003",
        trainingCoursesText: "Basic Investigation Training (2015), Narcotics Investigation Course (2017), Anti-Human Trafficking Certification (2019), Financial Crime Investigation (2021)",
      },
    }),
    asma: await prisma.employee.create({
      data: {
        serviceNumber: "EMP-1004",
        name: "Asma Bibi",
        rank: "APS",
        designation: "APS",
        positionTitle: "APS",
        bps: 16,
        cnic: "17301-7654321-7",
        mobile: "0300-7654321",
        email: "asma.bibi@fia.gov.pk",
        posting: "Peshawar Regional Office",
        joiningDate: dateAt("2017-04-22"),
        serviceYears: serviceYears(dateAt("2017-04-22")),
        address: "University Town, Peshawar",
        templateFamily: TemplateFamilyCode.APS_STENOTYPIST,
        scopeTrack: OrgScopeTrack.REGIONAL,
        regionId: northRegion.id,
        zoneId: zoneByName.Peshawar.id,
        officeId: lhrOffice.id,
        reportingOfficerId: users.reporting.id,
        // Metadata for ACR auto-fill
        gender: Gender.FEMALE,
        dateOfBirth: dateAt("1992-09-10"),
        fatherName: "Abdul Rehman",
        basicPay: 63000,
        appointmentToBpsDate: dateAt("2017-04-22"),
        deputationType: DeputationType.DIRECT,
        serviceGroup: "Federal Government Service",
        educationLevel: EducationLevel.BA_BSC,
        qualifications: "B.A. (English), University of Peshawar; Diploma in Stenography",
        natureOfDuties: "Stenotyping, drafting official correspondence, maintaining confidential files, assisting senior officers with secretarial tasks.",
        personnelNumber: "PER-PSH-16004",
        trainingCoursesText: "Stenography Proficiency Course (2017), Secretariat Training (2019)",
      },
    }),
  };

  function employeeSnapshot(employee: typeof employees.fatima) {
    return {
      name: employee.name,
      posting: employee.posting,
      serviceNumber: employee.serviceNumber,
      capturedAt: new Date().toISOString(),
    } as Prisma.InputJsonValue;
  }

  const acrs = {
    draft: await prisma.acrRecord.create({
      data: {
        acrNo: `FIA/ACR/${currentFiscal.label}/ADM/001`,
        employeeId: employees.fatima.id,
        initiatedById: users.clerk.id,
        reportingOfficerId: users.reporting.id,
        countersigningOfficerId: users.countersigning.id,
        currentHolderId: users.clerk.id,
        templateVersionId: templateVersions.assistant.id,
        workflowState: AcrWorkflowState.DRAFT,
        statusLabel: "Draft",
        reportingPeriodFrom: currentFiscal.from,
        reportingPeriodTo: currentFiscal.to,
        dueDate: shiftDays(new Date(), 10),
        employeeMetadataSnapshot: employeeSnapshot(employees.fatima),
      },
    }),
    pendingReporting: await prisma.acrRecord.create({
      data: {
        acrNo: `FIA/ACR/${currentFiscal.label}/OPS/002`,
        employeeId: employees.bilal.id,
        initiatedById: users.clerk.id,
        reportingOfficerId: users.reporting.id,
        countersigningOfficerId: users.countersigning.id,
        currentHolderId: users.reporting.id,
        templateVersionId: templateVersions.superintendent.id,
        workflowState: AcrWorkflowState.PENDING_REPORTING,
        statusLabel: "Pending Reporting Officer",
        reportingPeriodFrom: currentFiscal.from,
        reportingPeriodTo: currentFiscal.to,
        dueDate: shiftDays(new Date(), 4),
        isPriority: true,
        employeeMetadataSnapshot: employeeSnapshot(employees.bilal),
      },
    }),
    pendingCountersigning: await prisma.acrRecord.create({
      data: {
        acrNo: `FIA/ACR/${currentFiscal.label}/OPS/003`,
        employeeId: employees.hina.id,
        initiatedById: users.clerk.id,
        reportingOfficerId: users.reportingKarachi.id,
        countersigningOfficerId: users.countersigningKarachi.id,
        currentHolderId: users.countersigningKarachi.id,
        templateVersionId: templateVersions.inspector.id,
        workflowState: AcrWorkflowState.PENDING_COUNTERSIGNING,
        statusLabel: "Pending Countersigning Officer",
        reportingPeriodFrom: currentFiscal.from,
        reportingPeriodTo: currentFiscal.to,
        dueDate: shiftDays(new Date(), 6),
        employeeMetadataSnapshot: employeeSnapshot(employees.hina),
      },
    }),
    pendingSecretReview: await prisma.acrRecord.create({
      data: {
        acrNo: `FIA/ACR/${currentFiscal.label}/OPS/004`,
        employeeId: employees.asma.id,
        initiatedById: users.clerk.id,
        reportingOfficerId: users.reporting.id,
        currentHolderId: users.da2.id,
        secretBranchAllocatedToId: users.da2.id,
        secretBranchDeskCode: SecretBranchDeskCode.DA2,
        secretBranchSubmittedAt: shiftDays(new Date(), -1),
        templateVersionId: templateVersions.aps.id,
        workflowState: AcrWorkflowState.PENDING_SECRET_BRANCH_REVIEW,
        statusLabel: "Pending Secret Branch Review",
        reportingPeriodFrom: currentFiscal.from,
        reportingPeriodTo: currentFiscal.to,
        dueDate: shiftDays(new Date(), 3),
        employeeMetadataSnapshot: employeeSnapshot(employees.asma),
      },
    }),
    pendingSecretVerification: await prisma.acrRecord.create({
      data: {
        acrNo: `FIA/ACR/${currentFiscal.label}/ADM/005`,
        employeeId: employees.fatima.id,
        initiatedById: users.clerk.id,
        reportingOfficerId: users.reporting.id,
        countersigningOfficerId: users.countersigning.id,
        currentHolderId: users.secretAdmin.id,
        secretBranchAllocatedToId: users.da1.id,
        secretBranchDeskCode: SecretBranchDeskCode.DA1,
        secretBranchSubmittedAt: shiftDays(new Date(), -2),
        secretBranchReviewedAt: shiftDays(new Date(), -1),
        templateVersionId: templateVersions.assistant.id,
        workflowState: AcrWorkflowState.PENDING_SECRET_BRANCH_VERIFICATION,
        statusLabel: "Pending Secret Branch Verification",
        reportingPeriodFrom: currentFiscal.from,
        reportingPeriodTo: currentFiscal.to,
        dueDate: shiftDays(new Date(), 2),
        employeeMetadataSnapshot: employeeSnapshot(employees.fatima),
      },
    }),
    returnedClerk: await prisma.acrRecord.create({
      data: {
        acrNo: `FIA/ACR/${currentFiscal.label}/OPS/006`,
        employeeId: employees.bilal.id,
        initiatedById: users.clerk.id,
        reportingOfficerId: users.reporting.id,
        countersigningOfficerId: users.countersigning.id,
        currentHolderId: users.clerk.id,
        templateVersionId: templateVersions.superintendent.id,
        workflowState: AcrWorkflowState.RETURNED_TO_CLERK,
        statusLabel: "Returned to Clerk",
        reportingPeriodFrom: currentFiscal.from,
        reportingPeriodTo: currentFiscal.to,
        dueDate: shiftDays(new Date(), 5),
        correctionRemarks: "Please correct clerk metadata.",
        returnToRole: UserRole.CLERK,
        returnedByRole: UserRole.REPORTING_OFFICER,
        employeeMetadataSnapshot: employeeSnapshot(employees.bilal),
      },
    }),
    returnedReporting: await prisma.acrRecord.create({
      data: {
        acrNo: `FIA/ACR/${currentFiscal.label}/OPS/007`,
        employeeId: employees.hina.id,
        initiatedById: users.clerk.id,
        reportingOfficerId: users.reportingKarachi.id,
        countersigningOfficerId: users.countersigningKarachi.id,
        currentHolderId: users.reportingKarachi.id,
        templateVersionId: templateVersions.inspector.id,
        workflowState: AcrWorkflowState.RETURNED_TO_REPORTING,
        statusLabel: "Returned to Reporting Officer",
        reportingPeriodFrom: currentFiscal.from,
        reportingPeriodTo: currentFiscal.to,
        dueDate: shiftDays(new Date(), 5),
        correctionRemarks: "Please revise reporting remarks.",
        returnToRole: UserRole.REPORTING_OFFICER,
        returnedByRole: UserRole.COUNTERSIGNING_OFFICER,
        employeeMetadataSnapshot: employeeSnapshot(employees.hina),
      },
    }),
    returnedCountersigning: await prisma.acrRecord.create({
      data: {
        acrNo: `FIA/ACR/${currentFiscal.label}/ADM/008`,
        employeeId: employees.fatima.id,
        initiatedById: users.clerk.id,
        reportingOfficerId: users.reporting.id,
        countersigningOfficerId: users.countersigning.id,
        currentHolderId: users.countersigning.id,
        templateVersionId: templateVersions.assistant.id,
        workflowState: AcrWorkflowState.RETURNED_TO_COUNTERSIGNING,
        statusLabel: "Returned to Countersigning Officer",
        reportingPeriodFrom: currentFiscal.from,
        reportingPeriodTo: currentFiscal.to,
        dueDate: shiftDays(new Date(), 4),
        correctionRemarks: "Please update countersigning remarks.",
        returnToRole: UserRole.COUNTERSIGNING_OFFICER,
        returnedByRole: UserRole.SECRET_BRANCH,
        employeeMetadataSnapshot: employeeSnapshot(employees.fatima),
      },
    }),
    archived: await prisma.acrRecord.create({
      data: {
        acrNo: `FIA/ACR/${currentFiscal.label}/ADM/009`,
        employeeId: employees.fatima.id,
        initiatedById: users.clerk.id,
        reportingOfficerId: users.reporting.id,
        countersigningOfficerId: users.countersigning.id,
        currentHolderId: users.secretAdmin.id,
        secretBranchAllocatedToId: users.da1.id,
        secretBranchVerifiedById: users.secretAdmin.id,
        secretBranchDeskCode: SecretBranchDeskCode.DA1,
        secretBranchSubmittedAt: shiftDays(new Date(), -9),
        secretBranchReviewedAt: shiftDays(new Date(), -8),
        secretBranchVerifiedAt: shiftDays(new Date(), -7),
        templateVersionId: templateVersions.assistant.id,
        workflowState: AcrWorkflowState.ARCHIVED,
        statusLabel: "Archived",
        reportingPeriodFrom: currentFiscal.from,
        reportingPeriodTo: currentFiscal.to,
        dueDate: shiftDays(new Date(), -7),
        completedDate: shiftDays(new Date(), -7),
        archivedAt: shiftDays(new Date(), -7),
        performanceScore: 89,
        employeeMetadataSnapshot: employeeSnapshot(employees.fatima),
      },
    }),
  };

  const workflowArchive = await prisma.archiveRecord.create({
    data: {
      employeeId: employees.fatima.id,
      acrRecordId: acrs.archived.id,
      source: ArchiveRecordSource.WORKFLOW_FINAL,
      scopeTrack: employees.fatima.scopeTrack,
      templateFamily: TemplateFamilyCode.ASSISTANT_UDC_LDC,
      reportingPeriodFrom: currentFiscal.from,
      reportingPeriodTo: currentFiscal.to,
      archiveReference: `archive/${acrs.archived.acrNo.replaceAll("/", "-")}.pdf`,
      positionTitle: employees.fatima.positionTitle,
      employeeName: employees.fatima.name,
      employeeServiceNumber: employees.fatima.serviceNumber,
      employeeCnic: employees.fatima.cnic,
      employeePosting: employees.fatima.posting,
      wingId: employees.fatima.wingId,
      directorateId: employees.fatima.directorateId,
      zoneId: employees.fatima.zoneId,
      officeId: employees.fatima.officeId,
      departmentId: employees.fatima.departmentId,
      organizationSnapshot: { scopeTrack: "WING", wing: "Administration Wing", directorate: "Secret Branch Directorate", office: "FIA Headquarters Islamabad", department: "Administration" } as Prisma.InputJsonValue,
      documentPath: `archive/${acrs.archived.acrNo.replaceAll("/", "-")}.pdf`,
      uploadedById: users.da1.id,
      verifiedById: users.secretAdmin.id,
      verifiedAt: shiftDays(new Date(), -7),
      isVerified: true,
    },
  });

  const historicalBilal = await prisma.archiveRecord.create({
    data: {
      employeeId: employees.bilal.id,
      source: ArchiveRecordSource.HISTORICAL_UPLOAD,
      scopeTrack: employees.bilal.scopeTrack,
      templateFamily: TemplateFamilyCode.SUPERINTENDENT_AINCHARGE,
      reportingPeriodFrom: previousFiscal.from,
      reportingPeriodTo: previousFiscal.to,
      archiveReference: `HIST-${previousFiscal.label}-BILAL`,
      positionTitle: employees.bilal.positionTitle,
      employeeName: employees.bilal.name,
      employeeServiceNumber: employees.bilal.serviceNumber,
      employeeCnic: employees.bilal.cnic,
      employeePosting: employees.bilal.posting,
      wingId: employees.bilal.wingId,
      directorateId: employees.bilal.directorateId,
      regionId: employees.bilal.regionId,
      zoneId: employees.bilal.zoneId,
      circleId: employees.bilal.circleId,
      stationId: employees.bilal.stationId,
      branchId: employees.bilal.branchId,
      officeId: employees.bilal.officeId,
      departmentId: employees.bilal.departmentId,
      organizationSnapshot: { scopeTrack: "REGIONAL", region: "North Region", zone: "Lahore", circle: "Lahore Operational Circle", station: "Lahore Main Station", branch: "Lahore Operations Branch", office: "Lahore Regional Operations Office" } as Prisma.InputJsonValue,
      documentPath: "archive/history-bilal-2025.pdf",
      uploadedById: users.secretAdmin.id,
      verifiedById: users.secretAdmin.id,
      verifiedAt: shiftDays(new Date(), -40),
      isVerified: true,
    },
  });

  const historicalHina = await prisma.archiveRecord.create({
    data: {
      employeeId: employees.hina.id,
      source: ArchiveRecordSource.HISTORICAL_UPLOAD,
      scopeTrack: employees.hina.scopeTrack,
      templateFamily: TemplateFamilyCode.INSPECTOR_SI_ASI,
      reportingPeriodFrom: previousFiscal.from,
      reportingPeriodTo: previousFiscal.to,
      archiveReference: `HIST-${previousFiscal.label}-HINA`,
      positionTitle: employees.hina.positionTitle,
      employeeName: employees.hina.name,
      employeeServiceNumber: employees.hina.serviceNumber,
      employeeCnic: employees.hina.cnic,
      employeePosting: employees.hina.posting,
      wingId: employees.hina.wingId,
      directorateId: employees.hina.directorateId,
      regionId: employees.hina.regionId,
      zoneId: employees.hina.zoneId,
      circleId: employees.hina.circleId,
      stationId: employees.hina.stationId,
      branchId: employees.hina.branchId,
      officeId: employees.hina.officeId,
      organizationSnapshot: { scopeTrack: "REGIONAL", region: "South Region", zone: "Karachi", circle: "Karachi Seaport Circle", station: "Seaport Station Karachi", branch: "Karachi Operations Branch", office: "Karachi Seaport Office" } as Prisma.InputJsonValue,
      documentPath: "archive/history-hina-2025.pdf",
      uploadedById: users.secretAdmin.id,
      isVerified: false,
    },
  });

  await prisma.fileAsset.createMany({
    data: [
      { acrRecordId: acrs.archived.id, archiveRecordId: workflowArchive.id, uploadedById: users.secretAdmin.id, kind: "DOCUMENT", fileName: "fatima-archived.pdf", mimeType: "application/pdf", storagePath: workflowArchive.documentPath },
      { archiveRecordId: historicalBilal.id, uploadedById: users.secretAdmin.id, kind: "DOCUMENT", fileName: "bilal-history-2025.pdf", mimeType: "application/pdf", storagePath: historicalBilal.documentPath },
      { archiveRecordId: historicalHina.id, uploadedById: users.secretAdmin.id, kind: "DOCUMENT", fileName: "hina-history-2025.pdf", mimeType: "application/pdf", storagePath: historicalHina.documentPath },
    ],
  });

  await prisma.archiveSnapshot.create({
    data: {
      acrRecordId: acrs.archived.id,
      archivedById: users.secretAdmin.id,
      documentPath: workflowArchive.documentPath,
      checksum: `${acrs.archived.id}-checksum`,
      immutableHash: `${acrs.archived.id}-immutable`,
    },
  });

  await prisma.acrTimelineEntry.createMany({
    data: [
      { acrRecordId: acrs.draft.id, actorId: users.clerk.id, actorRole: "Clerk", action: "Draft Created", status: "completed" },
      { acrRecordId: acrs.pendingReporting.id, actorId: users.clerk.id, actorRole: "Clerk", action: "Submitted to Reporting Officer", status: "completed" },
      { acrRecordId: acrs.pendingCountersigning.id, actorId: users.reportingKarachi.id, actorRole: "Reporting Officer", action: "Forwarded to Countersigning Officer", status: "completed" },
      { acrRecordId: acrs.pendingSecretReview.id, actorId: users.reporting.id, actorRole: "Reporting Officer", action: "Submitted to Secret Branch", status: "completed" },
      { acrRecordId: acrs.pendingSecretVerification.id, actorId: users.da1.id, actorRole: "Secret Branch", action: "Secret Branch review completed", status: "completed" },
      { acrRecordId: acrs.returnedClerk.id, actorId: users.reporting.id, actorRole: "Reporting Officer", action: "Returned to Clerk", status: "returned", remarks: "Please correct clerk metadata." },
      { acrRecordId: acrs.returnedReporting.id, actorId: users.countersigningKarachi.id, actorRole: "Countersigning Officer", action: "Returned to Reporting Officer", status: "returned", remarks: "Please revise reporting remarks." },
      { acrRecordId: acrs.returnedCountersigning.id, actorId: users.secretAdmin.id, actorRole: "Secret Branch", action: "Returned to Countersigning Officer", status: "returned", remarks: "Please update countersigning remarks." },
      { acrRecordId: acrs.archived.id, actorId: users.secretAdmin.id, actorRole: "Secret Branch", action: "Secret Branch verification completed", status: "completed" },
    ],
  });

  await prisma.notification.createMany({
    data: [
      { userId: users.reporting.id, acrRecordId: acrs.pendingReporting.id, type: "INFO", title: "Priority ACR Awaiting Review", message: "Bilal Hassan's ACR is pending reporting review." },
      { userId: users.da2.id, acrRecordId: acrs.pendingSecretReview.id, type: "INFO", title: "Secret Branch Review Queue", message: "An APS record is waiting on DA2 review." },
      { userId: users.secretAdmin.id, acrRecordId: acrs.pendingSecretVerification.id, type: "WARNING", title: "Verification Required", message: "One ACR is pending Assistant Director Secret Branch verification." },
      { userId: users.fatimaUser.id, acrRecordId: acrs.archived.id, type: "SUCCESS", title: "ACR Archived", message: "Your latest ACR has been archived." },
    ],
  });

  await prisma.auditLog.createMany({
    data: [
      { actorId: users.superAdmin.id, actorRole: "Super Admin", action: "Seed bootstrap", recordType: "SYSTEM", recordId: "seed", ipAddress: "10.10.14.22", details: "Phase-2 seed data initialized." },
      { actorId: users.secretAdmin.id, actorRole: "Secret Branch", action: "Historical archive upload", recordType: "ARCHIVE", recordId: historicalBilal.id, ipAddress: "10.10.14.22", details: "Historical Bilal Hassan archive PDF registered." },
    ],
  });

  await prisma.adminSetting.createMany({
    data: [
      { key: "workflow.due_days.reporting", value: 10, updatedById: users.superAdmin.id },
      { key: "workflow.due_days.countersigning", value: 7, updatedById: users.superAdmin.id },
      { key: "workflow.due_days.secret_branch_review", value: 5, updatedById: users.superAdmin.id },
      { key: "workflow.due_days.secret_branch_verification", value: 3, updatedById: users.superAdmin.id },
      { key: "employee.self_service_enabled", value: true, updatedById: users.superAdmin.id },
      { key: "forgot_password.enabled", value: true, updatedById: users.superAdmin.id },
      {
        key: "fia.abbreviations",
        value: JSON.stringify({
          ACC: "Anti-Corruption Circle",
          Accts: "Accounts",
          ACW: "Anti-Corruption Wing",
          Admn: "Administration",
          AHS: "Anti-Human Smuggling",
          AHTC: "Anti-Human Trafficking Circle",
          "AML-CFT": "Anti-Money Laundering - Counter-Financing of Terrorism",
          ATU: "Anti-Trafficking Unit",
          AWL: "Analysis and Watch List",
          CBC: "Commercial Banking Circle",
          CCC: "Corporate Crime Circle",
          CCRC: "Cyber Crime Reporting Centre",
          CCRO: "Central Crime Record Office",
          CCW: "Cyber Crime Wing",
          "CMS-M": "Case Management System - Monitoring",
          CMU: "Complaint Management Unit",
          COS: "Chief of Staff",
          CTW: "Counter-Terrorism Wing",
          DBMS: "Data Base Management System",
          DEO: "Data Entry Operator",
          Dev: "Development",
          DP: "Departmental Proceedings",
          EGOA: "Electricity, Gas and Oil Anti-Theft Unit",
          Engg: "Engineering",
          HRM: "Human Resource Management",
          "I&E": "Inspection & Evaluation",
          "I&M": "Inspection & Monitoring",
          IBMS: "Integrated Border Management System",
          IPR: "Intellectual Property Rights",
          Log: "Logistics",
          NCB: "National Central Bureau",
          Ops: "Operations",
          "P&C": "Policy & Coordination",
          PAC: "Public Accounts Committee",
          PIAB: "Performance and Internal Accountability Branch",
          "Q.A.O": "Quality Assurance Officer",
          SBC: "State Bank Circle",
          Sec: "Security",
          "SM&S": "System Management & Security",
          Tech: "Technical",
          TPT: "Transport and Telephone",
          Trg: "Training",
        }),
        updatedById: users.superAdmin.id,
      },
      {
        key: "reference.postings",
        value: JSON.stringify([
          "FIA Headquarters Islamabad",
          "Anti-Corruption Circle",
          "Commercial Banking Circle",
          "Corporate Crime Circle",
          "State Bank Circle",
          "Anti-Human Trafficking Circle",
          "Immigration",
          "Anti-Human Smuggling",
          "Cyber Crime Reporting Centre",
          "Anti-Trafficking Unit",
          "Administration Wing",
          "Human Resource Management",
          "Training Wing",
          "Technical Wing",
          "IBMS Wing",
          "NCB-Interpol",
          "Counter-Terrorism Wing",
          "Anti-Money Laundering Wing",
          "Anti-Corruption Wing",
          "Inspection & Monitoring",
          "Secret Cell",
          "Accounts Section",
          "Logistics Section",
          "Security Section",
          "PIAB",
          "Engineering Section",
          "Budget & Finance",
          "Transport Section",
          "Inspection & Evaluation",
          "Complaint Management Unit",
          "Policy & Coordination",
          "Departmental Proceedings",
        ]),
        updatedById: users.superAdmin.id,
      },
      {
        key: "reference.zones_circles",
        value: JSON.stringify([
          "Islamabad Zone",
          "Lahore Zone",
          "Karachi Zone",
          "Peshawar Zone",
          "Faisalabad Zone",
          "Multan Zone",
          "Gujrat Zone",
          "Balochistan Zone",
          "Sukkur Zone",
          "Hyderabad Zone",
          "Kohat Zone",
          "Islamabad Airport Circle",
          "Lahore Operational Circle",
          "Karachi Seaport Circle",
          "Anti-Corruption Circle",
          "Commercial Banking Circle",
          "Corporate Crime Circle",
          "State Bank Circle",
          "Anti-Human Trafficking Circle",
          "Cyber Crime Circle",
          "Immigration Circle",
        ]),
        updatedById: users.superAdmin.id,
      },
    ],
  });

  // --- Authority Matrix Rules (FIA Standing Order No. 02/2023, Pages 3-9) ---
  await prisma.authorityMatrixRule.createMany({
    data: [
      // HQ - DG Office
      { unitType: "HQ", wingCode: "DG_OFFICE", postTitle: "COS to DG FIA", reportingAuthorityTitle: "DG FIA", countersigningAuthorityTitle: null, priority: 10 },
      { unitType: "HQ", wingCode: "DG_OFFICE", postTitle: "PS to DG FIA", reportingAuthorityTitle: "COS", countersigningAuthorityTitle: "DG FIA", priority: 10 },
      { unitType: "HQ", wingCode: "DG_OFFICE", postTitle: "PSO to DG FIA", reportingAuthorityTitle: "COS to DG FIA", countersigningAuthorityTitle: "DG FIA", priority: 10 },
      { unitType: "HQ", wingCode: "DG_OFFICE", postTitle: "*", bpsMin: 1, bpsMax: 16, reportingAuthorityTitle: "PS to DG FIA", countersigningAuthorityTitle: "COS to DG FIA", priority: 5 },

      // HQ - ADG Office
      { unitType: "HQ", wingCode: "ADG_HQ", postTitle: "ADG (HQ) FIA", reportingAuthorityTitle: "DG FIA", countersigningAuthorityTitle: "Secretary MoI", priority: 10 },
      { unitType: "HQ", wingCode: "ADG_HQ", postTitle: "*", bpsMin: 1, bpsMax: 16, reportingAuthorityTitle: "PS to ADG (HQ)", countersigningAuthorityTitle: "ADG (HQ)", priority: 5 },

      // Training Wing
      { unitType: "HQ", wingCode: "TRAINING", postTitle: "Director (Training)", reportingAuthorityTitle: "ADG (HQ)", countersigningAuthorityTitle: "DG FIA", priority: 10 },
      { unitType: "HQ", wingCode: "TRAINING", postTitle: "Additional/Deputy Director (Trg)", reportingAuthorityTitle: "Director (Trg)", countersigningAuthorityTitle: "ADG (HQ)", priority: 10 },
      { unitType: "HQ", wingCode: "TRAINING", postTitle: "Assistant Director (Trg)", reportingAuthorityTitle: "Additional/Deputy Director (Trg)", countersigningAuthorityTitle: "Director (Trg)", priority: 10 },
      { unitType: "HQ", wingCode: "TRAINING", postTitle: "*", bpsMin: 1, bpsMax: 16, reportingAuthorityTitle: "Additional/Deputy Director (Trg)", countersigningAuthorityTitle: "Director (Trg)", priority: 5 },

      // FIA Zonal Offices
      { unitType: "ZONAL", postTitle: "Director FIA Zones", reportingAuthorityTitle: "ADG (North/South)", countersigningAuthorityTitle: "DG FIA", priority: 10 },
      { unitType: "ZONAL", postTitle: "Additional/Deputy Director", reportingAuthorityTitle: "Director Zone", countersigningAuthorityTitle: "ADG (North/South)", priority: 8 },
      { unitType: "ZONAL", postTitle: "Assistant Director", reportingAuthorityTitle: "Respective Additional/Deputy Director", countersigningAuthorityTitle: "Director Zone", priority: 8 },
      { unitType: "ZONAL", postTitle: "*", bpsMin: 14, bpsMax: 16, reportingAuthorityTitle: "Respective Additional/Deputy Director", countersigningAuthorityTitle: "Director Zone", priority: 5 },
      { unitType: "ZONAL", postTitle: "*", bpsMin: 1, bpsMax: 13, reportingAuthorityTitle: "Respective Assistant/Deputy Director", countersigningAuthorityTitle: "Respective Deputy Director/Director Zone", priority: 5 },

      // Cyber Crime Wing
      { unitType: "HQ", wingCode: "CCW", postTitle: "ADG (CCW)", reportingAuthorityTitle: "DG FIA", countersigningAuthorityTitle: "Secretary MoI", priority: 10 },
      { unitType: "HQ", wingCode: "CCW", postTitle: "Director (Ops/Admn)", reportingAuthorityTitle: "ADG (CCW)", countersigningAuthorityTitle: "DG FIA", priority: 10 },
      { unitType: "HQ", wingCode: "CCW", postTitle: "Additional/Deputy Director", reportingAuthorityTitle: "Director (Admn/Ops)", countersigningAuthorityTitle: "ADG (CCW)", priority: 8 },
      { unitType: "HQ", wingCode: "CCW", postTitle: "*", bpsMin: 1, bpsMax: 16, reportingAuthorityTitle: "Deputy/Assistant Director", countersigningAuthorityTitle: "Additional Director/Director", priority: 5 },

      // Administration Wing
      { unitType: "HQ", wingCode: "ADMN", postTitle: "Director (Administration)", reportingAuthorityTitle: "ADG (HQ)", countersigningAuthorityTitle: "DG FIA", priority: 10 },
      { unitType: "HQ", wingCode: "ADMN", postTitle: "Deputy Director", reportingAuthorityTitle: "Director (Admn)", countersigningAuthorityTitle: "ADG (HQ)", priority: 8 },
      { unitType: "HQ", wingCode: "ADMN", postTitle: "Assistant Director", reportingAuthorityTitle: "Respective Deputy Director", countersigningAuthorityTitle: "Director (Admn)", priority: 8 },
      { unitType: "HQ", wingCode: "ADMN", postTitle: "*", bpsMin: 1, bpsMax: 16, reportingAuthorityTitle: "Respective Deputy Director", countersigningAuthorityTitle: "Director (Admn)", priority: 5 },

      // HRM Wing
      { unitType: "HQ", wingCode: "HRM", postTitle: "Director (HRM)", reportingAuthorityTitle: "ADG (HQ)", countersigningAuthorityTitle: "DG FIA", priority: 10 },
      { unitType: "HQ", wingCode: "HRM", postTitle: "Additional Director (HRM)", reportingAuthorityTitle: "Director (HRM)", countersigningAuthorityTitle: "ADG (HQ)", priority: 10 },
      { unitType: "HQ", wingCode: "HRM", postTitle: "Deputy Director (HRM)", reportingAuthorityTitle: "Additional Director (HRM)", countersigningAuthorityTitle: "Director (HRM)", priority: 8 },
      { unitType: "HQ", wingCode: "HRM", postTitle: "Deputy Director (PIAB)", reportingAuthorityTitle: "Additional Director (HRM)", countersigningAuthorityTitle: "Director (HRM)", priority: 8 },
      { unitType: "HQ", wingCode: "HRM", postTitle: "*", bpsMin: 1, bpsMax: 16, reportingAuthorityTitle: "Respective Assistant Director", countersigningAuthorityTitle: "Respective Deputy Director", priority: 5 },

      // Immigration Wing
      { unitType: "HQ", wingCode: "IMMIGRATION", postTitle: "ADG (Immigration)", reportingAuthorityTitle: "DG FIA", countersigningAuthorityTitle: "Secretary MoI", priority: 10 },
      { unitType: "HQ", wingCode: "IMMIGRATION", postTitle: "Director (Immigration/AHS/Liaison)", reportingAuthorityTitle: "ADG (Immigration)", countersigningAuthorityTitle: "DG FIA", priority: 10 },
      { unitType: "HQ", wingCode: "IMMIGRATION", postTitle: "Additional/Deputy Director", reportingAuthorityTitle: "Director (Immigration/AHS/Liaison)", countersigningAuthorityTitle: "ADG (Immigration)", priority: 8 },
      { unitType: "HQ", wingCode: "IMMIGRATION", postTitle: "*", bpsMin: 1, bpsMax: 16, reportingAuthorityTitle: "Assistant Director", countersigningAuthorityTitle: "Deputy Director", priority: 5 },

      // ACW Wing
      { unitType: "HQ", wingCode: "ACW", postTitle: "ADG (ACW)", reportingAuthorityTitle: "DG FIA", countersigningAuthorityTitle: "Secretary MoI", priority: 10 },
      { unitType: "HQ", wingCode: "ACW", postTitle: "Director (ACW/I&E)", reportingAuthorityTitle: "ADG (ACW)", countersigningAuthorityTitle: "DG FIA", priority: 10 },
      { unitType: "HQ", wingCode: "ACW", postTitle: "Additional/Deputy Director", reportingAuthorityTitle: "Director (ACW/I&E)", countersigningAuthorityTitle: "ADG (ACW)", priority: 8 },
      { unitType: "HQ", wingCode: "ACW", postTitle: "*", bpsMin: 1, bpsMax: 16, reportingAuthorityTitle: "Respective Assistant Director", countersigningAuthorityTitle: "Respective Additional/Deputy Director", priority: 5 },

      // AML-CFT Wing
      { unitType: "HQ", wingCode: "AML_CFT", postTitle: "ADG (AML-CFT)", reportingAuthorityTitle: "DG FIA", countersigningAuthorityTitle: "Secretary MoI", priority: 10 },
      { unitType: "HQ", wingCode: "AML_CFT", postTitle: "Director (AML)", reportingAuthorityTitle: "ADG (AML-CFT)", countersigningAuthorityTitle: "DG FIA", priority: 10 },
      { unitType: "HQ", wingCode: "AML_CFT", postTitle: "*", bpsMin: 1, bpsMax: 16, reportingAuthorityTitle: "Assistant Director (AML)", countersigningAuthorityTitle: "Deputy Director (AML)", priority: 5 },

      // CTW Wing
      { unitType: "HQ", wingCode: "CTW", postTitle: "Director (CTW)", reportingAuthorityTitle: "ADG (AML-CFT)", countersigningAuthorityTitle: "DG FIA", priority: 10 },
      { unitType: "HQ", wingCode: "CTW", postTitle: "Additional Director (CTW)", reportingAuthorityTitle: "Director (CTW)", countersigningAuthorityTitle: "ADG (AML/CFT)", priority: 10 },
      { unitType: "HQ", wingCode: "CTW", postTitle: "*", bpsMin: 1, bpsMax: 16, reportingAuthorityTitle: "Assistant Director/Deputy Director (Admn CTW)", countersigningAuthorityTitle: "Addl. Director/Deputy Director (CTW)", priority: 5 },

      // NCB-Interpol
      { unitType: "HQ", wingCode: "NCB_INTERPOL", postTitle: "Director (NCB-Interpol)", reportingAuthorityTitle: "DG FIA", countersigningAuthorityTitle: "Secretary MoI", priority: 10 },
      { unitType: "HQ", wingCode: "NCB_INTERPOL", postTitle: "*", bpsMin: 14, bpsMax: 20, reportingAuthorityTitle: "Deputy Director (NCB-Interpol)", countersigningAuthorityTitle: "Director (NCB-Interpol)", priority: 5 },
      { unitType: "HQ", wingCode: "NCB_INTERPOL", postTitle: "*", bpsMin: 1, bpsMax: 13, reportingAuthorityTitle: "Respective Assistant Director", countersigningAuthorityTitle: "Additional/Deputy Director (NCB-Interpol)", priority: 5 },

      // IBMS Wing
      { unitType: "HQ", wingCode: "IBMS", postTitle: "Director (IBMS)", reportingAuthorityTitle: "ADG (Immigration)", countersigningAuthorityTitle: "DG FIA", priority: 10 },
      { unitType: "HQ", wingCode: "IBMS", postTitle: "*", bpsMin: 1, bpsMax: 16, reportingAuthorityTitle: "Deputy Director (Networks/AWL/DBMS/SM&S/Dev)", countersigningAuthorityTitle: "Director (IBMS)", priority: 5 },

      // Technical Wing
      { unitType: "HQ", wingCode: "TECHNICAL", postTitle: "Director (Technical)", reportingAuthorityTitle: "ADG (HQ)", countersigningAuthorityTitle: "DG FIA", priority: 10 },
      { unitType: "HQ", wingCode: "TECHNICAL", postTitle: "*", bpsMin: 1, bpsMax: 16, reportingAuthorityTitle: "Additional/Deputy Director (Technical)", countersigningAuthorityTitle: "Director (Technical)", priority: 5 },

      // IPR
      { unitType: "HQ", wingCode: "IPR", postTitle: "Additional/Deputy Director (IPR)", reportingAuthorityTitle: "Director (Technical)", countersigningAuthorityTitle: "ADG (HQ)", priority: 10 },
      { unitType: "HQ", wingCode: "IPR", postTitle: "*", bpsMin: 1, bpsMax: 16, reportingAuthorityTitle: "Assistant Director (IPR)", countersigningAuthorityTitle: "Additional/Deputy Director (IPR)", priority: 5 },

      // ADG Law
      { unitType: "HQ", wingCode: "LAW", postTitle: "ADG (Law)", reportingAuthorityTitle: "DG FIA", countersigningAuthorityTitle: "Secretary MoI", priority: 10 },
      { unitType: "HQ", wingCode: "LAW", postTitle: "Director (Ops/P&C)", reportingAuthorityTitle: "ADG (Law)", countersigningAuthorityTitle: "DG FIA", priority: 10 },
      { unitType: "HQ", wingCode: "LAW", postTitle: "*", bpsMin: 1, bpsMax: 16, reportingAuthorityTitle: "Assistant Director (Ops/P&C)", countersigningAuthorityTitle: "Deputy Director (Ops/P&C)", priority: 5 },

      // Private Secretary / Stenographers - universal rule
      { unitType: "ANY", postTitle: "Private Secretary", reportingAuthorityTitle: "To whom attached", countersigningAuthorityTitle: null, priority: 3 },
      { unitType: "ANY", postTitle: "Assistant Private Secretary", reportingAuthorityTitle: "To whom attached", countersigningAuthorityTitle: null, priority: 3 },
      { unitType: "ANY", postTitle: "Stenographer", reportingAuthorityTitle: "To whom attached", countersigningAuthorityTitle: null, priority: 3 },
    ],
  });

  console.info("Smart ACR phase-2 seed completed.");
  console.info(`Demo password for all accounts: ${DEMO_PASSWORD}`);
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
