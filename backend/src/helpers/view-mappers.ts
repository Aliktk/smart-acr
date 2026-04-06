import type { AcrRecord, AcrTimelineEntry, AuditLog, Employee, Notification, Prisma, User } from "@prisma/client";
import { AcrWorkflowState } from "@prisma/client";

type EmployeeWithOrg = Employee & {
  wing: { name: string };
  zone: { name: string };
  office: { name: string };
  reportingOfficer?: (User & { employeeProfiles?: Array<{ designation: string }> }) | null;
  countersigningOfficer?: (User & { employeeProfiles?: Array<{ designation: string }> }) | null;
};

type AcrWithRelations = AcrRecord & {
  employee: EmployeeWithOrg;
  initiatedBy: User;
  currentHolder?: User | null;
  reportingOfficer: User & { employeeProfiles?: Array<{ designation: string }> };
  countersigningOfficer: (User & { employeeProfiles?: Array<{ designation: string }> }) | null;
  templateVersion: { family: string; version: string };
};

type TimelineWithActor = AcrTimelineEntry & {
  actor: User | null;
};

type NotificationWithAcr = Notification & {
  acrRecord: AcrRecord | null;
};

type AuditWithActor = AuditLog & {
  actor: User | null;
  acrRecord: AcrRecord | null;
};

function deriveAuditModule(log: Pick<AuditLog, "action" | "acrRecordId">) {
  const action = log.action.toLowerCase();

  if (log.acrRecordId || action.includes("acr")) {
    return "ACR";
  }

  if (action.includes("login") || action.includes("logout") || action.includes("role switch") || action.includes("role changed")) {
    return "Authentication";
  }

  if (
    action.includes("profile") ||
    action.includes("password") ||
    action.includes("preference") ||
    action.includes("avatar")
  ) {
    return "Settings";
  }

  if (action.includes("admin setting") || action.includes("system setting")) {
    return "Administration";
  }

  if (action.includes("user account") || action.includes("password reset")) {
    return "Administration";
  }

  return "System";
}

function deriveAuditEventType(log: Pick<AuditLog, "action">) {
  const action = log.action.toLowerCase();

  if (action.includes("created")) {
    return "create";
  }

  if (action.includes("updated") || action.includes("preferences") || action.includes("password") || action.includes("profile")) {
    return "update";
  }

  if (
    action.includes("submit") ||
    action.includes("forward") ||
    action.includes("return") ||
    action.includes("transition") ||
    action.includes("switched")
  ) {
    return "transition";
  }

  if (action.includes("archived") || action.includes("finalized")) {
    return "archive";
  }

  if (action.includes("login") || action.includes("logout")) {
    return "authentication";
  }

  return "system";
}

export function formatDisplayDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

export function formatReportingPeriod(from: Date, to: Date) {
  return `${from.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} – ${to.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`;
}

export function mapEmployee(employee: EmployeeWithOrg) {
  return {
    id: employee.id,
    serviceNumber: employee.serviceNumber,
    name: employee.name,
    rank: employee.rank,
    designation: employee.designation,
    bps: employee.bps,
    cnic: employee.cnic,
    mobile: employee.mobile,
    email: employee.email,
    wing: employee.wing.name,
    zone: employee.zone.name,
    office: employee.office.name,
    posting: employee.posting,
    reportingOfficer: employee.reportingOfficer?.displayName ?? null,
    reportingOfficerDesignation: employee.reportingOfficer?.employeeProfiles?.[0]?.designation ?? null,
    countersigningOfficer: employee.countersigningOfficer?.displayName ?? null,
    countersigningOfficerDesignation: employee.countersigningOfficer?.employeeProfiles?.[0]?.designation ?? null,
    joiningDate: formatDisplayDate(employee.joiningDate),
    serviceYears: employee.serviceYears,
    address: employee.address,
    templateFamily: employee.templateFamily,
  };
}

export function mapAcr(acr: AcrWithRelations, workflowService: { isOverdue: (dueDate: Date, state: AcrWorkflowState) => boolean; overdueDays: (dueDate: Date) => number; }) {
  const overdue = workflowService.isOverdue(acr.dueDate, acr.workflowState);
  const reportingOfficerDesignation = acr.reportingOfficer.employeeProfiles?.[0]?.designation ?? "Reporting Officer";
  const countersigningOfficerDesignation = acr.countersigningOfficer?.employeeProfiles?.[0]?.designation ?? null;
  const currentHolderRole =
    acr.currentHolderId === acr.initiatedById
      ? "Clerk"
      : acr.currentHolderId === acr.reportingOfficerId
        ? "Reporting Officer"
        : acr.currentHolderId === acr.countersigningOfficerId
          ? "Countersigning Officer"
          : acr.workflowState === AcrWorkflowState.ARCHIVED || acr.workflowState === AcrWorkflowState.SUBMITTED_TO_SECRET_BRANCH
            ? "Secret Branch"
            : null;

  return {
    id: acr.id,
    acrNo: acr.acrNo,
    employee: mapEmployee(acr.employee),
    status: overdue ? "Overdue" : acr.statusLabel,
    workflowState: mapWorkflowState(acr.workflowState),
    currentHolderId: acr.currentHolderId,
    currentHolderName: acr.currentHolder?.displayName ?? null,
    currentHolderRole,
    reportingPeriod: formatReportingPeriod(acr.reportingPeriodFrom, acr.reportingPeriodTo),
    initiatedBy: acr.initiatedBy.displayName,
    initiatedDate: formatDisplayDate(acr.createdAt),
    reportingOfficer: acr.reportingOfficer.displayName,
    countersigningOfficer: acr.countersigningOfficer?.displayName ?? null,
    dueDate: formatDisplayDate(acr.dueDate),
    completedDate: acr.completedDate ? formatDisplayDate(acr.completedDate) : null,
    isPriority: acr.isPriority,
    isOverdue: overdue,
    overdueDays: overdue ? workflowService.overdueDays(acr.dueDate) : undefined,
    wing: acr.employee.wing.name,
    reportingOfficerDesignation,
    countersigningOfficerDesignation,
    remarks: acr.correctionRemarks ?? undefined,
    performanceScore: acr.performanceScore ?? undefined,
    templateFamily: acr.templateVersion.family,
    documentVersion: acr.templateVersion.version,
    formData: (acr.formData as Record<string, unknown> | null) ?? null,
  };
}

export function mapTimeline(entry: TimelineWithActor) {
  return {
    id: entry.id,
    action: entry.action,
    actor: entry.actor?.displayName ?? "System",
    role: entry.actorRole,
    timestamp: entry.createdAt.toLocaleString("en-PK"),
    status: entry.status as "completed" | "active" | "pending" | "returned",
    remarks: entry.remarks ?? undefined,
  };
}

export function mapNotification(notification: NotificationWithAcr) {
  return {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    time: notification.createdAt.toLocaleString("en-PK"),
    read: Boolean(notification.readAt),
    acrId: notification.acrRecordId ?? undefined,
  };
}

export function mapAudit(log: AuditWithActor) {
  const module = deriveAuditModule(log);
  const eventType = deriveAuditEventType(log);

  return {
    id: log.id,
    action: log.action,
    description: log.details,
    details: log.details,
    actorId: log.actorId ?? undefined,
    actorName: log.actor?.displayName ?? "System",
    performedBy: log.actor?.displayName ?? "System",
    actorRole: log.actorRole,
    role: log.actorRole,
    recordType: log.recordType ?? (log.acrRecordId ? "ACR" : "System"),
    recordId: log.recordId ?? log.acrRecordId ?? undefined,
    acrId: log.acrRecordId ?? undefined,
    recordLabel: log.acrRecord?.acrNo ?? log.recordId ?? undefined,
    acrNo: log.acrRecord?.acrNo ?? undefined,
    module,
    eventType,
    timestamp: log.createdAt.toISOString(),
    displayTimestamp: log.createdAt.toLocaleString("en-PK"),
    ipAddress: log.ipAddress,
  };
}

export function mapWorkflowState(state: AcrWorkflowState) {
  switch (state) {
    case AcrWorkflowState.DRAFT:
      return "Draft";
    case AcrWorkflowState.PENDING_REPORTING:
      return "Pending Reporting";
    case AcrWorkflowState.PENDING_COUNTERSIGNING:
      return "Pending Countersigning";
    case AcrWorkflowState.SUBMITTED_TO_SECRET_BRANCH:
      return "Submitted to Secret Branch";
    case AcrWorkflowState.ARCHIVED:
      return "Archived";
    case AcrWorkflowState.RETURNED:
      return "Returned";
    default:
      return "Draft";
  }
}
