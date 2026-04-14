import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { OrgScopeTrack, UserRole } from "@prisma/client";
import { UsersService } from "./users.service";
import { loadScopedUser } from "../../helpers/security.utils";

jest.mock("../../helpers/security.utils", () => {
  const actual = jest.requireActual("../../helpers/security.utils");
  return {
    ...actual,
    loadScopedUser: jest.fn(),
  };
});

const mockedLoadScopedUser = loadScopedUser as jest.MockedFunction<typeof loadScopedUser>;

function buildActor(params: {
  id?: string;
  activeRole: UserRole;
  canManageUsers?: boolean;
  canVerify?: boolean;
  secretBranchProfileActive?: boolean;
}) {
  return {
    id: params.id ?? "actor-1",
    displayName: "Nazia Ambreen",
    activeRole: params.activeRole,
    roleAssignments: [{ role: params.activeRole }],
    secretBranchProfile:
      params.activeRole === UserRole.SECRET_BRANCH
        ? {
            deskCode: "AD_SECRET_BRANCH",
            canManageUsers: params.canManageUsers ?? false,
            canVerify: params.canVerify ?? false,
            isActive: params.secretBranchProfileActive ?? true,
          }
        : null,
  } as never;
}

function buildManagedUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "user-1",
    username: "fatima.employee",
    email: "fatima.employee@fia.gov.pk",
    badgeNo: "FIA-EMP-5001",
    displayName: "Fatima Zahra",
    positionTitle: "Assistant",
    departmentName: "Administration",
    departmentId: "department-1",
    mobileNumber: "0300-1112223",
    passwordHash: "hashed-password",
    passwordChangedAt: null,
    mustChangePassword: true,
    lastLoginAt: null,
    twoFactorEnabled: false,
    avatarFileName: null,
    avatarMimeType: null,
    avatarStoragePath: null,
    notificationPreferences: null,
    displayPreferences: null,
    isActive: true,
    scopeTrack: OrgScopeTrack.WING,
    wingId: "wing-1",
    directorateId: null,
    regionId: null,
    zoneId: null,
    circleId: null,
    stationId: null,
    branchId: null,
    cellId: null,
    officeId: null,
    createdById: "actor-1",
    updatedById: "actor-1",
    createdAt: new Date("2026-04-07T08:00:00.000Z"),
    updatedAt: new Date("2026-04-07T08:00:00.000Z"),
    wing: { id: "wing-1", name: "Administration Wing" },
    directorate: null,
    region: null,
    zone: null,
    circle: null,
    station: null,
    branch: null,
    cell: null,
    office: null,
    department: { id: "department-1", name: "Administration" },
    roleAssignments: [{ role: UserRole.CLERK }],
    secretBranchProfile: null,
    ...overrides,
  } as never;
}

function createPrismaMock() {
  return {
    user: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    userRoleAssignment: {
      createMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    secretBranchStaffProfile: {
      deleteMany: jest.fn(),
      upsert: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    passwordResetToken: {
      deleteMany: jest.fn(),
    },
    session: {
      updateMany: jest.fn(),
    },
    wing: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    directorate: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    region: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    zone: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    circle: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    station: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    branch: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    cell: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    office: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    department: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  };
}

describe("UsersService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("allows a delegated Secret Branch admin to create a user and writes an audit entry", async () => {
    mockedLoadScopedUser.mockResolvedValue(buildActor({ activeRole: UserRole.SECRET_BRANCH, canManageUsers: true }));
    const prisma = createPrismaMock();
    const tx = {
      user: {
        create: jest.fn().mockResolvedValue(buildManagedUser({ id: "user-2", displayName: "Ayesha Malik", username: "ayesha.malik" })),
        findUniqueOrThrow: jest.fn().mockResolvedValue(buildManagedUser({ id: "user-2", displayName: "Ayesha Malik", username: "ayesha.malik" })),
      },
      userRoleAssignment: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      secretBranchStaffProfile: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        upsert: jest.fn(),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: "audit-1" }),
      },
    };

    prisma.wing.findUnique.mockResolvedValue({ id: "wing-1" });
    prisma.$transaction.mockImplementation(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx));

    const service = new UsersService(prisma as never);
    const result = await service.create(
      "actor-1",
      UserRole.SECRET_BRANCH,
      {
        fullName: "Ayesha Malik",
        username: "ayesha.malik",
        email: "ayesha.malik@fia.gov.pk",
        badgeNo: "FIA-EMP-7001",
        temporaryPassword: "TempPass!1",
        roles: [UserRole.CLERK],
        scope: {
          scopeTrack: OrgScopeTrack.WING,
          wingId: "wing-1",
        },
      } as never,
      "127.0.0.1",
    );

    expect(tx.user.create).toHaveBeenCalled();
    expect(tx.userRoleAssignment.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [expect.objectContaining({ role: UserRole.CLERK, wingId: "wing-1" })],
      }),
    );
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "User account created",
          recordType: "USER",
          ipAddress: "127.0.0.1",
        }),
      }),
    );
    expect(result).toMatchObject({
      id: "user-2",
      fullName: "Ayesha Malik",
      roles: [UserRole.CLERK],
    });
  });

  it("updates role and organization scope assignments and audits the change", async () => {
    mockedLoadScopedUser.mockResolvedValue(buildActor({ activeRole: UserRole.SECRET_BRANCH, canManageUsers: true }));
    const prisma = createPrismaMock();
    const existingUser = buildManagedUser({
      id: "user-3",
      scopeTrack: OrgScopeTrack.WING,
      wingId: "wing-1",
      roleAssignments: [{ role: UserRole.CLERK }],
    });
    const updatedUser = buildManagedUser({
      id: "user-3",
      scopeTrack: OrgScopeTrack.REGIONAL,
      wingId: null,
      regionId: "region-1",
      region: { id: "region-1", name: "North Region" },
      roleAssignments: [{ role: UserRole.REPORTING_OFFICER }],
    });
    const tx = {
      user: {
        update: jest.fn().mockResolvedValue(updatedUser),
        findUniqueOrThrow: jest.fn().mockResolvedValue(updatedUser),
      },
      userRoleAssignment: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      secretBranchStaffProfile: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        upsert: jest.fn(),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: "audit-1" }),
      },
    };

    prisma.user.findUnique.mockResolvedValue(existingUser);
    prisma.region.findUnique.mockResolvedValue({ id: "region-1" });
    prisma.$transaction.mockImplementation(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx));

    const service = new UsersService(prisma as never);
    const result = await service.update(
      "actor-1",
      UserRole.SECRET_BRANCH,
      "user-3",
      {
        roles: [UserRole.REPORTING_OFFICER],
        scope: {
          scopeTrack: OrgScopeTrack.REGIONAL,
          regionId: "region-1",
        },
      } as never,
      "127.0.0.1",
    );

    expect(tx.userRoleAssignment.deleteMany).toHaveBeenCalledWith({ where: { userId: "user-3" } });
    expect(tx.userRoleAssignment.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [expect.objectContaining({ role: UserRole.REPORTING_OFFICER, regionId: "region-1" })],
      }),
    );
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "User account updated / role changed",
        }),
      }),
    );
    expect(result).toMatchObject({
      id: "user-3",
      roles: [UserRole.REPORTING_OFFICER],
      scope: expect.objectContaining({ regionId: "region-1" }),
    });
  });

  it("blocks creating a Secret Branch account without a desk profile", async () => {
    mockedLoadScopedUser.mockResolvedValue(buildActor({ activeRole: UserRole.SECRET_BRANCH, canManageUsers: true }));
    const prisma = createPrismaMock();
    const service = new UsersService(prisma as never);

    await expect(
      service.create(
        "actor-1",
        UserRole.SECRET_BRANCH,
        {
          fullName: "Secret Officer",
          username: "secret.officer",
          email: "secret.officer@fia.gov.pk",
          badgeNo: "FIA-SB-9001",
          temporaryPassword: "TempPass!1",
          roles: [UserRole.SECRET_BRANCH],
          scope: {
            scopeTrack: OrgScopeTrack.WING,
            wingId: "wing-1",
          },
        } as never,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it("resets a managed user's password and clears outstanding reset tokens", async () => {
    mockedLoadScopedUser.mockResolvedValue(buildActor({ activeRole: UserRole.SECRET_BRANCH, canManageUsers: true }));
    const prisma = createPrismaMock();
    prisma.user.findUnique.mockResolvedValue({
      id: "user-4",
      displayName: "Bilal Hassan",
      roleAssignments: [{ role: UserRole.EMPLOYEE }],
    });
    prisma.user.update.mockResolvedValue({ id: "user-4" });
    prisma.passwordResetToken.deleteMany.mockResolvedValue({ count: 1 });
    prisma.auditLog.create.mockResolvedValue({ id: "audit-1" });
    prisma.$transaction.mockResolvedValue([]);

    const service = new UsersService(prisma as never);
    const result = await service.resetPassword(
      "actor-1",
      UserRole.SECRET_BRANCH,
      "user-4",
      {
        nextPassword: "ResetPass!2",
        mustChangePassword: true,
      } as never,
      "127.0.0.1",
    );

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user-4" },
        data: expect.objectContaining({
          mustChangePassword: true,
          updatedById: "actor-1",
        }),
      }),
    );
    expect(prisma.passwordResetToken.deleteMany).toHaveBeenCalledWith({ where: { userId: "user-4" } });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "Admin password reset",
        }),
      }),
    );
    expect(result).toEqual({
      success: true,
      message: "Password reset successfully.",
    });
  });

  it("deactivates a user, revokes active sessions, and records the audit event", async () => {
    mockedLoadScopedUser.mockResolvedValue(buildActor({ activeRole: UserRole.SECRET_BRANCH, canManageUsers: true }));
    const prisma = createPrismaMock();
    prisma.user.findUnique.mockResolvedValue({
      id: "user-5",
      displayName: "Hina Noor",
      isActive: true,
      roleAssignments: [{ role: UserRole.EMPLOYEE }],
    });
    prisma.user.update.mockResolvedValue({ id: "user-5" });
    prisma.session.updateMany.mockResolvedValue({ count: 2 });
    prisma.auditLog.create.mockResolvedValue({ id: "audit-1" });
    prisma.$transaction.mockResolvedValue([]);
    prisma.user.findUniqueOrThrow.mockResolvedValue(buildManagedUser({ id: "user-5", isActive: false }));

    const service = new UsersService(prisma as never);
    const result = await service.deactivate("actor-1", UserRole.SECRET_BRANCH, "user-5", "127.0.0.1");

    expect(prisma.session.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "user-5", revokedAt: null }),
      }),
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "User account deactivated",
        }),
      }),
    );
    expect(result).toMatchObject({
      id: "user-5",
      status: "inactive",
      isActive: false,
    });
  });

  it("rejects user-management access for roles without delegated authority", async () => {
    mockedLoadScopedUser.mockResolvedValue(buildActor({ activeRole: UserRole.IT_OPS }));
    const prisma = createPrismaMock();
    const service = new UsersService(prisma as never);

    await expect(service.list("actor-1", UserRole.IT_OPS, {} as never)).rejects.toThrow(ForbiddenException);
  });

  it("prevents delegated Secret Branch admins from managing Super Admin or IT Ops accounts", async () => {
    mockedLoadScopedUser.mockResolvedValue(buildActor({ activeRole: UserRole.SECRET_BRANCH, canManageUsers: true }));
    const prisma = createPrismaMock();
    prisma.user.findUnique.mockResolvedValue({
      id: "user-6",
      displayName: "Root Admin",
      roleAssignments: [{ role: UserRole.SUPER_ADMIN }],
    });

    const service = new UsersService(prisma as never);

    await expect(
      service.resetPassword(
        "actor-1",
        UserRole.SECRET_BRANCH,
        "user-6",
        {
          nextPassword: "ResetPass!2",
          mustChangePassword: true,
        } as never,
      ),
    ).rejects.toThrow(ForbiddenException);
  });
});
