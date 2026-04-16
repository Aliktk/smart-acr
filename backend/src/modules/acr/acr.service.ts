import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import {
  AcrWorkflowState,
  ArchiveRecordSource,
  FileStorageType,
  NotificationType,
  Prisma,
  SecretBranchDeskCode,
  TemplateFamilyCode,
  UserRole,
} from "@prisma/client";
import { ensureTemplateCatalog } from "../../common/template-catalog";
import { PrismaService } from "../../common/prisma.service";
import { buildAcrAccessPreFilter, canAccessAcr, canCreateAcr, canEditAcrForm, canTransitionAcr, displayRole, loadScopedUser } from "../../helpers/security.utils";
import { AuditWriterService } from "../audit/audit-writer.service";
import { mapAcr, mapEmployee, mapTimeline, mapWorkflowState } from "../../helpers/view-mappers";
import { WorkflowService, type AcrAction } from "../workflow/workflow.service";
import { deriveCalendarYear, getCsoDeadline, getGradeSubmissionDeadline, getRoDeadline } from "../workflow/deadline.utils";
import { getActionFormValidationMessage } from "./acr-form-validation";
import { validateReportingPeriod } from "./reporting-period.utils";

const ACTIVE_REVIEWER_ASSET_SELECT = {
  id: true,
  assetType: true,
  storageType: true,
  originalName: true,
  mimeType: true,
  fileSize: true,
  updatedAt: true,
  isActive: true,
} satisfies Prisma.UserAssetSelect;

const ACR_SUMMARY_INCLUDE = {
  employee: {
    include: {
      wing: true,
      directorate: true,
      region: true,
      zone: true,
      circle: true,
      station: true,
      branch: true,
      cell: true,
      office: true,
      department: true,
      reportingOfficer: {
        include: {
          employeeProfiles: {
            select: {
              designation: true,
            },
          },
        },
      },
      countersigningOfficer: {
        include: {
          employeeProfiles: {
            select: {
              designation: true,
            },
          },
        },
      },
    },
  },
  initiatedBy: true,
  currentHolder: true,
  reportingOfficer: {
    include: {
      employeeProfiles: {
        select: {
          designation: true,
        },
      },
      userAssets: {
        where: {
          isActive: true,
        },
        select: ACTIVE_REVIEWER_ASSET_SELECT,
        orderBy: {
          updatedAt: "desc",
        },
      },
    },
  },
  countersigningOfficer: {
    include: {
      employeeProfiles: {
        select: {
          designation: true,
        },
      },
      userAssets: {
        where: {
          isActive: true,
        },
        select: ACTIVE_REVIEWER_ASSET_SELECT,
        orderBy: {
          updatedAt: "desc",
        },
      },
    },
  },
  secretBranchAllocatedTo: true,
  secretBranchVerifiedBy: true,
  timeline: {
    select: {
      actorId: true,
      action: true,
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  },
  templateVersion: true,
  archiveSnapshot: true,
  archiveRecord: true,
} satisfies Prisma.AcrRecordInclude;

const ACR_DETAIL_INCLUDE = {
  ...ACR_SUMMARY_INCLUDE,
  timeline: {
    include: {
      actor: true,
    },
    orderBy: { createdAt: "asc" },
  },
} satisfies Prisma.AcrRecordInclude;

type AcrSummaryRecord = Prisma.AcrRecordGetPayload<{
  include: typeof ACR_SUMMARY_INCLUDE;
}>;

type AcrDetailRecord = Prisma.AcrRecordGetPayload<{
  include: typeof ACR_DETAIL_INCLUDE;
}>;

@Injectable()
export class AcrService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workflowService: WorkflowService,
    private readonly auditWriter: AuditWriterService,
  ) {}

  private readReplicaState(formData: Record<string, unknown> | null | undefined) {
    const source =
      formData && typeof formData === "object" && !Array.isArray(formData)
        ? (formData.replicaState as Record<string, unknown> | null | undefined)
        : null;

    return {
      textFields:
        source?.textFields && typeof source.textFields === "object" && !Array.isArray(source.textFields)
          ? { ...(source.textFields as Record<string, string>) }
          : {},
      checkFields:
        source?.checkFields && typeof source.checkFields === "object" && !Array.isArray(source.checkFields)
          ? { ...(source.checkFields as Record<string, boolean>) }
          : {},
      assetFields:
        source?.assetFields && typeof source.assetFields === "object" && !Array.isArray(source.assetFields)
          ? { ...(source.assetFields as Record<string, unknown>) }
          : {},
    };
  }

  private hasReplicaAssetBinding(
    formData: Record<string, unknown> | null | undefined,
    scope: "reporting" | "countersigning",
    binding: "signature" | "official-stamp",
  ) {
    const { assetFields } = this.readReplicaState(formData);

    return Object.entries(assetFields).some(
      ([key, value]) => key.startsWith(`asset:${scope}:`) && key.includes(binding) && Boolean(value),
    );
  }

  private buildValidationFormData(
    acr: {
      reportingOfficer: {
        userAssets?: Array<{
          id: string;
          assetType: "SIGNATURE" | "STAMP";
          storageType: FileStorageType;
          isActive: boolean;
        }>;
      };
      countersigningOfficer?: {
        userAssets?: Array<{
          id: string;
          assetType: "SIGNATURE" | "STAMP";
          storageType: FileStorageType;
          isActive: boolean;
        }>;
      } | null;
    },
    formData: Record<string, unknown> | null | undefined,
  ) {
    const nextFormData =
      formData && typeof formData === "object" && !Array.isArray(formData)
        ? { ...formData }
        : {};
    const replicaState = this.readReplicaState(nextFormData);

    const reportingSignature = acr.reportingOfficer.userAssets?.find((asset) => asset.assetType === "SIGNATURE" && asset.isActive);
    const reportingStamp = acr.reportingOfficer.userAssets?.find((asset) => asset.assetType === "STAMP" && asset.isActive);

    if (reportingSignature && !this.hasReplicaAssetBinding(nextFormData, "reporting", "signature")) {
      replicaState.assetFields["asset:reporting:profile-signature"] = {
        source: "PROFILE",
        userAssetId: reportingSignature.id,
        storageType: reportingSignature.storageType ?? FileStorageType.LOCAL,
      };
    }

    if (reportingStamp && !this.hasReplicaAssetBinding(nextFormData, "reporting", "official-stamp")) {
      replicaState.assetFields["asset:reporting:profile-official-stamp"] = {
        source: "PROFILE",
        userAssetId: reportingStamp.id,
        storageType: reportingStamp.storageType ?? FileStorageType.LOCAL,
      };
    }

    const countersigningSignature = acr.countersigningOfficer?.userAssets?.find(
      (asset) => asset.assetType === "SIGNATURE" && asset.isActive,
    );
    const countersigningStamp = acr.countersigningOfficer?.userAssets?.find(
      (asset) => asset.assetType === "STAMP" && asset.isActive,
    );

    if (countersigningSignature && !this.hasReplicaAssetBinding(nextFormData, "countersigning", "signature")) {
      replicaState.assetFields["asset:countersigning:profile-signature"] = {
        source: "PROFILE",
        userAssetId: countersigningSignature.id,
        storageType: countersigningSignature.storageType ?? FileStorageType.LOCAL,
      };
    }

    if (countersigningStamp && !this.hasReplicaAssetBinding(nextFormData, "countersigning", "official-stamp")) {
      replicaState.assetFields["asset:countersigning:profile-official-stamp"] = {
        source: "PROFILE",
        userAssetId: countersigningStamp.id,
        storageType: countersigningStamp.storageType ?? FileStorageType.LOCAL,
      };
    }

    const roName = (acr.reportingOfficer as { displayName?: string }).displayName;
    const roDesignation = (acr.reportingOfficer as { employeeProfiles?: Array<{ designation?: string }> }).employeeProfiles?.[0]?.designation;
    if (roName && !replicaState.textFields["text:reporting:reporting-officer-name"]) {
      replicaState.textFields["text:reporting:reporting-officer-name"] = roName;
    }
    if (roDesignation && !replicaState.textFields["text:reporting:reporting-officer-designation"]) {
      replicaState.textFields["text:reporting:reporting-officer-designation"] = roDesignation;
    }

    const cso = acr.countersigningOfficer as { displayName?: string; employeeProfiles?: Array<{ designation?: string }> } | null | undefined;
    if (cso?.displayName && !replicaState.textFields["text:countersigning:countersigning-officer-name"]) {
      replicaState.textFields["text:countersigning:countersigning-officer-name"] = cso.displayName;
    }
    if (cso?.employeeProfiles?.[0]?.designation && !replicaState.textFields["text:countersigning:countersigning-officer-designation"]) {
      replicaState.textFields["text:countersigning:countersigning-officer-designation"] = cso.employeeProfiles[0].designation;
    }

    return {
      ...nextFormData,
      replicaState,
    } satisfies Record<string, unknown>;
  }

  private mergeFormData(
    existingFormData: Record<string, unknown> | null | undefined,
    incomingFormData: Record<string, unknown> | null | undefined,
    actorName: string,
    actorRole: UserRole,
  ) {
    return this.withWorkflowMeta(
      {
        ...(existingFormData ?? {}),
        ...(incomingFormData ?? {}),
      },
      actorName,
      actorRole,
    );
  }

  private withWorkflowMeta(
    formData: Record<string, unknown> | null | undefined,
    actorName: string,
    actorRole: UserRole,
  ) {
    return {
      ...(formData ?? {}),
      workflowMeta: {
        lastEditedAt: new Date().toISOString(),
        lastEditedBy: actorName,
        lastEditedRole: displayRole(actorRole),
      },
    } satisfies Record<string, unknown>;
  }

  private buildEmployeeMetadataSnapshot(record: AcrSummaryRecord["employee"]) {
    const employeeSummary = mapEmployee(record);
    return {
      ...employeeSummary,
      scopeTrack: record.scopeTrack,
      wingId: record.wingId,
      directorateId: record.directorateId,
      regionId: record.regionId,
      zoneId: record.zoneId,
      circleId: record.circleId,
      stationId: record.stationId,
      branchId: record.branchId,
      cellId: record.cellId,
      officeId: record.officeId,
      departmentId: record.departmentId,
      reportingOfficerId: record.reportingOfficerId,
      countersigningOfficerId: record.countersigningOfficerId,
      reportingOfficerName: record.reportingOfficer?.displayName ?? null,
      countersigningOfficerName: record.countersigningOfficer?.displayName ?? null,
      capturedAt: new Date().toISOString(),
    };
  }

  private async createWorkflowNotification(params: {
    userId: string | null | undefined;
    acrId: string;
    type: NotificationType;
    title: string;
    message: string;
  }) {
    if (!params.userId) {
      return;
    }

    await this.prisma.notification.create({
      data: {
        userId: params.userId,
        acrRecordId: params.acrId,
        type: params.type,
        title: params.title,
        message: params.message,
      },
    });
  }

  private async readDueDays(keys: string[], fallback: number) {
    for (const key of keys) {
      const value = await this.prisma.adminSetting.findUnique({
        where: { key },
        select: { value: true },
      });
      const parsed = Number(value?.value);
      if (!Number.isNaN(parsed) && parsed > 0) {
        return parsed;
      }
    }

    return fallback;
  }

  private async resolveSecretBranchAssignment(templateFamily: TemplateFamilyCode) {
    await ensureTemplateCatalog(this.prisma);

    const routingRule = await this.prisma.secretBranchRoutingRule.findFirst({
      where: {
        templateFamily,
        isActive: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const reviewDeskCode = routingRule?.reviewDeskCode ?? SecretBranchDeskCode.DA1;
    const verificationDeskCode = routingRule?.verificationDeskCode ?? SecretBranchDeskCode.AD_SECRET_BRANCH;

    const [reviewDesk, verifierDesk] = await Promise.all([
      this.prisma.secretBranchStaffProfile.findFirst({
        where: {
          deskCode: reviewDeskCode,
          isActive: true,
          user: {
            isActive: true,
          },
        },
        include: {
          user: true,
        },
        orderBy: { createdAt: "asc" },
      }),
      this.prisma.secretBranchStaffProfile.findFirst({
        where: {
          deskCode: verificationDeskCode,
          isActive: true,
          canVerify: true,
          user: {
            isActive: true,
          },
        },
        include: {
          user: true,
        },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    return {
      reviewDeskCode,
      verificationDeskCode,
      reviewDeskUser: reviewDesk?.user ?? null,
      verificationUser: verifierDesk?.user ?? null,
    };
  }

  private async ensureArchiveRecord(acr: AcrSummaryRecord, archivedById: string, tx: Prisma.TransactionClient) {
    const employeeSnapshot = (acr.employeeMetadataSnapshot as Record<string, unknown> | null) ?? this.buildEmployeeMetadataSnapshot(acr.employee);
    const documentPath = acr.archiveRecord?.documentPath ?? `archive/${acr.acrNo.replaceAll("/", "-")}.pdf`;

    const archiveRecord = await tx.archiveRecord.upsert({
      where: {
        acrRecordId: acr.id,
      },
      create: {
        acrRecordId: acr.id,
        employeeId: acr.employeeId,
        source: ArchiveRecordSource.WORKFLOW_FINAL,
        templateFamily: acr.templateVersion.family,
        reportingPeriodFrom: acr.reportingPeriodFrom,
        reportingPeriodTo: acr.reportingPeriodTo,
        archiveReference: documentPath,
        positionTitle: acr.employee.positionTitle,
        employeeName: acr.employee.name,
        employeeServiceNumber: acr.employee.serviceNumber,
        employeeCnic: acr.employee.cnic,
        employeePosting: acr.employee.posting,
        wingId: acr.employee.wingId,
        directorateId: acr.employee.directorateId,
        regionId: acr.employee.regionId,
        zoneId: acr.employee.zoneId,
        circleId: acr.employee.circleId,
        stationId: acr.employee.stationId,
        branchId: acr.employee.branchId,
        cellId: acr.employee.cellId,
        officeId: acr.employee.officeId,
        departmentId: acr.employee.departmentId,
        organizationSnapshot: employeeSnapshot as Prisma.InputJsonValue,
        documentPath,
        isVerified: true,
        uploadedById: acr.secretBranchAllocatedToId ?? archivedById,
        verifiedById: archivedById,
        verifiedAt: new Date(),
      },
      update: {
        source: ArchiveRecordSource.WORKFLOW_FINAL,
        templateFamily: acr.templateVersion.family,
        reportingPeriodFrom: acr.reportingPeriodFrom,
        reportingPeriodTo: acr.reportingPeriodTo,
        archiveReference: documentPath,
        positionTitle: acr.employee.positionTitle,
        employeeName: acr.employee.name,
        employeeServiceNumber: acr.employee.serviceNumber,
        employeeCnic: acr.employee.cnic,
        employeePosting: acr.employee.posting,
        wingId: acr.employee.wingId,
        directorateId: acr.employee.directorateId,
        regionId: acr.employee.regionId,
        zoneId: acr.employee.zoneId,
        circleId: acr.employee.circleId,
        stationId: acr.employee.stationId,
        branchId: acr.employee.branchId,
        cellId: acr.employee.cellId,
        officeId: acr.employee.officeId,
        departmentId: acr.employee.departmentId,
        organizationSnapshot: employeeSnapshot as Prisma.InputJsonValue,
        documentPath,
        isVerified: true,
        verifiedById: archivedById,
        verifiedAt: new Date(),
      },
    });

    await tx.fileAsset.updateMany({
      where: {
        acrRecordId: acr.id,
        kind: "DOCUMENT",
      },
      data: {
        archiveRecordId: archiveRecord.id,
      },
    });

    await tx.archiveSnapshot.upsert({
      where: { acrRecordId: acr.id },
      create: {
        acrRecordId: acr.id,
        archivedById,
        documentPath,
        checksum: `${acr.id}-checksum`,
        immutableHash: `${acr.id}-immutable`,
      },
      update: {
        archivedById,
        documentPath,
      },
    });

    const submissionCertPath = `certificates/${acr.acrNo.replaceAll("/", "-")}-submission-cert.pdf`;
    await tx.acrRecord.update({
      where: { id: acr.id },
      data: { submissionCertificatePath: submissionCertPath },
    });

    return archiveRecord;
  }

  private actionTimelineLabel(action: AcrAction) {
    switch (action) {
      case "submit_to_reporting":
        return "Submitted to Reporting Officer";
      case "forward_to_countersigning":
        return "Forwarded to Countersigning Officer";
      case "submit_to_secret_branch":
        return "Submitted to Secret Branch";
      case "complete_secret_branch_review":
        return "Secret Branch review completed";
      case "verify_secret_branch":
        return "Secret Branch verification completed";
      case "return_to_clerk":
        return "Returned to Clerk";
      case "return_to_reporting":
        return "Returned to Reporting Officer";
      case "return_to_countersigning":
        return "Returned to Countersigning Officer";
      case "save_draft":
      default:
        return "Draft Saved";
    }
  }

  private isReturnedState(state: AcrWorkflowState) {
    return state === AcrWorkflowState.RETURNED_TO_CLERK
      || state === AcrWorkflowState.RETURNED_TO_REPORTING
      || state === AcrWorkflowState.RETURNED_TO_COUNTERSIGNING;
  }

  private statusToWorkflowStates(status: string): AcrWorkflowState[] | null {
    const mapping: Record<string, AcrWorkflowState[]> = {
      "Draft": [AcrWorkflowState.DRAFT],
      "Pending Admin Office Forwarding": [AcrWorkflowState.PENDING_ADMIN_FORWARDING],
      "Pending Secret Cell Intake": [AcrWorkflowState.PENDING_SECRET_CELL_INTAKE],
      "Pending Reporting Officer": [AcrWorkflowState.PENDING_REPORTING],
      "Pending Reporting": [AcrWorkflowState.PENDING_REPORTING],
      "Pending Countersigning Officer": [AcrWorkflowState.PENDING_COUNTERSIGNING],
      "Pending Countersigning": [AcrWorkflowState.PENDING_COUNTERSIGNING],
      "Pending Secret Branch Review": [AcrWorkflowState.PENDING_SECRET_BRANCH_REVIEW],
      "Pending Secret Branch Verification": [AcrWorkflowState.PENDING_SECRET_BRANCH_VERIFICATION],
      "Returned to Clerk": [AcrWorkflowState.RETURNED_TO_CLERK],
      "Returned to Reporting Officer": [AcrWorkflowState.RETURNED_TO_REPORTING],
      "Returned to Countersigning Officer": [AcrWorkflowState.RETURNED_TO_COUNTERSIGNING],
      "Returned to Admin Office": [AcrWorkflowState.RETURNED_TO_ADMIN_OFFICE],
      "Archived": [AcrWorkflowState.ARCHIVED],
    };
    return mapping[status] ?? null;
  }

  async list(userId: string, activeRole: UserRole, status?: string, priority?: string, query?: string) {
    const user = await loadScopedUser(this.prisma, userId, activeRole);
    const accessWhere = buildAcrAccessPreFilter(user);

    const statusStates = status ? this.statusToWorkflowStates(status) : null;

    const where: Prisma.AcrRecordWhereInput = {
      ...(accessWhere ?? {}),
      ...(priority === "true" ? { isPriority: true } : {}),
      ...(statusStates ? { workflowState: { in: statusStates } } : {}),
      ...(query
        ? {
            OR: [
              { acrNo: { contains: query, mode: "insensitive" as const } },
              { employee: { name: { contains: query, mode: "insensitive" as const } } },
              { employee: { cnic: { contains: query, mode: "insensitive" as const } } },
              { employee: { serviceNumber: { contains: query, mode: "insensitive" as const } } },
            ],
          }
        : {}),
    };

    const acrs = await this.prisma.acrRecord.findMany({
      where,
      include: ACR_SUMMARY_INCLUDE,
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    const employeeSafe = activeRole === UserRole.EMPLOYEE;
    const visible = acrs
      .filter((acr) => canAccessAcr(user, acr))
      .map((acr) => mapAcr(acr, this.workflowService, { employeeSafe }));

    return {
      items: visible,
      total: visible.length,
    };
  }

  async detail(userId: string, activeRole: UserRole, acrId: string) {
    const user = await loadScopedUser(this.prisma, userId, activeRole);
    const acr = await this.prisma.acrRecord.findUnique({
      where: { id: acrId },
      include: ACR_DETAIL_INCLUDE,
    });

    if (!acr) {
      throw new NotFoundException("ACR not found.");
    }

    if (!canAccessAcr(user, acr)) {
      throw new ForbiddenException("You are not allowed to access this ACR.");
    }

    const employeeSafe = activeRole === UserRole.EMPLOYEE;

    return {
      ...mapAcr(acr, this.workflowService, { employeeSafe }),
      timeline: acr.timeline.map((entry) => mapTimeline(entry, { employeeSafe })),
      archiveReference: employeeSafe ? null : acr.archiveRecord?.archiveReference ?? acr.archiveSnapshot?.documentPath ?? null,
    };
  }

  async create(userId: string, activeRole: UserRole, dto: { employeeId: string; reportingPeriodFrom: string; reportingPeriodTo: string; isPriority?: boolean; formData?: Record<string, unknown>; templateFamilyOverride?: import("@prisma/client").TemplateFamilyCode; }, ipAddress = "0.0.0.0") {
    const user = await loadScopedUser(this.prisma, userId, activeRole);

    if (!canCreateAcr(user)) {
      throw new ForbiddenException("Only clerks or system administrators can initiate ACRs.");
    }

    await ensureTemplateCatalog(this.prisma);

    const employee = await this.prisma.employee.findUnique({
      where: { id: dto.employeeId },
      include: {
        wing: true,
        directorate: true,
        region: true,
        zone: true,
        circle: true,
        station: true,
        branch: true,
        cell: true,
        office: true,
        department: true,
        reportingOfficer: {
          include: {
            employeeProfiles: {
              select: {
                designation: true,
              },
            },
          },
        },
        countersigningOfficer: {
          include: {
            employeeProfiles: {
              select: {
                designation: true,
              },
            },
          },
        },
      },
    });

    if (!employee) {
      throw new NotFoundException("Employee not found.");
    }

    if (employee.status === "SUSPENDED" || employee.status === "AWAITING_POSTING") {
      throw new BadRequestException(
        `ACR cannot be initiated for an employee who is currently ${employee.status.toLowerCase().replace(/_/g, " ")}.`,
      );
    }

    const periodValidation = validateReportingPeriod(
      new Date(dto.reportingPeriodFrom),
      new Date(dto.reportingPeriodTo),
    );
    if (periodValidation) {
      throw new BadRequestException(periodValidation);
    }

    const resolvedFamily = dto.templateFamilyOverride ?? employee.templateFamily;
    const template = await this.prisma.templateVersion.findFirst({
      where: {
        family: resolvedFamily,
        isActive: true,
      },
      orderBy: { createdAt: "desc" },
    });

    if (!template) {
      throw new NotFoundException("No active template is configured for the employee category.");
    }

    const initialFormData = dto.formData
      ? this.withWorkflowMeta(dto.formData, user.displayName, user.activeRole)
      : undefined;
    const employeeSnapshot = this.buildEmployeeMetadataSnapshot(employee);

    const calendarYear = deriveCalendarYear(new Date(dto.reportingPeriodFrom));
    const gradeDueDate = getGradeSubmissionDeadline(employee.bps, calendarYear);
    const dueDate = getRoDeadline(new Date(), gradeDueDate);

    const existingAcr = await this.prisma.acrRecord.findFirst({
      where: { employeeId: employee.id, calendarYear },
      select: { id: true, acrNo: true, workflowState: true },
    });
    if (existingAcr) {
      throw new BadRequestException(
        `An ACR already exists for this employee for calendar year ${calendarYear} (${existingAcr.acrNo}, status: ${mapWorkflowState(existingAcr.workflowState)}).`,
      );
    }

    if (!employee.reportingOfficerId) {
      throw new BadRequestException(
        "This employee has no Reporting Officer assigned. Assign a Reporting Officer before initiating the ACR.",
      );
    }

    if (template.requiresCountersigning && !employee.countersigningOfficerId) {
      throw new BadRequestException(
        "This employee has no Countersigning Officer assigned, but the template requires countersigning.",
      );
    }

    const acr = await this.prisma.$transaction(async (tx) => {
      const created = await tx.acrRecord.create({
        data: {
          acrNo: `FIA/ACR/${new Date(dto.reportingPeriodFrom).getFullYear()}-${new Date(dto.reportingPeriodTo).getFullYear().toString().slice(-2)}/${resolvedFamily}/${Date.now().toString().slice(-4)}`,
          employeeId: employee.id,
          initiatedById: user.id,
          reportingOfficerId: employee.reportingOfficerId!,
          countersigningOfficerId: template.requiresCountersigning ? employee.countersigningOfficerId : null,
          currentHolderId: user.id,
          templateVersionId: template.id,
          workflowState: AcrWorkflowState.DRAFT,
          statusLabel: "Draft",
          reportingPeriodFrom: new Date(dto.reportingPeriodFrom),
          reportingPeriodTo: new Date(dto.reportingPeriodTo),
          calendarYear,
          gradeDueDate,
          dueDate,
          isPriority: Boolean(dto.isPriority),
          formData: initialFormData as Prisma.InputJsonValue | undefined,
          employeeMetadataSnapshot: employeeSnapshot as Prisma.InputJsonValue,
        },
        include: ACR_SUMMARY_INCLUDE,
      });

      await tx.acrTimelineEntry.create({
        data: {
          acrRecordId: created.id,
          actorId: user.id,
          actorRole: displayRole(user.activeRole),
          action: "Draft Created",
          status: "completed",
        },
      });

      return created as AcrSummaryRecord;
    });

    await this.auditWriter.write({
        actorId: user.id,
        acrRecordId: acr.id,
        recordType: "ACR",
        recordId: acr.id,
        action: "ACR Created",
        actorRole: displayRole(user.activeRole),
        ipAddress,
        details: `Draft ACR created for ${employee.name}.`,
    });

    return mapAcr(acr, this.workflowService);
  }

  async updateFormData(userId: string, activeRole: UserRole, acrId: string, formData: Record<string, unknown>, ipAddress = "0.0.0.0") {
    const user = await loadScopedUser(this.prisma, userId, activeRole);
    const acr = await this.prisma.acrRecord.findUnique({
      where: { id: acrId },
      include: {
        employee: true,
      },
    });

    if (!acr) {
      throw new NotFoundException("ACR not found.");
    }

    if (!canAccessAcr(user, acr)) {
      throw new ForbiddenException("You are not allowed to access this ACR.");
    }

    if (!canEditAcrForm(user, acr)) {
      throw new ForbiddenException("The current role cannot edit the official form at this workflow stage.");
    }

    const nextFormData = this.mergeFormData(
      (acr.formData as Record<string, unknown> | null) ?? null,
      formData,
      user.displayName,
      user.activeRole,
    );

    const updated = await this.prisma.acrRecord.update({
      where: { id: acr.id },
      data: {
        formData: nextFormData as Prisma.InputJsonValue,
      },
      include: ACR_SUMMARY_INCLUDE,
    });

    await this.auditWriter.write({
      actorId: user.id,
      acrRecordId: acr.id,
      recordType: "ACR",
      recordId: acr.id,
      action: this.isReturnedState(acr.workflowState) ? "Returned ACR corrected" : "ACR form updated",
      actorRole: displayRole(user.activeRole),
      ipAddress,
      details: this.isReturnedState(acr.workflowState)
        ? "Returned ACR updated for correction and resubmission."
        : "Official replica fields updated.",
    });

    return mapAcr(updated, this.workflowService);
  }

  async transition(
    userId: string,
    activeRole: UserRole,
    acrId: string,
    action: AcrAction,
    remarks?: string,
    formData?: Record<string, unknown>,
    ipAddress = "0.0.0.0",
    targetDeskCode?: SecretBranchDeskCode,
  ) {
    const user = await loadScopedUser(this.prisma, userId, activeRole);
    const acr = await this.prisma.acrRecord.findUnique({
      where: { id: acrId },
      include: {
        ...ACR_SUMMARY_INCLUDE,
        timeline: {
          select: {
            actorId: true,
          },
        },
      },
    });

    if (!acr) {
      throw new NotFoundException("ACR not found.");
    }

    if (!canAccessAcr(user, acr)) {
      throw new ForbiddenException("You are not allowed to modify this ACR.");
    }

    if (!canTransitionAcr(user, acr, action)) {
      throw new ForbiddenException("This action is not permitted for your current assignment.");
    }

    if (!this.workflowService.canTransition(acr.workflowState, action, acr.templateVersion.family)) {
      throw new BadRequestException(
        `This ACR is already in '${mapWorkflowState(acr.workflowState)}'. Refresh the queue and reopen the latest record before taking another action.`,
      );
    }

    if (
      (action === "forward_to_countersigning" || action === "submit_to_secret_branch") &&
      (activeRole === UserRole.REPORTING_OFFICER || activeRole === UserRole.COUNTERSIGNING_OFFICER)
    ) {
      const actorEmployee = await this.prisma.employee.findFirst({
        where: { userId: user.id },
        select: { status: true },
      });
      if (actorEmployee?.status === "SUSPENDED") {
        throw new ForbiddenException(
          "Suspended officers cannot submit or countersign ACRs as per FIA Standing Order No. 02/2023.",
        );
      }
    }

    const nextFormData = formData
      ? this.mergeFormData(
          (acr.formData as Record<string, unknown> | null) ?? null,
          formData,
          user.displayName,
          user.activeRole,
        )
      : ((acr.formData as Record<string, unknown> | null) ?? null);
    const validationFormData = this.buildValidationFormData(acr, nextFormData);

    const formValidationMessage = getActionFormValidationMessage({
      action,
      workflowState: acr.workflowState,
      templateFamily: acr.templateVersion.family,
      formData: validationFormData,
    });

    if (formValidationMessage) {
      throw new BadRequestException(formValidationMessage);
    }

    const wasReturnedRecord = this.isReturnedState(acr.workflowState);
    const next = this.workflowService.nextStateForAction(action, acr.templateVersion.family);
    const secretBranchAssignment = action === "submit_to_secret_branch"
      ? await this.resolveSecretBranchAssignment(acr.templateVersion.family)
      : null;

    let assignedDaUser: { id: string } | null = null;
    if (action === "complete_secret_branch_review") {
      if (!targetDeskCode) {
        throw new BadRequestException("Please select a DA desk to assign this ACR.");
      }
      const daProfile = await this.prisma.secretBranchStaffProfile.findFirst({
        where: {
          deskCode: targetDeskCode,
          isActive: true,
          user: { isActive: true },
        },
        include: { user: true },
        orderBy: { createdAt: "asc" },
      });
      if (!daProfile) {
        throw new BadRequestException("No active Secret Branch staff found at the selected desk.");
      }
      assignedDaUser = daProfile.user;
    }

    if (action === "return_to_countersigning" && !acr.countersigningOfficerId) {
      throw new BadRequestException("This record does not have a countersigning officer assignment.");
    }

    if (action === "submit_to_secret_branch" && !secretBranchAssignment?.verificationUser) {
      throw new BadRequestException("No active Secret Branch Assistant Director is configured for this template family.");
    }

    let secretCellUserId: string | null = null;
    if (action === "admin_forward_to_piab" || action === "resubmit_after_rectification") {
      const secretCellProfile = await this.prisma.secretBranchStaffProfile.findFirst({
        where: { isActive: true, deskCode: "AD_SECRET_BRANCH" },
        select: { userId: true },
      });
      secretCellUserId = secretCellProfile?.userId ?? null;
    }

    const nextHolderId =
      action === "forward_to_admin_office"
        ? acr.initiatedById
        : action === "admin_forward_to_piab"
          ? secretCellUserId ?? acr.currentHolderId
          : action === "intake_accept"
            ? acr.reportingOfficerId
            : action === "intake_return"
              ? acr.initiatedById
              : action === "resubmit_after_rectification"
                ? secretCellUserId ?? acr.currentHolderId
                : action === "submit_to_reporting"
                  ? acr.reportingOfficerId
                  : action === "forward_to_countersigning"
                    ? acr.countersigningOfficerId
                    : action === "submit_to_secret_branch"
                      ? secretBranchAssignment?.verificationUser?.id ?? null
                      : action === "complete_secret_branch_review"
                        ? assignedDaUser?.id ?? acr.currentHolderId
                        : action === "return_to_clerk"
                          ? acr.initiatedById
                          : action === "return_to_reporting"
                            ? acr.reportingOfficerId
                            : action === "return_to_countersigning"
                              ? acr.countersigningOfficerId
                              : acr.currentHolderId;

    const gradeDue = acr.gradeDueDate ?? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
    const now = new Date();
    let nextDueDate: Date;

    if (next.workflowState === AcrWorkflowState.ARCHIVED) {
      nextDueDate = acr.dueDate;
    } else if (action === "forward_to_admin_office" || action === "resubmit_after_rectification") {
      nextDueDate = this.workflowService.getDueDate(now, 1);
    } else if (action === "admin_forward_to_piab") {
      nextDueDate = this.workflowService.getDueDate(now, 3);
    } else if (action === "intake_accept" || action === "submit_to_reporting") {
      nextDueDate = getRoDeadline(now, gradeDue);
    } else if (action === "intake_return") {
      nextDueDate = this.workflowService.getDueDate(now, 7);
    } else if (action === "forward_to_countersigning" || action === "return_to_countersigning") {
      nextDueDate = getCsoDeadline(now, gradeDue);
    } else if (action === "submit_to_secret_branch") {
      const sbDays = await this.readDueDays(["workflow.due_days.secret_branch_review", "workflow.due_days.secret_branch"], 5);
      nextDueDate = this.workflowService.getDueDate(now, sbDays);
    } else if (action === "complete_secret_branch_review") {
      const sbvDays = await this.readDueDays(["workflow.due_days.secret_branch_verification", "workflow.due_days.secret_branch"], 5);
      nextDueDate = this.workflowService.getDueDate(now, sbvDays);
    } else if (action === "return_to_clerk" || action === "return_to_reporting") {
      nextDueDate = getRoDeadline(now, gradeDue);
    } else {
      nextDueDate = getRoDeadline(now, gradeDue);
    }

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.acrRecord.update({
        where: { id: acr.id },
        data: {
          workflowState: next.workflowState,
          statusLabel: next.statusLabel,
          correctionRemarks: action.startsWith("return_") || action === "intake_return"
            ? remarks ?? acr.correctionRemarks
            : action === "intake_accept" ? null : acr.correctionRemarks,
          currentHolderId: nextHolderId,
          dueDate: nextDueDate,
          adminForwardedAt: action === "admin_forward_to_piab" ? new Date() : acr.adminForwardedAt,
          adminForwardedById: action === "admin_forward_to_piab" ? user.id : acr.adminForwardedById,
          intakeVerifiedAt: action === "intake_accept" ? new Date() : acr.intakeVerifiedAt,
          intakeVerifiedById: action === "intake_accept" ? user.id : acr.intakeVerifiedById,
          intakeDiscrepancies: action === "intake_return" ? remarks ?? null : action === "intake_accept" ? null : acr.intakeDiscrepancies,
          archivedAt: action === "verify_secret_branch" ? new Date() : acr.archivedAt,
          completedDate: action === "verify_secret_branch" ? new Date() : acr.completedDate,
          secretBranchDeskCode: action === "complete_secret_branch_review"
            ? targetDeskCode ?? acr.secretBranchDeskCode
            : acr.secretBranchDeskCode,
          secretBranchAllocatedToId: action === "complete_secret_branch_review"
            ? assignedDaUser?.id ?? acr.secretBranchAllocatedToId
            : acr.secretBranchAllocatedToId,
          secretBranchVerifiedById: action === "complete_secret_branch_review" ? user.id : acr.secretBranchVerifiedById,
          secretBranchSubmittedAt: action === "submit_to_secret_branch" ? new Date() : acr.secretBranchSubmittedAt,
          secretBranchReviewedAt: action === "verify_secret_branch" ? new Date() : acr.secretBranchReviewedAt,
          secretBranchVerifiedAt: action === "complete_secret_branch_review" ? new Date() : acr.secretBranchVerifiedAt,
          secretBranchVerificationNotes: action === "verify_secret_branch" ? remarks ?? acr.secretBranchVerificationNotes : acr.secretBranchVerificationNotes,
          returnToRole:
            action === "return_to_clerk"
              ? UserRole.CLERK
              : action === "return_to_reporting"
                ? UserRole.REPORTING_OFFICER
                : action === "return_to_countersigning"
                  ? UserRole.COUNTERSIGNING_OFFICER
                  : null,
          returnedByRole: action.startsWith("return_") ? user.activeRole : null,
          ...(formData ? { formData: nextFormData as Prisma.InputJsonValue } : {}),
        },
        include: ACR_SUMMARY_INCLUDE,
      });

      if (action === "verify_secret_branch") {
        await this.ensureArchiveRecord(updated, user.id, tx);
      }

      await tx.acrTimelineEntry.create({
        data: {
          acrRecordId: acr.id,
          actorId: user.id,
          actorRole: displayRole(user.activeRole),
          action: wasReturnedRecord && action === "submit_to_reporting"
            ? "Resubmitted to Reporting Officer"
            : wasReturnedRecord && action === "forward_to_countersigning"
              ? "Resubmitted to Countersigning Officer"
              : wasReturnedRecord && action === "submit_to_secret_branch"
                ? "Resubmitted to Secret Branch"
                : this.actionTimelineLabel(action),
          status: next.workflowState === AcrWorkflowState.ARCHIVED ? "completed" : action.startsWith("return_") ? "returned" : "completed",
          remarks: action.startsWith("return_") ? remarks : undefined,
        },
      });
    });

    await this.auditWriter.write({
      actorId: user.id,
      acrRecordId: acr.id,
      recordType: "ACR",
      recordId: acr.id,
      action: wasReturnedRecord && action === "submit_to_reporting"
        ? "ACR resubmitted to reporting"
        : wasReturnedRecord && action === "forward_to_countersigning"
          ? "ACR resubmitted to countersigning"
          : wasReturnedRecord && action === "submit_to_secret_branch"
            ? "ACR resubmitted to secret branch"
            : `ACR ${action}`,
      actorRole: displayRole(user.activeRole),
      ipAddress,
      details:
        wasReturnedRecord && action === "submit_to_reporting"
          ? `Corrected ACR resubmitted to ${acr.reportingOfficer.displayName}.`
          : wasReturnedRecord && action === "forward_to_countersigning"
            ? `Corrected ACR resubmitted to ${acr.countersigningOfficer?.displayName ?? "countersigning officer"}.`
            : wasReturnedRecord && action === "submit_to_secret_branch"
              ? "Corrected ACR resubmitted to Secret Branch."
              : remarks ?? `ACR transitioned to ${next.statusLabel}.`,
    });

    if (action === "submit_to_reporting") {
      await this.createWorkflowNotification({
        userId: acr.reportingOfficerId,
        acrId: acr.id,
        type: NotificationType.INFO,
        title: wasReturnedRecord ? "Corrected ACR Resubmitted" : "New ACR Assigned",
        message: wasReturnedRecord
          ? `Corrected ACR ${acr.acrNo} has been resubmitted for review.`
          : `ACR ${acr.acrNo} has been forwarded to you for review.`,
      });
    }

    if (action === "forward_to_countersigning") {
      await this.createWorkflowNotification({
        userId: acr.countersigningOfficerId,
        acrId: acr.id,
        type: NotificationType.INFO,
        title: wasReturnedRecord ? "Corrected ACR Resubmitted" : "Countersigning Review Required",
        message: wasReturnedRecord
          ? `Corrected ACR ${acr.acrNo} has been resubmitted for countersigning review.`
          : `ACR ${acr.acrNo} has been submitted for countersigning review.`,
      });
    }

    if (action === "submit_to_secret_branch") {
      await this.createWorkflowNotification({
        userId: secretBranchAssignment?.verificationUser?.id,
        acrId: acr.id,
        type: NotificationType.INFO,
        title: wasReturnedRecord ? "Corrected ACR Resubmitted" : "Secret Branch Review Required",
        message: wasReturnedRecord
          ? `Corrected ACR ${acr.acrNo} has been resubmitted for Secret Branch review.`
          : `ACR ${acr.acrNo} has been submitted for Secret Branch review.`,
      });
    }

    if (action === "complete_secret_branch_review") {
      await this.createWorkflowNotification({
        userId: assignedDaUser?.id,
        acrId: acr.id,
        type: NotificationType.INFO,
        title: "ACR Assigned to Your Desk",
        message: `ACR ${acr.acrNo} has been reviewed by the AD and assigned to your desk for completion.`,
      });
    }

    if (action === "verify_secret_branch") {
      await this.createWorkflowNotification({
        userId: acr.employee.userId,
        acrId: acr.id,
        type: NotificationType.SUCCESS,
        title: "ACR Archived",
        message: `ACR ${acr.acrNo} has been archived successfully.`,
      });
    }

    if (action === "return_to_clerk") {
      await this.createWorkflowNotification({
        userId: acr.initiatedById,
        acrId: acr.id,
        type: NotificationType.WARNING,
        title: "ACR Returned to Clerk",
        message: remarks?.trim() || `ACR ${acr.acrNo} has been returned to Clerk for correction.`,
      });
    }

    if (action === "return_to_reporting") {
      await this.createWorkflowNotification({
        userId: acr.reportingOfficerId,
        acrId: acr.id,
        type: NotificationType.WARNING,
        title: "ACR Returned to Reporting Officer",
        message: remarks?.trim() || `ACR ${acr.acrNo} has been returned to Reporting Officer for revision.`,
      });
    }

    if (action === "return_to_countersigning") {
      await this.createWorkflowNotification({
        userId: acr.countersigningOfficerId,
        acrId: acr.id,
        type: NotificationType.WARNING,
        title: "ACR Returned to Countersigning Officer",
        message: remarks?.trim() || `ACR ${acr.acrNo} has been returned to Countersigning Officer for revision.`,
      });
    }

    const refreshed = await this.prisma.acrRecord.findUniqueOrThrow({
      where: { id: acr.id },
      include: ACR_SUMMARY_INCLUDE,
    });

    return mapAcr(refreshed, this.workflowService);
  }
}
