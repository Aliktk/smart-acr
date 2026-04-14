import { ConflictException } from "@nestjs/common";
import { TemplateFamilyCode, UserRole } from "@prisma/client";
import { EmployeesService } from "./employees.service";

describe("EmployeesService", () => {
  const buildScopedUserRecord = () => ({
    id: "user-1",
    isActive: true,
    scopeTrack: "REGIONAL",
    wingId: "wing-1",
    directorateId: null,
    regionId: "region-1",
    zoneId: "zone-1",
    circleId: null,
    stationId: null,
    branchId: null,
    cellId: null,
    officeId: "office-1",
    wing: { id: "wing-1", name: "Administration Wing" },
    directorate: null,
    region: { id: "region-1", name: "North Region" },
    zone: { id: "zone-1", name: "Islamabad Zone" },
    circle: null,
    station: null,
    branch: null,
    cell: null,
    office: { id: "office-1", name: "FIA HQ" },
    department: null,
    employeeProfiles: [],
    roleAssignments: [
      {
        role: UserRole.CLERK,
        scopeTrack: "REGIONAL",
        wingId: "wing-1",
        directorateId: null,
        regionId: "region-1",
        zoneId: "zone-1",
        circleId: null,
        stationId: null,
        branchId: null,
        cellId: null,
        officeId: "office-1",
      },
    ],
  });

  const buildDepartmentScopedClerkRecord = () => ({
    ...buildScopedUserRecord(),
    scopeTrack: "WING",
    wingId: "wing-1",
    directorateId: "dir-1",
    regionId: null,
    zoneId: null,
    officeId: "office-1",
    department: { id: "department-1", name: "Administration" },
    roleAssignments: [
      {
        role: UserRole.CLERK,
        scopeTrack: "WING",
        wingId: "wing-1",
        directorateId: "dir-1",
        regionId: null,
        zoneId: null,
        circleId: null,
        stationId: null,
        branchId: null,
        cellId: null,
        officeId: "office-1",
        departmentId: "department-1",
      },
    ],
  });

  const buildOffice = () => ({
    id: "office-1",
    code: "HQ",
    name: "FIA HQ",
    scopeTrack: "REGIONAL",
    wingId: "wing-1",
    directorateId: null,
    regionId: "region-1",
    zoneId: "zone-1",
    circleId: null,
    stationId: null,
    branchId: null,
    cellId: null,
    wing: { name: "Administration Wing" },
    directorate: null,
    region: { name: "North Region" },
    zone: { name: "Islamabad Zone" },
    circle: null,
    station: null,
    branch: null,
    cell: null,
    departments: [],
  });

  const buildOfficerAssignment = (
    userId: string,
    displayName: string,
    overrides?: Partial<{
      officeId: string | null;
      zoneId: string | null;
      wingId: string | null;
      regionId: string | null;
      directorateId: string | null;
      badgeNo: string;
      officeName: string | null;
      zoneName: string | null;
      wingName: string | null;
      regionName: string | null;
    }>,
  ) => ({
    userId,
    role: displayName.includes("Countersigning")
      ? UserRole.COUNTERSIGNING_OFFICER
      : UserRole.REPORTING_OFFICER,
    scopeTrack: "REGIONAL",
    officeId: overrides?.officeId ?? "office-1",
    zoneId: overrides?.zoneId ?? "zone-1",
    wingId: overrides?.wingId ?? "wing-1",
    regionId: overrides?.regionId ?? "region-1",
    directorateId: overrides?.directorateId ?? null,
    circleId: null,
    stationId: null,
    branchId: null,
    cellId: null,
    departmentId: null,
    office: overrides?.officeName ? { name: overrides.officeName } : { name: "FIA HQ" },
    zone: overrides?.zoneName ? { name: overrides.zoneName } : { name: "Islamabad Zone" },
    wing: overrides?.wingName ? { name: overrides.wingName } : { name: "Administration Wing" },
    directorate: null,
    region: overrides?.regionName ? { name: overrides.regionName } : { name: "North Region" },
    circle: null,
    station: null,
    branch: null,
    cell: null,
    department: null,
    user: {
      id: userId,
      displayName,
      badgeNo: overrides?.badgeNo ?? `${userId.toUpperCase()}-BADGE`,
      office: overrides?.officeName ? { name: overrides.officeName } : { name: "FIA HQ" },
      zone: overrides?.zoneName ? { name: overrides.zoneName } : { name: "Islamabad Zone" },
      wing: overrides?.wingName ? { name: overrides.wingName } : { name: "Administration Wing" },
      directorate: null,
      region: overrides?.regionName ? { name: overrides.regionName } : { name: "North Region" },
      circle: null,
      station: null,
      branch: null,
      cell: null,
      department: null,
    },
  });

  const buildCreateDto = () => ({
    name: "  Muhammad Sarmad  ",
    rank: "  Superintendent  ",
    designation: "  Admin Officer  ",
    bps: 16,
    cnic: "6110133333332",
    mobile: " 0300-1234567 ",
    email: "  Muhammad.Sarmad@FIA.GOV.PK  ",
    posting: "  HQ Desk  ",
    joiningDate: "2020-02-10",
    address: "  Sector G-10, Islamabad  ",
    templateFamily: TemplateFamilyCode.ASSISTANT_UDC_LDC,
    officeId: "office-1",
    reportingOfficerId: "reporting-1",
    countersigningOfficerId: "countersigning-1",
  });

  const buildPortalScopedUserRecord = () => ({
    id: "user-employee-1",
    isActive: true,
    scopeTrack: "WING",
    wingId: "wing-1",
    directorateId: null,
    regionId: null,
    zoneId: null,
    circleId: null,
    stationId: null,
    branchId: null,
    cellId: null,
    officeId: "office-1",
    wing: { id: "wing-1", name: "Administration Wing" },
    directorate: null,
    region: null,
    zone: null,
    circle: null,
    station: null,
    branch: null,
    cell: null,
    office: { id: "office-1", name: "FIA HQ" },
    department: null,
    employeeProfiles: [{ id: "employee-portal-1" }],
    roleAssignments: [
      {
        role: UserRole.EMPLOYEE,
        scopeTrack: "WING",
        wingId: "wing-1",
        directorateId: null,
        regionId: null,
        zoneId: null,
        circleId: null,
        stationId: null,
        branchId: null,
        cellId: null,
        officeId: "office-1",
      },
    ],
  });

  const buildPortalEmployeeRecord = () => ({
    id: "employee-portal-1",
    userId: "user-employee-1",
    serviceNumber: "EMP-1001",
    name: "Fatima Zahra",
    rank: "UDC",
    designation: "UDC",
    positionTitle: "Upper Division Clerk",
    bps: 11,
    cnic: "61101-3333333-2",
    mobile: "0300-0000000",
    email: "fatima.employee@fia.gov.pk",
    posting: "Headquarters Desk",
    joiningDate: new Date("2020-02-10"),
    serviceYears: 6,
    address: "Islamabad",
    templateFamily: TemplateFamilyCode.ASSISTANT_UDC_LDC,
    scopeTrack: "WING",
    wingId: "wing-1",
    directorateId: null,
    regionId: null,
    zoneId: null,
    circleId: null,
    stationId: null,
    branchId: null,
    cellId: null,
    officeId: "office-1",
    departmentId: null,
    wing: { name: "Administration Wing" },
    directorate: null,
    region: null,
    zone: null,
    circle: null,
    station: null,
    branch: null,
    cell: null,
    office: { name: "FIA HQ" },
    department: null,
    reportingOfficer: { displayName: "Reporting Officer", employeeProfiles: [{ designation: "Deputy Director" }] },
    countersigningOfficer: { displayName: "Countersigning Officer", employeeProfiles: [{ designation: "Director" }] },
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns a readable conflict when a CNIC already exists", async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(buildScopedUserRecord()),
      },
      office: {
        findMany: jest.fn().mockResolvedValue([buildOffice()]),
      },
      userRoleAssignment: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([buildOfficerAssignment("reporting-1", "Reporting Officer")])
          .mockResolvedValueOnce([buildOfficerAssignment("countersigning-1", "Countersigning Officer")]),
      },
      employee: {
        findUnique: jest.fn().mockResolvedValue({
          id: "employee-1",
          name: "Existing Employee",
          serviceNumber: "EMP-1001",
        }),
        findMany: jest.fn(),
        create: jest.fn(),
      },
    };
    const service = new EmployeesService(prisma as never);

    await expect(service.create("user-1", UserRole.CLERK, buildCreateDto())).rejects.toThrow(ConflictException);
    expect(prisma.employee.findUnique).toHaveBeenCalledWith({
      where: { cnic: "61101-3333333-2" },
      select: {
        id: true,
        name: true,
        serviceNumber: true,
      },
    });
    expect(prisma.employee.create).not.toHaveBeenCalled();
  });

  it("normalizes employee input and generates the next service number from existing records", async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(buildScopedUserRecord()),
      },
      office: {
        findMany: jest.fn().mockResolvedValue([buildOffice()]),
      },
      userRoleAssignment: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([buildOfficerAssignment("reporting-1", "Reporting Officer")])
          .mockResolvedValueOnce([buildOfficerAssignment("countersigning-1", "Countersigning Officer")]),
      },
      employee: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([{ serviceNumber: "EMP-009" }, { serviceNumber: "EMP-1001" }]),
        create: jest.fn().mockImplementation(async ({ data }) => ({
          id: "employee-2",
          ...data,
          wing: { name: "Administration Wing" },
          directorate: null,
          region: { name: "North Region" },
          zone: { name: "Islamabad Zone" },
          circle: null,
          station: null,
          branch: null,
          cell: null,
          office: { name: "FIA HQ" },
          department: null,
          reportingOfficer: { displayName: "Reporting Officer" },
          countersigningOfficer: { displayName: "Countersigning Officer" },
        })),
      },
    };
    const service = new EmployeesService(prisma as never);

    const result = await service.create("user-1", UserRole.CLERK, buildCreateDto());

    expect(prisma.employee.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          serviceNumber: "EMP-1002",
          cnic: "61101-3333333-2",
          email: "muhammad.sarmad@fia.gov.pk",
          name: "Muhammad Sarmad",
          rank: "Superintendent",
          designation: "Admin Officer",
          posting: "HQ Desk",
          address: "Sector G-10, Islamabad",
          mobile: "0300-1234567",
        }),
      }),
    );
    expect(result).toMatchObject({
      serviceNumber: "EMP-1002",
      cnic: "61101-3333333-2",
      email: "muhammad.sarmad@fia.gov.pk",
    });
  });

  it("limits clerk manual creation options to the active office scope", async () => {
    const scopedUser = buildScopedUserRecord();
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(scopedUser),
      },
      office: {
        findMany: jest.fn().mockResolvedValue([buildOffice()]),
      },
      userRoleAssignment: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = new EmployeesService(prisma as never);

    await service.manualOptions("user-1", UserRole.CLERK);

    expect(prisma.office.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "office-1" },
      }),
    );
  });

  it("prefers the clerk's office assignment even when the active role also carries a department scope", async () => {
    const scopedUser = buildDepartmentScopedClerkRecord();
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(scopedUser),
      },
      office: {
        findMany: jest.fn().mockResolvedValue([buildOffice()]),
      },
      userRoleAssignment: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = new EmployeesService(prisma as never);

    await service.manualOptions("user-1", UserRole.CLERK);

    expect(prisma.office.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "office-1" },
      }),
    );
  });

  it("falls back to active officers when no officer is assigned to the selected office scope", async () => {
    const scopedUser = buildScopedUserRecord();
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(scopedUser),
      },
      office: {
        findMany: jest.fn().mockResolvedValue([buildOffice()]),
      },
      userRoleAssignment: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([
            buildOfficerAssignment("reporting-2", "Reporting Officer", {
              officeId: "office-2",
              zoneId: "zone-2",
              regionId: "region-2",
              officeName: "Lahore Office",
              zoneName: "Lahore Zone",
              regionName: "North Region",
            }),
          ])
          .mockResolvedValueOnce([
            buildOfficerAssignment("countersigning-2", "Countersigning Officer", {
              officeId: "office-2",
              zoneId: "zone-2",
              regionId: "region-2",
              officeName: "Lahore Office",
              zoneName: "Lahore Zone",
              regionName: "North Region",
            }),
          ]),
      },
    };
    const service = new EmployeesService(prisma as never);

    const result = await service.manualOptions("user-1", UserRole.CLERK, "office-1");

    expect(result.reportingOfficers).toHaveLength(1);
    expect(result.reportingOfficers[0]).toMatchObject({
      id: "reporting-2",
      displayName: "Reporting Officer",
      officeName: "Lahore Office",
    });
    expect(result.countersigningOfficers).toHaveLength(1);
    expect(result.countersigningOfficers[0]).toMatchObject({
      id: "countersigning-2",
      displayName: "Countersigning Officer",
      officeName: "Lahore Office",
    });
  });

  it("updates allowed employee portal profile fields, mirrors login metadata, and audits the change", async () => {
    const portalUser = buildPortalScopedUserRecord();
    const employeeRecord = buildPortalEmployeeRecord();
    const updatedEmployee = {
      ...employeeRecord,
      mobile: "0301-9990000",
      email: "fatima.updated@fia.gov.pk",
      posting: "Updated Headquarters Desk",
      address: "G-10 Islamabad",
    };
    const tx = {
      employee: {
        update: jest.fn().mockResolvedValue(updatedEmployee),
      },
      user: {
        update: jest.fn().mockResolvedValue({ id: portalUser.id }),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: "audit-1" }),
      },
    };
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(portalUser),
      },
      employee: {
        findUniqueOrThrow: jest.fn().mockResolvedValue(employeeRecord),
      },
      $transaction: jest.fn().mockImplementation(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const service = new EmployeesService(prisma as never);

    const result = await service.updatePortalProfile(
      "user-employee-1",
      UserRole.EMPLOYEE,
      {
        mobile: " 0301-9990000 ",
        email: " FATIMA.UPDATED@FIA.GOV.PK ",
        posting: " Updated Headquarters Desk ",
        address: " G-10 Islamabad ",
      },
      "127.0.0.1",
    );

    expect(tx.employee.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "employee-portal-1" },
        data: expect.objectContaining({
          mobile: "0301-9990000",
          email: "fatima.updated@fia.gov.pk",
          posting: "Updated Headquarters Desk",
          address: "G-10 Islamabad",
        }),
      }),
    );
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: "user-employee-1" },
      data: {
        email: "fatima.updated@fia.gov.pk",
        mobileNumber: "0301-9990000",
      },
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "Employee profile updated",
          ipAddress: "127.0.0.1",
          metadata: expect.objectContaining({
            changedFields: ["mobile", "email", "posting", "address"],
          }),
        }),
      }),
    );
    expect(result).toMatchObject({
      editableFields: {
        mobile: "0301-9990000",
        email: "fatima.updated@fia.gov.pk",
        posting: "Updated Headquarters Desk",
        address: "G-10 Islamabad",
      },
    });
  });
});
