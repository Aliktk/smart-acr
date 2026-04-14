import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { AdverseRemarkStatus, UserRole } from "@prisma/client";
import { AdverseRemarksService } from "./adverse-remarks.service";
import { loadScopedUser } from "../../helpers/security.utils";

jest.mock("../../helpers/security.utils", () => {
  const actual = jest.requireActual("../../helpers/security.utils");
  return {
    ...actual,
    loadScopedUser: jest.fn(),
  };
});

const mockedLoadScopedUser = loadScopedUser as jest.MockedFunction<typeof loadScopedUser>;

function buildScopedUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "user-1",
    displayName: "Test User",
    activeRole: UserRole.REPORTING_OFFICER,
    roleAssignments: [],
    ...overrides,
  };
}

function buildRemark(overrides: Record<string, unknown> = {}) {
  return {
    id: "remark-1",
    acrRecordId: "acr-1",
    remarkText: "Officer showed lack of initiative.",
    counsellingDate: new Date("2025-06-15"),
    counsellingNotes: "Counselled on performance",
    endorsedByCso: false,
    endorsedAt: null,
    communicatedAt: null,
    communicationDeadline: null,
    status: AdverseRemarkStatus.DRAFT,
    createdAt: new Date("2025-07-01"),
    updatedAt: new Date("2025-07-01"),
    representation: null,
    ...overrides,
  };
}

function buildAuditWriter() {
  return { write: jest.fn().mockResolvedValue(undefined) };
}

describe("AdverseRemarksService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- createRemark ---

  describe("createRemark", () => {
    it("allows RO to create remark during PENDING_REPORTING", async () => {
      mockedLoadScopedUser.mockResolvedValue(buildScopedUser({ activeRole: UserRole.REPORTING_OFFICER }) as never);
      const created = buildRemark();
      const prisma = {
        acrRecord: {
          findUnique: jest.fn().mockResolvedValue({ id: "acr-1", workflowState: "PENDING_REPORTING", reportingOfficerId: "user-1" }),
          update: jest.fn().mockResolvedValue({}),
        },
        adverseRemark: {
          create: jest.fn().mockResolvedValue(created),
        },
      };
      const auditWriter = buildAuditWriter();
      const service = new AdverseRemarksService(prisma as never, auditWriter as never);

      const result = await service.createRemark("user-1", UserRole.REPORTING_OFFICER, "acr-1", "Officer showed lack of initiative.", "2025-06-15", "Counselled");

      expect(prisma.adverseRemark.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ acrRecordId: "acr-1", status: AdverseRemarkStatus.DRAFT }),
        }),
      );
      expect(prisma.acrRecord.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { hasAdverseRemarks: true } }),
      );
      expect(result.id).toBe("remark-1");
    });

    it("rejects non-RO role", async () => {
      mockedLoadScopedUser.mockResolvedValue(buildScopedUser({ activeRole: UserRole.CLERK }) as never);
      const service = new AdverseRemarksService({} as never, buildAuditWriter() as never);

      await expect(
        service.createRemark("user-1", UserRole.CLERK, "acr-1", "Some remark"),
      ).rejects.toThrow(ForbiddenException);
    });

    it("rejects wrong workflow state", async () => {
      mockedLoadScopedUser.mockResolvedValue(buildScopedUser() as never);
      const prisma = {
        acrRecord: {
          findUnique: jest.fn().mockResolvedValue({ id: "acr-1", workflowState: "DRAFT" }),
        },
      };
      const service = new AdverseRemarksService(prisma as never, buildAuditWriter() as never);

      await expect(
        service.createRemark("user-1", UserRole.REPORTING_OFFICER, "acr-1", "Some remark"),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects nonexistent ACR", async () => {
      mockedLoadScopedUser.mockResolvedValue(buildScopedUser() as never);
      const prisma = {
        acrRecord: { findUnique: jest.fn().mockResolvedValue(null) },
      };
      const service = new AdverseRemarksService(prisma as never, buildAuditWriter() as never);

      await expect(
        service.createRemark("user-1", UserRole.REPORTING_OFFICER, "acr-missing", "Some remark"),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // --- endorseRemark ---

  describe("endorseRemark", () => {
    it("allows CSO to endorse DRAFT remark", async () => {
      mockedLoadScopedUser.mockResolvedValue(buildScopedUser({ activeRole: UserRole.COUNTERSIGNING_OFFICER }) as never);
      const remark = buildRemark({ status: AdverseRemarkStatus.DRAFT });
      const endorsed = buildRemark({ status: AdverseRemarkStatus.ENDORSED_BY_CSO, endorsedByCso: true, endorsedAt: new Date() });
      const prisma = {
        adverseRemark: {
          findUnique: jest.fn().mockResolvedValue(remark),
          update: jest.fn().mockResolvedValue(endorsed),
        },
      };
      const auditWriter = buildAuditWriter();
      const service = new AdverseRemarksService(prisma as never, auditWriter as never);

      const result = await service.endorseRemark("user-1", UserRole.COUNTERSIGNING_OFFICER, "remark-1");

      expect(prisma.adverseRemark.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            endorsedByCso: true,
            status: AdverseRemarkStatus.ENDORSED_BY_CSO,
          }),
        }),
      );
      expect(result.endorsedByCso).toBe(true);
    });

    it("rejects non-CSO role", async () => {
      mockedLoadScopedUser.mockResolvedValue(buildScopedUser({ activeRole: UserRole.CLERK }) as never);
      const service = new AdverseRemarksService({} as never, buildAuditWriter() as never);

      await expect(
        service.endorseRemark("user-1", UserRole.CLERK, "remark-1"),
      ).rejects.toThrow(ForbiddenException);
    });

    it("rejects already-processed remark", async () => {
      mockedLoadScopedUser.mockResolvedValue(buildScopedUser({ activeRole: UserRole.COUNTERSIGNING_OFFICER }) as never);
      const prisma = {
        adverseRemark: {
          findUnique: jest.fn().mockResolvedValue(buildRemark({ status: AdverseRemarkStatus.ENDORSED_BY_CSO })),
        },
      };
      const service = new AdverseRemarksService(prisma as never, buildAuditWriter() as never);

      await expect(
        service.endorseRemark("user-1", UserRole.COUNTERSIGNING_OFFICER, "remark-1"),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects nonexistent remark", async () => {
      mockedLoadScopedUser.mockResolvedValue(buildScopedUser({ activeRole: UserRole.COUNTERSIGNING_OFFICER }) as never);
      const prisma = {
        adverseRemark: { findUnique: jest.fn().mockResolvedValue(null) },
      };
      const service = new AdverseRemarksService(prisma as never, buildAuditWriter() as never);

      await expect(
        service.endorseRemark("user-1", UserRole.COUNTERSIGNING_OFFICER, "remark-missing"),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // --- communicateRemark ---

  describe("communicateRemark", () => {
    it("allows SECRET_BRANCH to communicate endorsed remark within deadline", async () => {
      mockedLoadScopedUser.mockResolvedValue(buildScopedUser({ activeRole: UserRole.SECRET_BRANCH }) as never);
      const futureDeadline = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
      const remark = buildRemark({
        status: AdverseRemarkStatus.ENDORSED_BY_CSO,
        communicationDeadline: futureDeadline,
      });
      const communicated = buildRemark({
        status: AdverseRemarkStatus.COMMUNICATED,
        communicatedAt: new Date(),
      });
      const prisma = {
        adverseRemark: {
          findUnique: jest.fn().mockResolvedValue(remark),
          update: jest.fn().mockResolvedValue(communicated),
        },
      };
      const auditWriter = buildAuditWriter();
      const service = new AdverseRemarksService(prisma as never, auditWriter as never);

      const result = await service.communicateRemark("user-1", UserRole.SECRET_BRANCH, "remark-1");

      expect(prisma.adverseRemark.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: AdverseRemarkStatus.COMMUNICATED }),
        }),
      );
      expect(result.status).toBe(AdverseRemarkStatus.COMMUNICATED);
    });

    it("rejects non-SECRET_BRANCH role", async () => {
      mockedLoadScopedUser.mockResolvedValue(buildScopedUser({ activeRole: UserRole.CLERK }) as never);
      const service = new AdverseRemarksService({} as never, buildAuditWriter() as never);

      await expect(
        service.communicateRemark("user-1", UserRole.CLERK, "remark-1"),
      ).rejects.toThrow(ForbiddenException);
    });

    it("rejects when communication deadline has passed", async () => {
      mockedLoadScopedUser.mockResolvedValue(buildScopedUser({ activeRole: UserRole.SECRET_BRANCH }) as never);
      const pastDeadline = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
      const prisma = {
        adverseRemark: {
          findUnique: jest.fn().mockResolvedValue(
            buildRemark({ status: AdverseRemarkStatus.ENDORSED_BY_CSO, communicationDeadline: pastDeadline }),
          ),
        },
      };
      const service = new AdverseRemarksService(prisma as never, buildAuditWriter() as never);

      await expect(
        service.communicateRemark("user-1", UserRole.SECRET_BRANCH, "remark-1"),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // --- submitRepresentation ---

  describe("submitRepresentation", () => {
    it("allows representation within 30 days of acknowledgement", async () => {
      mockedLoadScopedUser.mockResolvedValue(buildScopedUser({ activeRole: UserRole.EMPLOYEE }) as never);
      const acknowledgedAt = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      const remark = buildRemark({
        status: AdverseRemarkStatus.ACKNOWLEDGED,
        communicatedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
        acknowledgedAt,
      });
      const updated = buildRemark({
        status: AdverseRemarkStatus.REPRESENTATION_RECEIVED,
        representation: {
          id: "rep-1",
          representationText: "I disagree with the assessment.",
          receivedAt: new Date(),
          representationDeadline: new Date(acknowledgedAt.getTime() + 30 * 24 * 60 * 60 * 1000),
          decision: null,
          decisionDate: null,
          decisionNotes: null,
          decidedBy: null,
        },
      });
      const prisma = {
        adverseRemark: {
          findUnique: jest.fn().mockResolvedValue(remark),
          update: jest.fn().mockResolvedValue(updated),
        },
        adverseRepresentation: {
          create: jest.fn().mockResolvedValue({ id: "rep-1" }),
        },
      };
      const auditWriter = buildAuditWriter();
      const service = new AdverseRemarksService(prisma as never, auditWriter as never);

      const result = await service.submitRepresentation("user-1", UserRole.EMPLOYEE, "remark-1", "I disagree.");

      expect(prisma.adverseRepresentation.create).toHaveBeenCalled();
      expect(result.status).toBe(AdverseRemarkStatus.REPRESENTATION_RECEIVED);
    });

    it("rejects when status is not ACKNOWLEDGED", async () => {
      mockedLoadScopedUser.mockResolvedValue(buildScopedUser() as never);
      const prisma = {
        adverseRemark: {
          findUnique: jest.fn().mockResolvedValue(buildRemark({ status: AdverseRemarkStatus.COMMUNICATED })),
        },
      };
      const service = new AdverseRemarksService(prisma as never, buildAuditWriter() as never);

      await expect(
        service.submitRepresentation("user-1", UserRole.EMPLOYEE, "remark-1", "text"),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects when 30-day window has expired", async () => {
      mockedLoadScopedUser.mockResolvedValue(buildScopedUser() as never);
      const acknowledgedAt = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000);
      const prisma = {
        adverseRemark: {
          findUnique: jest.fn().mockResolvedValue(
            buildRemark({ status: AdverseRemarkStatus.ACKNOWLEDGED, acknowledgedAt }),
          ),
        },
      };
      const service = new AdverseRemarksService(prisma as never, buildAuditWriter() as never);

      await expect(
        service.submitRepresentation("user-1", UserRole.EMPLOYEE, "remark-1", "text"),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // --- decideRepresentation ---

  describe("decideRepresentation", () => {
    it("allows DG to decide on representation", async () => {
      mockedLoadScopedUser.mockResolvedValue(buildScopedUser({ id: "dg-1", activeRole: UserRole.DG }) as never);
      const remark = buildRemark({
        status: AdverseRemarkStatus.REPRESENTATION_RECEIVED,
        representation: {
          id: "rep-1",
          representationText: "I disagree.",
          receivedAt: new Date(),
          representationDeadline: new Date(),
          decision: null,
          decisionDate: null,
          decisionNotes: null,
        },
      });
      const decided = buildRemark({
        status: AdverseRemarkStatus.REPRESENTATION_DECIDED,
        representation: {
          id: "rep-1",
          representationText: "I disagree.",
          receivedAt: new Date(),
          representationDeadline: new Date(),
          decision: "EXPUNGED",
          decisionDate: new Date(),
          decisionNotes: "Officer has shown improvement.",
          decidedBy: { id: "dg-1", displayName: "DG FIA" },
        },
      });
      const prisma = {
        adverseRemark: {
          findUnique: jest.fn().mockResolvedValue(remark),
          update: jest.fn().mockResolvedValue(decided),
        },
        adverseRepresentation: {
          update: jest.fn().mockResolvedValue({}),
        },
      };
      const auditWriter = buildAuditWriter();
      const service = new AdverseRemarksService(prisma as never, auditWriter as never);

      const result = await service.decideRepresentation("dg-1", UserRole.DG, "remark-1", "EXPUNGED", "Officer improved.");

      expect(prisma.adverseRepresentation.update).toHaveBeenCalled();
      expect(result.status).toBe(AdverseRemarkStatus.REPRESENTATION_DECIDED);
    });

    it("rejects non-authority role", async () => {
      mockedLoadScopedUser.mockResolvedValue(buildScopedUser({ activeRole: UserRole.CLERK }) as never);
      const service = new AdverseRemarksService({} as never, buildAuditWriter() as never);

      await expect(
        service.decideRepresentation("user-1", UserRole.CLERK, "remark-1", "UPHELD", "No change."),
      ).rejects.toThrow(ForbiddenException);
    });

    it("rejects when no representation exists", async () => {
      mockedLoadScopedUser.mockResolvedValue(buildScopedUser({ activeRole: UserRole.DG }) as never);
      const prisma = {
        adverseRemark: {
          findUnique: jest.fn().mockResolvedValue(
            buildRemark({ status: AdverseRemarkStatus.COMMUNICATED, representation: null }),
          ),
        },
      };
      const service = new AdverseRemarksService(prisma as never, buildAuditWriter() as never);

      await expect(
        service.decideRepresentation("dg-1", UserRole.DG, "remark-1", "UPHELD", "No change."),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // --- listByAcr ---

  describe("listByAcr", () => {
    it("returns ordered remarks with mapped representation", async () => {
      mockedLoadScopedUser.mockResolvedValue(buildScopedUser() as never);
      const remarks = [
        buildRemark({ id: "r1", createdAt: new Date("2025-07-01") }),
        buildRemark({ id: "r2", createdAt: new Date("2025-07-15"), status: AdverseRemarkStatus.ENDORSED_BY_CSO }),
      ];
      const prisma = {
        adverseRemark: {
          findMany: jest.fn().mockResolvedValue(remarks),
        },
      };
      const service = new AdverseRemarksService(prisma as never, buildAuditWriter() as never);

      const result = await service.listByAcr("user-1", UserRole.REPORTING_OFFICER, "acr-1");

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("r1");
      expect(result[1].id).toBe("r2");
      expect(prisma.adverseRemark.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { acrRecordId: "acr-1" }, orderBy: { createdAt: "asc" } }),
      );
    });
  });
});
