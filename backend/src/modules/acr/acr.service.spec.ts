import { ForbiddenException } from "@nestjs/common";
import { AcrWorkflowState, OrgScopeTrack, TemplateFamilyCode, UserRole } from "@prisma/client";
import { AcrService } from "./acr.service";
import { loadScopedUser } from "../../helpers/security.utils";

jest.mock("../../helpers/security.utils", () => {
  const actual = jest.requireActual("../../helpers/security.utils");
  return {
    ...actual,
    loadScopedUser: jest.fn(),
  };
});

const mockedLoadScopedUser = loadScopedUser as jest.MockedFunction<typeof loadScopedUser>;

function buildEmployee(overrides: Record<string, unknown> = {}) {
  return {
    id: "employee-1",
    userId: "user-employee-1",
    serviceNumber: "EMP-1001",
    name: "Fatima Zahra",
    rank: "UDC",
    designation: "UDC",
    positionTitle: "Upper Division Clerk",
    bps: 11,
    cnic: "61101-3333333-2",
    mobile: "0301-9990000",
    email: "fatima.updated@fia.gov.pk",
    posting: "Updated Headquarters Desk",
    joiningDate: new Date("2020-02-10T00:00:00.000Z"),
    serviceYears: 6,
    address: "G-10 Islamabad",
    templateFamily: TemplateFamilyCode.ASSISTANT_UDC_LDC,
    scopeTrack: OrgScopeTrack.WING,
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
    office: { name: "FIA HQ Islamabad" },
    department: null,
    reportingOfficerId: "reporting-1",
    countersigningOfficerId: "countersigning-1",
    reportingOfficer: {
      id: "reporting-1",
      displayName: "DSP Khalid Mehmood",
      employeeProfiles: [{ designation: "Deputy Director" }],
    },
    countersigningOfficer: {
      id: "countersigning-1",
      displayName: "SP Anwar Ul Haq",
      employeeProfiles: [{ designation: "Assistant Director" }],
    },
    status: "ACTIVE",
    retirementDate: null,
    suspendedFrom: null,
    suspendedTo: null,
    ...overrides,
  };
}

function buildAcrRecord(overrides: Record<string, unknown> = {}) {
  const employee = (overrides.employee as ReturnType<typeof buildEmployee> | undefined) ?? buildEmployee();

  return {
    id: "acr-1",
    acrNo: "FIA/ACR/2025-26/ADM/009",
    employeeId: employee.id,
    initiatedById: "clerk-1",
    reportingOfficerId: employee.reportingOfficerId,
    countersigningOfficerId: employee.countersigningOfficerId,
    currentHolderId: "secret-admin-1",
    secretBranchAllocatedToId: "secret-da1",
    secretBranchVerifiedById: "secret-admin-1",
    templateVersionId: "template-1",
    workflowState: AcrWorkflowState.ARCHIVED,
    statusLabel: "Archived",
    reportingPeriodFrom: new Date("2025-07-01T00:00:00.000Z"),
    reportingPeriodTo: new Date("2026-06-30T00:00:00.000Z"),
    dueDate: new Date("2026-06-10T00:00:00.000Z"),
    secretBranchDeskCode: "DA1",
    secretBranchSubmittedAt: new Date("2026-06-01T00:00:00.000Z"),
    secretBranchReviewedAt: new Date("2026-06-05T00:00:00.000Z"),
    secretBranchVerifiedAt: new Date("2026-06-07T00:00:00.000Z"),
    secretBranchVerificationNotes: "Restricted internal note",
    completedDate: new Date("2026-06-07T00:00:00.000Z"),
    archivedAt: new Date("2026-06-07T00:00:00.000Z"),
    isPriority: false,
    correctionRemarks: "Restricted workflow correction note",
    returnToRole: null,
    returnedByRole: null,
    performanceScore: 89,
    calendarYear: 2025,
    gradeDueDate: new Date("2026-04-30T23:59:59.000Z"),
    partPeriodReason: null,
    hasAdverseRemarks: false,
    submissionCertificatePath: null,
    employeeMetadataSnapshot: {
      posting: employee.posting,
      mobile: employee.mobile,
      email: employee.email,
    },
    formData: {
      clerkSection: { remarks: "Confidential clerk section" },
      reportingSection: { remarks: "Confidential reporting section" },
    },
    createdAt: new Date("2025-07-05T00:00:00.000Z"),
    updatedAt: new Date("2026-06-07T00:00:00.000Z"),
    employee,
    initiatedBy: {
      id: "clerk-1",
      displayName: "Zahid Ullah",
    },
    currentHolder: {
      id: "secret-admin-1",
      displayName: "Nazia Ambreen",
    },
    reportingOfficer: employee.reportingOfficer,
    countersigningOfficer: employee.countersigningOfficer,
    secretBranchAllocatedTo: {
      id: "secret-da1",
      displayName: "Sadia Malik",
    },
    secretBranchVerifiedBy: {
      id: "secret-admin-1",
      displayName: "Nazia Ambreen",
    },
    templateVersion: {
      family: TemplateFamilyCode.ASSISTANT_UDC_LDC,
      version: "v2.1",
      requiresCountersigning: true,
    },
    timeline: [
      {
        actorId: "clerk-1",
        actorRole: "Clerk",
        action: "Submitted to Reporting Officer",
        status: "completed",
        remarks: "Restricted remark",
        createdAt: new Date("2025-07-10T09:00:00.000Z"),
        actor: { id: "clerk-1", displayName: "Zahid Ullah" },
      },
      {
        actorId: "reporting-1",
        actorRole: "Reporting Officer",
        action: "Forwarded to Countersigning Officer",
        status: "completed",
        remarks: "Restricted remark",
        createdAt: new Date("2025-07-18T09:00:00.000Z"),
        actor: { id: "reporting-1", displayName: "DSP Khalid Mehmood" },
      },
      {
        actorId: "secret-admin-1",
        actorRole: "Secret Branch",
        action: "Secret Branch verification completed",
        status: "completed",
        remarks: "Restricted archive note",
        createdAt: new Date("2026-06-07T09:00:00.000Z"),
        actor: { id: "secret-admin-1", displayName: "Nazia Ambreen" },
      },
    ],
    archiveSnapshot: {
      documentPath: "archive/fatima-2025.pdf",
    },
    archiveRecord: {
      archiveReference: "archive/fatima-2025.pdf",
      documentPath: "archive/fatima-2025.pdf",
    },
    ...overrides,
  };
}

function buildScopedUser(activeRole: UserRole, overrides: Record<string, unknown> = {}) {
  return {
    id: activeRole === UserRole.EMPLOYEE ? "user-employee-1" : "clerk-1",
    displayName: activeRole === UserRole.EMPLOYEE ? "Fatima Zahra" : "Zahid Ullah",
    activeRole,
    roleAssignments: [{ role: activeRole }],
    activeAssignment: { role: activeRole, scopeTrack: OrgScopeTrack.WING, wingId: "wing-1", officeId: "office-1" },
    employeeProfiles: activeRole === UserRole.EMPLOYEE ? [{ id: "employee-1" }] : [],
    secretBranchProfile: null,
    ...overrides,
  };
}

function createWorkflowServiceMock() {
  return {
    isOverdue: jest.fn().mockReturnValue(false),
    overdueDays: jest.fn().mockReturnValue(0),
    getDueDate: jest.fn((baseDate: Date, stageDays: number) => new Date(baseDate.getTime() + stageDays * 24 * 60 * 60 * 1000)),
    canTransition: jest.fn(),
    nextStateForAction: jest.fn(),
  };
}

describe("AcrService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows only the current employee's ACR metadata while masking confidential form content", async () => {
    mockedLoadScopedUser.mockResolvedValue(buildScopedUser(UserRole.EMPLOYEE) as never);
    const ownRecord = buildAcrRecord();
    const otherRecord = buildAcrRecord({
      id: "acr-foreign",
      employeeId: "employee-2",
      employee: buildEmployee({ id: "employee-2", userId: "user-employee-2", name: "Other Employee" }),
    });
    const prisma = {
      acrRecord: {
        findMany: jest.fn().mockResolvedValue([ownRecord, otherRecord]),
      },
    };
    const service = new AcrService(prisma as never, createWorkflowServiceMock() as never, { write: jest.fn() } as never);

    const result = await service.list("user-employee-1", UserRole.EMPLOYEE);

    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({
      acrNo: "FIA/ACR/2025-26/ADM/009",
      reportingOfficer: "DSP Khalid Mehmood",
      countersigningOfficer: "SP Anwar Ul Haq",
      hasHistoricalPdf: true,
      secretBranch: expect.objectContaining({
        status: expect.stringContaining("Archived"),
      }),
    });
    expect(result.items[0]).not.toHaveProperty("formData");
    expect(result.items[0]).not.toHaveProperty("employeeMetadataSnapshot");
  });

  it("returns employee-safe detail metadata without exposing confidential remarks or form sections", async () => {
    mockedLoadScopedUser.mockResolvedValue(buildScopedUser(UserRole.EMPLOYEE) as never);
    const prisma = {
      acrRecord: {
        findUnique: jest.fn().mockResolvedValue(buildAcrRecord()),
      },
    };
    const service = new AcrService(prisma as never, createWorkflowServiceMock() as never, { write: jest.fn() } as never);

    const result = await service.detail("user-employee-1", UserRole.EMPLOYEE, "acr-1");

    expect(result).toMatchObject({
      initiatedBy: "Zahid Ullah",
      reportingOfficer: "DSP Khalid Mehmood",
      countersigningOfficer: "SP Anwar Ul Haq",
      hasHistoricalPdf: true,
    });
    expect(result.timeline).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actor: "Zahid Ullah",
          role: "Clerk",
        }),
      ]),
    );
    expect(result).not.toHaveProperty("formData");
    expect(result).not.toHaveProperty("employeeMetadataSnapshot");
    expect(result.timeline[0].remarks).toBeUndefined();
  });

  it("accepts saved reusable reviewer assets during reporting transition validation", async () => {
    mockedLoadScopedUser.mockResolvedValue(
      buildScopedUser(UserRole.REPORTING_OFFICER, {
        id: "reporting-1",
        displayName: "DSP Khalid Mehmood",
      }) as never,
    );

    const workflowService = createWorkflowServiceMock();
    workflowService.canTransition.mockReturnValue(true);
    workflowService.nextStateForAction.mockReturnValue({
      workflowState: AcrWorkflowState.PENDING_COUNTERSIGNING,
      statusLabel: "Pending Countersigning",
    });

    const reportingOfficer = {
      id: "reporting-1",
      displayName: "DSP Khalid Mehmood",
      employeeProfiles: [{ designation: "Deputy Director" }],
      userAssets: [
        {
          id: "signature-1",
          assetType: "SIGNATURE",
          storageType: "LOCAL",
          originalName: "signature.png",
          mimeType: "image/png",
          fileSize: 1200,
          updatedAt: new Date("2026-04-08T08:30:00.000Z"),
          isActive: true,
        },
        {
          id: "stamp-1",
          assetType: "STAMP",
          storageType: "LOCAL",
          originalName: "stamp.png",
          mimeType: "image/png",
          fileSize: 2200,
          updatedAt: new Date("2026-04-08T08:45:00.000Z"),
          isActive: true,
        },
      ],
    };
    const nextFormData = {
      replicaState: {
        textFields: {
          "text:reporting:assessment": "Assessment entered.",
          "text:reporting:signature-date": "2026-04-08",
        },
        checkFields: {},
        assetFields: {},
      },
    };
    const acr = buildAcrRecord({
      workflowState: AcrWorkflowState.PENDING_REPORTING,
      currentHolderId: "reporting-1",
      reportingOfficerId: "reporting-1",
      reportingOfficer,
      formData: nextFormData,
    });
    const updated = buildAcrRecord({
      ...acr,
      workflowState: AcrWorkflowState.PENDING_COUNTERSIGNING,
      statusLabel: "Pending Countersigning",
      currentHolderId: "countersigning-1",
      reportingOfficer,
      formData: nextFormData,
    });

    const prisma = {
      acrRecord: {
        findUnique: jest.fn().mockResolvedValue(acr),
        update: jest.fn().mockResolvedValue(updated),
        findUniqueOrThrow: jest.fn().mockResolvedValue(updated),
      },
      adminSetting: {
        findUnique: jest.fn().mockResolvedValue({ value: 7 }),
      },
      acrTimelineEntry: {
        create: jest.fn().mockResolvedValue({ id: "timeline-1" }),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: "audit-1" }),
      },
      notification: {
        create: jest.fn().mockResolvedValue({ id: "notification-1" }),
      },
      employee: {
        findFirst: jest.fn().mockResolvedValue({ status: "ACTIVE" }),
      },
    };

    const service = new AcrService(prisma as never, workflowService as never, { write: jest.fn() } as never);
    const result = await service.transition(
      "reporting-1",
      UserRole.REPORTING_OFFICER,
      "acr-1",
      "forward_to_countersigning",
      undefined,
      nextFormData,
    );

    expect(prisma.acrRecord.update).toHaveBeenCalled();
    expect(result.reviewerAssets?.reporting.signature?.id).toBe("signature-1");
    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: "Countersigning Review Required",
        }),
      }),
    );
  });

  it("blocks employees from opening another employee's ACR record", async () => {
    mockedLoadScopedUser.mockResolvedValue(buildScopedUser(UserRole.EMPLOYEE) as never);
    const prisma = {
      acrRecord: {
        findUnique: jest.fn().mockResolvedValue(
          buildAcrRecord({
            employeeId: "employee-2",
            employee: buildEmployee({ id: "employee-2", userId: "user-employee-2", name: "Other Employee" }),
          }),
        ),
      },
    };
    const service = new AcrService(prisma as never, createWorkflowServiceMock() as never, { write: jest.fn() } as never);

    await expect(service.detail("user-employee-1", UserRole.EMPLOYEE, "acr-foreign")).rejects.toThrow(ForbiddenException);
  });

  it("uses the latest employee profile metadata when initiating a later ACR", async () => {
    mockedLoadScopedUser.mockResolvedValue(buildScopedUser(UserRole.CLERK) as never);
    const employee = buildEmployee();
    const createdRecord = buildAcrRecord({
      workflowState: AcrWorkflowState.DRAFT,
      statusLabel: "Draft",
      currentHolderId: "clerk-1",
      secretBranchAllocatedToId: null,
      secretBranchVerifiedById: null,
      secretBranchDeskCode: null,
      secretBranchSubmittedAt: null,
      secretBranchReviewedAt: null,
      secretBranchVerifiedAt: null,
      completedDate: null,
      archivedAt: null,
      archiveSnapshot: null,
      archiveRecord: null,
      timeline: [],
      employee,
    });
    const prisma = {
      adminSetting: {
        findUnique: jest.fn().mockResolvedValue({ value: 10 }),
      },
      employee: {
        findUnique: jest.fn().mockResolvedValue(employee),
      },
      templateVersion: {
        findFirst: jest.fn().mockResolvedValue({
          id: "template-1",
          family: TemplateFamilyCode.ASSISTANT_UDC_LDC,
          version: "v2.1",
          requiresCountersigning: true,
        }),
        upsert: jest.fn().mockResolvedValue({
          id: "template-1",
          family: TemplateFamilyCode.ASSISTANT_UDC_LDC,
        }),
      },
      secretBranchRoutingRule: {
        upsert: jest.fn().mockResolvedValue({
          id: "routing-1",
          templateFamily: TemplateFamilyCode.ASSISTANT_UDC_LDC,
        }),
      },
      acrRecord: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(createdRecord),
      },
      acrTimelineEntry: {
        create: jest.fn().mockResolvedValue({ id: "timeline-1" }),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: "audit-1" }),
      },
    };
    const service = new AcrService(prisma as never, createWorkflowServiceMock() as never, { write: jest.fn() } as never);

    await service.create("clerk-1", UserRole.CLERK, {
      employeeId: "employee-1",
      reportingPeriodFrom: "2025-01-01",
      reportingPeriodTo: "2025-12-31",
    });

    expect(prisma.acrRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          employeeMetadataSnapshot: expect.objectContaining({
            posting: "Updated Headquarters Desk",
            mobile: "0301-9990000",
            email: "fatima.updated@fia.gov.pk",
          }),
        }),
      }),
    );
  });
});
