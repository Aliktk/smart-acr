import { ForbiddenException } from "@nestjs/common";
import { OrgScopeTrack, UserRole } from "@prisma/client";
import * as fs from "node:fs/promises";
import { FilesService } from "./files.service";
import { loadScopedUser } from "../../helpers/security.utils";

jest.mock("../../helpers/security.utils", () => {
  const actual = jest.requireActual("../../helpers/security.utils");
  return {
    ...actual,
    loadScopedUser: jest.fn(),
  };
});

jest.mock("node:fs/promises", () => ({
  access: jest.fn(),
  unlink: jest.fn(),
}));

const mockedLoadScopedUser = loadScopedUser as jest.MockedFunction<typeof loadScopedUser>;
const mockedFsAccess = fs.access as jest.MockedFunction<typeof fs.access>;

function buildEmployee() {
  return {
    id: "employee-1",
    userId: "user-employee-1",
    scopeTrack: OrgScopeTrack.REGIONAL,
    wingId: "wing-1",
    regionId: "region-1",
    zoneId: "zone-1",
    officeId: "office-1",
    reportingOfficerId: "reporting-1",
    countersigningOfficerId: "countersigning-1",
  };
}

describe("FilesService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedFsAccess.mockResolvedValue(undefined);
  });

  it("allows a user to access a file they uploaded", async () => {
    const prisma = {
      fileAsset: {
        findUnique: jest.fn().mockResolvedValue({
          id: "file-1",
          mimeType: "image/png",
          fileName: "signature.png",
          storagePath: "uploads/signature.png",
          uploadedById: "user-1",
          acrRecord: null,
          archiveRecord: null,
        }),
      },
    };
    const configService = { get: jest.fn().mockReturnValue("storage") };
    mockedLoadScopedUser.mockResolvedValue({
      id: "user-1",
      activeRole: UserRole.CLERK,
      activeAssignment: { role: UserRole.CLERK },
      roleAssignments: [{ role: UserRole.CLERK }],
      employeeProfiles: [],
    } as never);

    const service = new FilesService(prisma as never, configService as never);
    const result = await service.resolveFileForUser("user-1", UserRole.CLERK, "file-1");
    expect(result.mimeType).toBe("image/png");
  });

  it("allows secret branch users to access any file", async () => {
    const prisma = {
      fileAsset: {
        findUnique: jest.fn().mockResolvedValue({
          id: "file-1",
          mimeType: "application/pdf",
          fileName: "acr-doc.pdf",
          storagePath: "uploads/acr-doc.pdf",
          uploadedById: "other-user",
          acrRecord: { id: "acr-1", employee: buildEmployee() },
          archiveRecord: null,
        }),
      },
    };
    const configService = { get: jest.fn().mockReturnValue("storage") };
    mockedLoadScopedUser.mockResolvedValue({
      id: "sb-user-1",
      activeRole: UserRole.SECRET_BRANCH,
      activeAssignment: { role: UserRole.SECRET_BRANCH },
      roleAssignments: [{ role: UserRole.SECRET_BRANCH }],
      employeeProfiles: [],
    } as never);

    const service = new FilesService(prisma as never, configService as never);
    const result = await service.resolveFileForUser("sb-user-1", UserRole.SECRET_BRANCH, "file-1");
    expect(result.mimeType).toBe("application/pdf");
  });

  it("blocks employees from opening restricted historical archive PDFs", async () => {
    const prisma = {
      fileAsset: {
        findUnique: jest.fn().mockResolvedValue({
          id: "file-1",
          mimeType: "application/pdf",
          fileName: "legacy-2019.pdf",
          storagePath: "archive-history/legacy-2019.pdf",
          uploadedById: "actor-1",
          acrRecord: null,
          archiveRecord: {
            id: "archive-1",
            employee: buildEmployee(),
          },
        }),
      },
    };
    const configService = {
      get: jest.fn().mockReturnValue("storage"),
    };

    mockedLoadScopedUser.mockResolvedValue({
      id: "user-employee-1",
      activeRole: UserRole.EMPLOYEE,
      activeAssignment: { role: UserRole.EMPLOYEE },
      roleAssignments: [{ role: UserRole.EMPLOYEE }],
      employeeProfiles: [{ id: "employee-1" }],
    } as never);

    const service = new FilesService(prisma as never, configService as never);

    await expect(service.resolveFileForUser("user-employee-1", UserRole.EMPLOYEE, "file-1")).rejects.toThrow(ForbiddenException);
    expect(prisma.fileAsset.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "file-1" },
      }),
    );
  });
});
