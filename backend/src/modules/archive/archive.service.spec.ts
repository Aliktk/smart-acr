import { ArchiveRecordSource, OrgScopeTrack, TemplateFamilyCode, UserRole } from "@prisma/client";
import { ArchiveService } from "./archive.service";
import { loadScopedUser } from "../../helpers/security.utils";

jest.mock("../../helpers/security.utils", () => {
  const actual = jest.requireActual("../../helpers/security.utils");
  return {
    ...actual,
    loadScopedUser: jest.fn(),
  };
});

const mockedLoadScopedUser = loadScopedUser as jest.MockedFunction<typeof loadScopedUser>;

type ArchiveEmployeeFixture = {
  id: string;
  userId: string;
  serviceNumber: string;
  name: string;
  rank: string;
  designation: string;
  positionTitle: string;
  bps: number;
  cnic: string;
  mobile: string;
  email: string;
  scopeTrack: OrgScopeTrack;
  wingId: string;
  directorateId: string | null;
  regionId: string;
  zoneId: string;
  circleId: string | null;
  stationId: string | null;
  branchId: string | null;
  cellId: string | null;
  officeId: string;
  departmentId: string;
  wing: { name: string };
  directorate: null;
  region: { name: string };
  zone: { name: string };
  circle: null;
  station: null;
  branch: null;
  cell: null;
  office: { name: string };
  department: { name: string };
  reportingOfficerId: string;
  countersigningOfficerId: string;
  reportingOfficer: {
    displayName: string;
    employeeProfiles: Array<{ designation: string }>;
  };
  countersigningOfficer: {
    displayName: string;
    employeeProfiles: Array<{ designation: string }>;
  };
  posting: string;
  joiningDate: Date;
  serviceYears: number;
  address: string;
  templateFamily: TemplateFamilyCode;
};

function buildActor(activeRole: UserRole) {
  return {
    id: "actor-1",
    displayName: "Nazia Ambreen",
    activeRole,
    roleAssignments: [{ role: activeRole }],
    activeAssignment: { role: activeRole, scopeTrack: OrgScopeTrack.WING, wingId: "wing-1" },
    employeeProfiles: [],
    secretBranchProfile: activeRole === UserRole.SECRET_BRANCH ? { isActive: true, canManageUsers: true, canVerify: true } : null,
  } as never;
}

function buildEmployee(): ArchiveEmployeeFixture {
  return {
    id: "employee-1",
    userId: "user-employee-1",
    serviceNumber: "FIA-2011-0042",
    name: "Bilal Ahmed",
    rank: "Inspector",
    designation: "Investigation Officer",
    positionTitle: "Inspector Investigation",
    bps: 16,
    cnic: "35202-1234567-1",
    mobile: "0300-1112233",
    email: "bilal.ahmed@fia.gov.pk",
    scopeTrack: OrgScopeTrack.REGIONAL,
    wingId: "wing-1",
    directorateId: null,
    regionId: "region-1",
    zoneId: "zone-1",
    circleId: null,
    stationId: null,
    branchId: null,
    cellId: null,
    officeId: "office-1",
    departmentId: "department-1",
    wing: { name: "Investigation Wing" },
    directorate: null,
    region: { name: "North Region" },
    zone: { name: "Islamabad Zone" },
    circle: null,
    station: null,
    branch: null,
    cell: null,
    office: { name: "Islamabad Field Office" },
    department: { name: "Operations" },
    reportingOfficerId: "reporting-1",
    countersigningOfficerId: "countersigning-1",
    reportingOfficer: {
      displayName: "Reporting Officer",
      employeeProfiles: [{ designation: "Deputy Director" }],
    },
    countersigningOfficer: {
      displayName: "Countersigning Officer",
      employeeProfiles: [{ designation: "Director" }],
    },
    posting: "Islamabad",
    joiningDate: new Date("2011-03-15T00:00:00.000Z"),
    serviceYears: 15,
    address: "FIA Colony, Islamabad",
    templateFamily: TemplateFamilyCode.INSPECTOR_SI_ASI,
  };
}

function buildArchiveRecord(overrides: Record<string, unknown> = {}) {
  const employee = (overrides.employee as ArchiveEmployeeFixture | undefined) ?? buildEmployee();

  return {
    id: "archive-1",
    source: ArchiveRecordSource.HISTORICAL_UPLOAD,
    scopeTrack: employee.scopeTrack,
    employeeId: employee.id,
    acrRecordId: null,
    employeeName: employee.name,
    employeeServiceNumber: employee.serviceNumber,
    employeeCnic: employee.cnic,
    employeePosting: employee.posting,
    templateFamily: employee.templateFamily,
    reportingPeriodFrom: new Date("2019-01-01T00:00:00.000Z"),
    reportingPeriodTo: new Date("2019-12-31T00:00:00.000Z"),
    archiveReference: "legacy-2019-001",
    documentPath: "archive-history/legacy-2019.pdf",
    positionTitle: employee.positionTitle,
    isVerified: false,
    remarks: "Scanned from physical archive register.",
    createdAt: new Date("2026-04-07T08:00:00.000Z"),
    verifiedAt: null,
    wingId: employee.wingId,
    directorateId: employee.directorateId,
    regionId: employee.regionId,
    zoneId: employee.zoneId,
    circleId: employee.circleId,
    stationId: employee.stationId,
    branchId: employee.branchId,
    cellId: employee.cellId,
    officeId: employee.officeId,
    departmentId: employee.departmentId,
    organizationSnapshot: {
      scopeTrack: employee.scopeTrack,
      wing: employee.wing.name,
      region: employee.region.name,
      zone: employee.zone.name,
      office: employee.office.name,
      department: employee.department.name,
    },
    employee,
    uploadedBy: { displayName: "Nazia Ambreen" },
    verifiedBy: null,
    files: [
      {
        id: "file-1",
        kind: "DOCUMENT",
        fileName: "legacy-2019.pdf",
        mimeType: "application/pdf",
        storagePath: "archive-history/legacy-2019.pdf",
      },
    ],
    ...overrides,
  } as never;
}

function createPrismaMock() {
  return {
    archiveRecord: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    },
    employee: {
      findUnique: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };
}

describe("ArchiveService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("uploads a historical PDF, links it to the employee and period, and audits the action", async () => {
    mockedLoadScopedUser.mockResolvedValue(buildActor(UserRole.SECRET_BRANCH));
    const prisma = createPrismaMock();
    const filesService = {
      recordFile: jest.fn().mockResolvedValue({
        storagePath: "archive-history/legacy-2019.pdf",
      }),
      deleteStoredFile: jest.fn(),
    };
    const employee = buildEmployee();
    const placeholder = buildArchiveRecord({
      archiveReference: null,
      documentPath: "pending-upload",
      files: [],
      employee,
    });
    const storedRecord = buildArchiveRecord({ employee });

    prisma.employee.findUnique.mockResolvedValue(employee);
    prisma.archiveRecord.create.mockResolvedValue(placeholder);
    prisma.archiveRecord.update.mockResolvedValue(storedRecord);
    prisma.auditLog.create.mockResolvedValue({ id: "audit-1" });

    const service = new ArchiveService(prisma as never, filesService as never);
    const file = { originalname: "legacy-2019.pdf", mimetype: "application/pdf" } as Express.Multer.File;
    const result = await service.uploadHistorical(
      "actor-1",
      UserRole.SECRET_BRANCH,
      {
        employeeId: employee.id,
        templateFamily: TemplateFamilyCode.INSPECTOR_SI_ASI,
        reportingPeriodFrom: "2019-01-01",
        reportingPeriodTo: "2019-12-31",
        archiveReference: "legacy-2019-001",
        remarks: "Scanned from physical archive register.",
      },
      file,
      "127.0.0.1",
    );

    expect(prisma.archiveRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          employeeId: employee.id,
          source: ArchiveRecordSource.HISTORICAL_UPLOAD,
          reportingPeriodFrom: new Date("2019-01-01"),
          reportingPeriodTo: new Date("2019-12-31"),
        }),
      }),
    );
    expect(filesService.recordFile).toHaveBeenCalledWith("actor-1", undefined, "DOCUMENT", file, "archive-1");
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "Historical archive uploaded",
          recordType: "ARCHIVE",
          ipAddress: "127.0.0.1",
        }),
      }),
    );
    expect(result).toMatchObject({
      employeeId: employee.id,
      reportingPeriodFrom: "2019-01-01",
      reportingPeriodTo: "2019-12-31",
      documentUrl: "/files/file-1/content",
    });
  });

  it("returns historical uploads in archive search results for archive admins", async () => {
    mockedLoadScopedUser.mockResolvedValue(buildActor(UserRole.SECRET_BRANCH));
    const prisma = createPrismaMock();
    const filesService = { recordFile: jest.fn(), deleteStoredFile: jest.fn() };
    prisma.archiveRecord.findMany.mockResolvedValue([buildArchiveRecord()]);
    prisma.archiveRecord.count.mockResolvedValue(1);

    const service = new ArchiveService(prisma as never, filesService as never);
    const result = await service.list("actor-1", UserRole.SECRET_BRANCH, {
      source: ArchiveRecordSource.HISTORICAL_UPLOAD,
      query: "legacy-2019-001",
    } as never);

    expect(prisma.archiveRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          source: ArchiveRecordSource.HISTORICAL_UPLOAD,
        }),
      }),
    );
    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({
      source: ArchiveRecordSource.HISTORICAL_UPLOAD,
      archiveReference: "legacy-2019-001",
      documentUrl: "/files/file-1/content",
    });
  });

  it("shows employee-safe historical metadata without exposing the confidential PDF", async () => {
    mockedLoadScopedUser.mockResolvedValue({
      id: "user-employee-1",
      activeRole: UserRole.EMPLOYEE,
      roleAssignments: [{ role: UserRole.EMPLOYEE }],
      activeAssignment: { role: UserRole.EMPLOYEE },
      employeeProfiles: [{ id: "employee-1" }],
      secretBranchProfile: null,
    } as never);
    const prisma = createPrismaMock();
    const filesService = { recordFile: jest.fn(), deleteStoredFile: jest.fn() };
    prisma.archiveRecord.findUnique.mockResolvedValue(buildArchiveRecord());

    const service = new ArchiveService(prisma as never, filesService as never);
    const result = await service.detail("user-employee-1", UserRole.EMPLOYEE, "archive-1");

    expect(result.reportingPeriod).toContain("2019");
    expect(result.archiveReference).toBeNull();
    expect(result.documentUrl).toBeNull();
    expect(result.documentFileId).toBeNull();
    expect(result.uploadedBy).toBeNull();
    expect(result.employeeCnic).toBeNull();
  });

  it("deletes a historical upload, removes linked files, and records the audit trail", async () => {
    mockedLoadScopedUser.mockResolvedValue(buildActor(UserRole.SECRET_BRANCH));
    const prisma = createPrismaMock();
    const filesService = {
      recordFile: jest.fn(),
      deleteStoredFile: jest.fn().mockResolvedValue(undefined),
    };
    const existing = buildArchiveRecord({
      files: [
        {
          id: "file-1",
          kind: "DOCUMENT",
          fileName: "legacy-2019.pdf",
          mimeType: "application/pdf",
          storagePath: "archive-history/legacy-2019.pdf",
        },
      ],
    });
    const tx = {
      fileAsset: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      archiveRecord: {
        delete: jest.fn().mockResolvedValue({ id: "archive-1" }),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: "audit-1" }),
      },
    };

    prisma.archiveRecord.findUnique.mockResolvedValue(existing);
    prisma.$transaction.mockImplementation(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx));

    const service = new ArchiveService(prisma as never, filesService as never);
    const result = await service.deleteHistorical("actor-1", UserRole.SECRET_BRANCH, "archive-1", "127.0.0.1");

    expect(tx.fileAsset.deleteMany).toHaveBeenCalledWith({ where: { archiveRecordId: "archive-1" } });
    expect(tx.archiveRecord.delete).toHaveBeenCalledWith({ where: { id: "archive-1" } });
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "Historical archive deleted",
          ipAddress: "127.0.0.1",
        }),
      }),
    );
    expect(filesService.deleteStoredFile).toHaveBeenCalledWith("archive-history/legacy-2019.pdf");
    expect(result).toEqual({ success: true });
  });
});
