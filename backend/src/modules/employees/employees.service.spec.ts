import { ConflictException } from "@nestjs/common";
import { TemplateFamilyCode, UserRole } from "@prisma/client";
import { EmployeesService } from "./employees.service";

describe("EmployeesService", () => {
  const buildScopedUserRecord = () => ({
    id: "user-1",
    isActive: true,
    wingId: "wing-1",
    zoneId: "zone-1",
    officeId: "office-1",
    wing: { id: "wing-1", name: "Administration Wing" },
    zone: { id: "zone-1", name: "Islamabad Zone" },
    office: { id: "office-1", name: "FIA HQ" },
    employeeProfiles: [],
    roleAssignments: [
      {
        role: UserRole.CLERK,
        wingId: "wing-1",
        zoneId: "zone-1",
        officeId: "office-1",
      },
    ],
  });

  const buildOffice = () => ({
    id: "office-1",
    code: "HQ",
    name: "FIA HQ",
    wingId: "wing-1",
    zoneId: "zone-1",
    wing: { name: "Administration Wing" },
    zone: { name: "Islamabad Zone" },
  });

  const buildOfficerAssignment = (userId: string, displayName: string) => ({
    userId,
    officeId: "office-1",
    zoneId: "zone-1",
    wingId: "wing-1",
    user: {
      id: userId,
      displayName,
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
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(buildOfficerAssignment("reporting-1", "Reporting Officer"))
          .mockResolvedValueOnce(buildOfficerAssignment("countersigning-1", "Countersigning Officer")),
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
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(buildOfficerAssignment("reporting-1", "Reporting Officer"))
          .mockResolvedValueOnce(buildOfficerAssignment("countersigning-1", "Countersigning Officer")),
      },
      employee: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([{ serviceNumber: "EMP-009" }, { serviceNumber: "EMP-1001" }]),
        create: jest.fn().mockImplementation(async ({ data }) => ({
          id: "employee-2",
          ...data,
          wing: { name: "Administration Wing" },
          zone: { name: "Islamabad Zone" },
          office: { name: "FIA HQ" },
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
});
