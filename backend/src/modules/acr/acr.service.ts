import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AcrWorkflowState, NotificationType, Prisma, UserRole } from "@prisma/client";
import { PrismaService } from "../../common/prisma.service";
import { canAccessAcr, canCreateAcr, canEditAcrForm, canTransitionAcr, displayRole, loadScopedUser } from "../../helpers/security.utils";
import { mapAcr, mapTimeline } from "../../helpers/view-mappers";
import { WorkflowService, type AcrAction } from "../workflow/workflow.service";

@Injectable()
export class AcrService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workflowService: WorkflowService,
  ) {}

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

  async list(userId: string, activeRole: UserRole, status?: string, priority?: string, query?: string) {
    const user = await loadScopedUser(this.prisma, userId, activeRole);
    const acrs = await this.prisma.acrRecord.findMany({
      include: {
        employee: { include: { wing: true, zone: true, office: true } },
        initiatedBy: true,
        currentHolder: true,
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
        timeline: {
          select: {
            actorId: true,
          },
        },
        templateVersion: true,
      },
      orderBy: { createdAt: "desc" },
    });

    let visible = acrs.filter((acr) => canAccessAcr(user, acr)).map((acr) => mapAcr(acr, this.workflowService));

    if (status) {
      visible = visible.filter((item) => item.status === status);
    }

    if (priority === "true") {
      visible = visible.filter((item) => item.isPriority);
    }

    if (query) {
      const lowered = query.toLowerCase();
      visible = visible.filter((item) => {
        const searchableValues = [
          item.acrNo,
          item.employee.serviceNumber ?? "",
          item.employee.name,
          item.employee.cnic,
          item.employee.mobile,
          item.employee.rank,
          item.employee.designation ?? "",
          item.employee.posting,
          item.employee.office,
          item.employee.wing,
          item.employee.zone,
          item.reportingOfficer,
          item.countersigningOfficer ?? "",
          item.reportingPeriod,
          item.status,
          item.templateFamily,
        ];

        return searchableValues.some((value) => value.toLowerCase().includes(lowered));
      });
    }

    return {
      items: visible,
      total: visible.length,
    };
  }

  async detail(userId: string, activeRole: UserRole, acrId: string) {
    const user = await loadScopedUser(this.prisma, userId, activeRole);
    const acr = await this.prisma.acrRecord.findUnique({
      where: { id: acrId },
      include: {
        employee: { include: { wing: true, zone: true, office: true } },
        initiatedBy: true,
        currentHolder: true,
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
        templateVersion: true,
        timeline: {
          include: {
            actor: true,
          },
          orderBy: { createdAt: "asc" },
        },
        archiveSnapshot: true,
      },
    });

    if (!acr) {
      throw new NotFoundException("ACR not found.");
    }

    if (!canAccessAcr(user, acr)) {
      throw new ForbiddenException("You are not allowed to access this ACR.");
    }

    return {
      ...mapAcr(acr, this.workflowService),
      timeline: acr.timeline.map((entry) => mapTimeline(entry)),
      archiveReference: acr.archiveSnapshot?.documentPath ?? null,
    };
  }

  async create(userId: string, activeRole: UserRole, dto: { employeeId: string; reportingPeriodFrom: string; reportingPeriodTo: string; isPriority?: boolean; formData?: Record<string, unknown>; }) {
    const user = await loadScopedUser(this.prisma, userId, activeRole);

    if (!canCreateAcr(user)) {
      throw new ForbiddenException("Only clerks or system administrators can initiate ACRs.");
    }

    const employee = await this.prisma.employee.findUnique({
      where: { id: dto.employeeId },
      include: { reportingOfficer: true, countersigningOfficer: true },
    });

    if (!employee) {
      throw new NotFoundException("Employee not found.");
    }

    const template = await this.prisma.templateVersion.findFirst({
      where: {
        family: employee.templateFamily,
        isActive: true,
      },
      orderBy: { createdAt: "desc" },
    });

    if (!template) {
      throw new NotFoundException("No active template is configured for the employee category.");
    }

    const dueDays = Number((await this.prisma.adminSetting.findUnique({ where: { key: "workflow.due_days.reporting" } }))?.value ?? 10);
    const initialFormData = dto.formData
      ? this.withWorkflowMeta(dto.formData, user.displayName, user.activeRole)
      : undefined;

    const acr = await this.prisma.acrRecord.create({
      data: {
        acrNo: `FIA/ACR/${new Date(dto.reportingPeriodFrom).getFullYear()}-${new Date(dto.reportingPeriodTo).getFullYear().toString().slice(-2)}/${employee.templateFamily}/${Date.now().toString().slice(-4)}`,
        employeeId: employee.id,
        initiatedById: user.id,
        reportingOfficerId: employee.reportingOfficerId ?? user.id,
        countersigningOfficerId: template.requiresCountersigning ? employee.countersigningOfficerId : null,
        currentHolderId: user.id,
        templateVersionId: template.id,
        workflowState: AcrWorkflowState.DRAFT,
        statusLabel: "Draft",
        reportingPeriodFrom: new Date(dto.reportingPeriodFrom),
        reportingPeriodTo: new Date(dto.reportingPeriodTo),
        dueDate: this.workflowService.getDueDate(new Date(), dueDays),
        isPriority: Boolean(dto.isPriority),
        formData: initialFormData as Prisma.InputJsonValue | undefined,
      },
      include: {
        employee: { include: { wing: true, zone: true, office: true } },
        initiatedBy: true,
        currentHolder: true,
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
        timeline: {
          select: {
            actorId: true,
          },
        },
        templateVersion: true,
      },
    });

    await this.prisma.acrTimelineEntry.create({
      data: {
        acrRecordId: acr.id,
        actorId: user.id,
        actorRole: displayRole(user.activeRole),
        action: "Draft Created",
        status: "completed",
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: user.id,
        acrRecordId: acr.id,
        action: "ACR Created",
        actorRole: displayRole(user.activeRole),
        ipAddress: "127.0.0.1",
        details: `Draft ACR created for ${employee.name}.`,
      },
    });

    return mapAcr(acr, this.workflowService);
  }

  async updateFormData(userId: string, activeRole: UserRole, acrId: string, formData: Record<string, unknown>) {
    const user = await loadScopedUser(this.prisma, userId, activeRole);
    const acr = await this.prisma.acrRecord.findUnique({
      where: { id: acrId },
      include: { employee: true },
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

    const nextFormData = this.withWorkflowMeta(
      {
        ...((acr.formData as Record<string, unknown> | null) ?? {}),
        ...formData,
      },
      user.displayName,
      user.activeRole,
    );

    const updated = await this.prisma.acrRecord.update({
      where: { id: acr.id },
      data: {
        formData: nextFormData as Prisma.InputJsonValue,
      },
      include: {
        employee: { include: { wing: true, zone: true, office: true } },
        initiatedBy: true,
        currentHolder: true,
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
        timeline: {
          select: {
            actorId: true,
          },
        },
        templateVersion: true,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: user.id,
        acrRecordId: acr.id,
        action: acr.workflowState === AcrWorkflowState.RETURNED && user.activeRole === UserRole.CLERK ? "Returned ACR corrected" : "ACR form updated",
        actorRole: displayRole(user.activeRole),
        ipAddress: "127.0.0.1",
        details:
          acr.workflowState === AcrWorkflowState.RETURNED && user.activeRole === UserRole.CLERK
            ? "Returned ACR updated by Clerk for correction and resubmission."
            : "Official replica fields updated.",
      },
    });

    return mapAcr(updated, this.workflowService);
  }

  async transition(userId: string, activeRole: UserRole, acrId: string, action: AcrAction, remarks?: string) {
    const user = await loadScopedUser(this.prisma, userId, activeRole);
    const acr = await this.prisma.acrRecord.findUnique({
      where: { id: acrId },
      include: {
        templateVersion: true,
        employee: true,
        reportingOfficer: true,
        countersigningOfficer: true,
        initiatedBy: true,
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

    this.workflowService.assertTransition(acr.workflowState, action, acr.templateVersion.family);
    const wasReturnedRecord = acr.workflowState === AcrWorkflowState.RETURNED;
    const next = this.workflowService.nextStateForAction(action, acr.templateVersion.family);
    const secretBranchUser = action === "submit_to_secret_branch"
      ? await this.prisma.user.findFirst({
          where: { roleAssignments: { some: { role: UserRole.SECRET_BRANCH } } },
          orderBy: { createdAt: "asc" },
        })
      : null;
    const nextHolderId =
      action === "submit_to_reporting"
        ? acr.reportingOfficerId
        : action === "forward_to_countersigning"
          ? acr.countersigningOfficerId
          : action === "submit_to_secret_branch"
            ? secretBranchUser?.id ?? null
            : action === "return_to_clerk"
              ? acr.initiatedById
              : acr.currentHolderId;
    const closesRecord = action === "submit_to_secret_branch";

    const updated = await this.prisma.acrRecord.update({
      where: { id: acr.id },
      data: {
        workflowState: next.workflowState,
        statusLabel: next.statusLabel,
        correctionRemarks: remarks ?? acr.correctionRemarks,
        currentHolderId: nextHolderId,
        archivedAt: closesRecord ? new Date() : acr.archivedAt,
        completedDate: closesRecord ? new Date() : acr.completedDate,
      },
      include: {
        employee: { include: { wing: true, zone: true, office: true } },
        initiatedBy: true,
        currentHolder: true,
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
        timeline: {
          select: {
            actorId: true,
          },
        },
        templateVersion: true,
      },
    });

    await this.prisma.acrTimelineEntry.create({
      data: {
        acrRecordId: acr.id,
        actorId: user.id,
        actorRole: displayRole(user.activeRole),
        action: wasReturnedRecord && action === "submit_to_reporting" ? "resubmitted to reporting" : action.replaceAll("_", " "),
        status: next.workflowState === AcrWorkflowState.RETURNED ? "returned" : "completed",
        remarks,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: user.id,
        acrRecordId: acr.id,
        action: wasReturnedRecord && action === "submit_to_reporting" ? "ACR resubmitted to reporting" : `ACR ${action}`,
        actorRole: displayRole(user.activeRole),
        ipAddress: "127.0.0.1",
        details:
          wasReturnedRecord && action === "submit_to_reporting"
            ? `Corrected ACR resubmitted to ${acr.reportingOfficer.displayName}.`
            : remarks ?? `ACR transitioned to ${next.statusLabel}.`,
      },
    });

    if (next.workflowState === AcrWorkflowState.ARCHIVED) {
      await this.prisma.archiveSnapshot.upsert({
        where: { acrRecordId: acr.id },
        create: {
          acrRecordId: acr.id,
          archivedById: user.id,
          documentPath: `archive/${updated.acrNo.replaceAll("/", "-")}.pdf`,
          checksum: `${updated.id}-checksum`,
          immutableHash: `${updated.id}-immutable`,
        },
        update: {
          archivedById: user.id,
        },
      });
    }

    if (action === "submit_to_reporting") {
      await this.createWorkflowNotification({
        userId: acr.reportingOfficerId,
        acrId: acr.id,
        type: NotificationType.info,
        title: wasReturnedRecord ? "Corrected ACR Resubmitted" : "New ACR Assigned",
        message: wasReturnedRecord
          ? `Corrected ACR ${acr.acrNo} has been resubmitted by ${acr.initiatedBy.displayName} for review.`
          : `ACR ${acr.acrNo} has been forwarded to you for review.`,
      });
    }

    if (action === "forward_to_countersigning") {
      await this.createWorkflowNotification({
        userId: acr.countersigningOfficerId,
        acrId: acr.id,
        type: NotificationType.info,
        title: "Countersigning Review Required",
        message: `ACR ${acr.acrNo} has been submitted by ${acr.reportingOfficer.displayName} for countersigning review.`,
      });
    }

    if (action === "submit_to_secret_branch") {
      await this.createWorkflowNotification({
        userId: secretBranchUser?.id,
        acrId: acr.id,
        type: NotificationType.success,
        title: "ACR Finalized in Secret Branch",
        message:
          acr.templateVersion.family === "APS_STENOTYPIST"
            ? `ACR ${acr.acrNo} has been completed by ${acr.reportingOfficer.displayName} and archived in Secret Branch.`
            : `ACR ${acr.acrNo} has been finalized after countersigning review and archived in Secret Branch.`,
      });
    }

    if (action === "return_to_clerk") {
      await this.createWorkflowNotification({
        userId: acr.initiatedById,
        acrId: acr.id,
        type: NotificationType.warning,
        title: "ACR Returned for Correction",
        message: remarks?.trim() || `ACR ${acr.acrNo} has been returned to Clerk for correction.`,
      });
    }

    return mapAcr(updated, this.workflowService);
  }
}
