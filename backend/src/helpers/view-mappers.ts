import type {
  AcrRecord,
  AcrTimelineEntry,
  ArchiveRecord,
  AuditLog,
  Employee,
  EmployeeDisciplinaryRecord,
  EmployeeLanguageProficiency,
  EmployeeReward,
  EmployeeTrainingCourse,
  Notification,
  Prisma,
  User,
} from "@prisma/client";
import { AcrWorkflowState, OrgScopeTrack } from "@prisma/client";
import { groupUserAssets, type ActiveUserAssetRecord } from "../common/user-asset.mapper";

type EmployeeWithOrg = Employee & {
  wing?: { name: string } | null;
  directorate?: { name: string } | null;
  region?: { name: string } | null;
  zone?: { name: string } | null;
  circle?: { name: string } | null;
  station?: { name: string } | null;
  branch?: { name: string } | null;
  cell?: { name: string } | null;
  office: { name: string };
  department?: { name: string } | null;
  reportingOfficer?: (User & { employeeProfiles?: Array<{ designation: string }>; userAssets?: ActiveUserAssetRecord[] }) | null;
  countersigningOfficer?: (User & { employeeProfiles?: Array<{ designation: string }>; userAssets?: ActiveUserAssetRecord[] }) | null;
  trainingCourses?: EmployeeTrainingCourse[];
  disciplinaryRecords?: EmployeeDisciplinaryRecord[];
  rewards?: EmployeeReward[];
  languages?: EmployeeLanguageProficiency[];
};

type AcrWithRelations = AcrRecord & {
  employee: EmployeeWithOrg;
  initiatedBy: User;
  currentHolder?: User | null;
  reportingOfficer: User & { employeeProfiles?: Array<{ designation: string }>; userAssets?: ActiveUserAssetRecord[] };
  countersigningOfficer: (User & { employeeProfiles?: Array<{ designation: string }>; userAssets?: ActiveUserAssetRecord[] }) | null;
  secretBranchAllocatedTo?: User | null;
  secretBranchVerifiedBy?: User | null;
  templateVersion: { family: string; version: string; requiresCountersigning?: boolean };
  timeline?: Array<{
    id?: string;
    actorId?: string | null;
    actorRole?: string;
    action?: string;
    status?: string;
    remarks?: string | null;
    createdAt?: Date;
    actor?: User | null;
  }>;
  archiveSnapshot?: { documentPath: string } | null;
  archiveRecord?: { archiveReference?: string | null; documentPath: string } | null;
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

type ArchiveRecordWithRelations = ArchiveRecord & {
  employee?: EmployeeWithOrg | null;
  uploadedBy?: User | null;
  verifiedBy?: User | null;
  acrRecord?: { acrNo: string } | null;
  files: Array<{
    id: string;
    kind: string;
    fileName: string;
    mimeType: string;
    storagePath: string;
  }>;
};

type OrgScopedRecord = {
  scopeTrack?: OrgScopeTrack | null;
  wingId?: string | null;
  directorateId?: string | null;
  regionId?: string | null;
  zoneId?: string | null;
  circleId?: string | null;
  stationId?: string | null;
  branchId?: string | null;
  cellId?: string | null;
  officeId?: string | null;
  departmentId?: string | null;
  wing?: { name: string } | null;
  directorate?: { name: string } | null;
  region?: { name: string } | null;
  zone?: { name: string } | null;
  circle?: { name: string } | null;
  station?: { name: string } | null;
  branch?: { name: string } | null;
  cell?: { name: string } | null;
  office?: { name: string } | null;
  department?: { name: string } | null;
};

function deriveAuditModule(log: Pick<AuditLog, "action" | "acrRecordId">) {
  const action = log.action.toLowerCase();

  if (log.acrRecordId || action.includes("acr") || action.includes("archive")) {
    return "ACR";
  }

  if (action.includes("login") || action.includes("logout") || action.includes("role switch") || action.includes("role changed")) {
    return "Authentication";
  }

  if (
    action.includes("profile") ||
    action.includes("password") ||
    action.includes("preference") ||
    action.includes("avatar") ||
    action.includes("signature") ||
    action.includes("stamp")
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
    action.includes("switched") ||
    action.includes("verify")
  ) {
    return "transition";
  }

  if (action.includes("archive") || action.includes("archived") || action.includes("finalized")) {
    return "archive";
  }

  if (action.includes("login") || action.includes("logout")) {
    return "authentication";
  }

  return "system";
}

function parseJsonRecord(value: Prisma.JsonValue | null | undefined) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function orgName(node?: { name: string } | null) {
  return node?.name ?? null;
}

function buildOrgSnapshot(scope: OrgScopedRecord) {
  return {
    scopeTrack: scope.scopeTrack ?? null,
    wingId: scope.wingId ?? null,
    wingName: orgName(scope.wing),
    directorateId: scope.directorateId ?? null,
    directorateName: orgName(scope.directorate),
    regionId: scope.regionId ?? null,
    regionName: orgName(scope.region),
    zoneId: scope.zoneId ?? null,
    zoneName: orgName(scope.zone),
    circleId: scope.circleId ?? null,
    circleName: orgName(scope.circle),
    stationId: scope.stationId ?? null,
    stationName: orgName(scope.station),
    branchId: scope.branchId ?? null,
    branchName: orgName(scope.branch),
    cellId: scope.cellId ?? null,
    cellName: orgName(scope.cell),
    officeId: scope.officeId ?? null,
    officeName: orgName(scope.office),
    departmentId: scope.departmentId ?? null,
    departmentName: orgName(scope.department),
  };
}

function displayScopeLine(scope: ReturnType<typeof buildOrgSnapshot>) {
  const labels = [
    scope.departmentName,
    scope.officeName,
    scope.cellName,
    scope.branchName,
    scope.stationName,
    scope.circleName,
    scope.zoneName,
    scope.regionName,
    scope.directorateName,
    scope.wingName,
  ].filter((value): value is string => Boolean(value));

  return labels.join(" / ");
}

export function formatDisplayDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function formatIsoDate(value?: Date | null) {
  return value ? value.toISOString() : null;
}

function buildServicePeriodMeta(from: Date, to: Date) {
  const startYear = from.getUTCFullYear();
  const endYear = to.getUTCFullYear();

  return {
    servicePeriodKey: `${startYear}-${String(endYear % 100).padStart(2, "0")}`,
    servicePeriodLabel: `${startYear}-${String(endYear % 100).padStart(2, "0")}`,
    reportingPeriodFrom: formatDisplayDate(from),
    reportingPeriodTo: formatDisplayDate(to),
    reportingYearStart: startYear,
    reportingYearEnd: endYear,
  };
}

function findLatestTimelineTimestamp(
  timeline: AcrWithRelations["timeline"] | undefined,
  predicates: string[],
) {
  if (!timeline || timeline.length === 0) {
    return null;
  }

  const loweredPredicates = predicates.map((value) => value.toLowerCase());

  for (let index = timeline.length - 1; index >= 0; index -= 1) {
    const action = timeline[index]?.action?.toLowerCase() ?? "";
    if (loweredPredicates.some((predicate) => action.includes(predicate))) {
      return formatIsoDate(timeline[index]?.createdAt ?? null);
    }
  }

  return null;
}

function deriveSecretBranchStatus(acr: AcrWithRelations) {
  if (acr.archivedAt || acr.workflowState === AcrWorkflowState.ARCHIVED) {
    return "Archived";
  }

  if (acr.secretBranchVerifiedAt) {
    return "Verified by Secret Branch";
  }

  if (acr.secretBranchReviewedAt) {
    return "Reviewed by Secret Branch";
  }

  if (acr.secretBranchSubmittedAt) {
    return "Submitted to Secret Branch";
  }

  if (acr.workflowState === AcrWorkflowState.PENDING_SECRET_BRANCH_REVIEW) {
    return "Pending Secret Branch Review";
  }

  if (acr.workflowState === AcrWorkflowState.PENDING_SECRET_BRANCH_VERIFICATION) {
    return "Pending Secret Branch Verification";
  }

  return "Not yet submitted to Secret Branch";
}

export function formatReportingPeriod(from: Date, to: Date) {
  return `${from.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} – ${to.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`;
}

function isSecretBranchRoleLabel(actorRole?: string | null) {
  return actorRole?.toLowerCase().includes("secret branch") ?? false;
}

export function mapEmployee(employee: EmployeeWithOrg) {
  const organization = buildOrgSnapshot(employee);

  return {
    id: employee.id,
    serviceNumber: employee.serviceNumber,
    name: employee.name,
    rank: employee.rank,
    designation: employee.designation,
    positionTitle: employee.positionTitle ?? null,
    bps: employee.bps,
    cnic: employee.cnic,
    mobile: employee.mobile,
    email: employee.email,
    scopeTrack: organization.scopeTrack,
    wingId: organization.wingId,
    wing: organization.wingName,
    directorateId: organization.directorateId,
    directorate: organization.directorateName,
    regionId: organization.regionId,
    region: organization.regionName,
    zoneId: organization.zoneId,
    zone: organization.zoneName,
    circleId: organization.circleId,
    circle: organization.circleName,
    stationId: organization.stationId,
    station: organization.stationName,
    branchId: organization.branchId,
    branch: organization.branchName,
    cellId: organization.cellId,
    cell: organization.cellName,
    officeId: organization.officeId,
    office: organization.officeName,
    departmentId: organization.departmentId,
    department: organization.departmentName,
    orgLabel: displayScopeLine(organization),
    posting: employee.posting,
    reportingOfficer: employee.reportingOfficer?.displayName ?? null,
    reportingOfficerDesignation: employee.reportingOfficer?.employeeProfiles?.[0]?.designation ?? null,
    countersigningOfficer: employee.countersigningOfficer?.displayName ?? null,
    countersigningOfficerDesignation: employee.countersigningOfficer?.employeeProfiles?.[0]?.designation ?? null,
    joiningDate: formatDisplayDate(employee.joiningDate),
    serviceYears: employee.serviceYears,
    address: employee.address,
    templateFamily: employee.templateFamily,
    // --- metadata fields ---
    gender: employee.gender ?? null,
    dateOfBirth: formatIsoDate(employee.dateOfBirth),
    basicPay: employee.basicPay ?? null,
    appointmentToBpsDate: formatIsoDate(employee.appointmentToBpsDate),
    educationLevel: employee.educationLevel ?? null,
    qualifications: employee.qualifications ?? null,
    fatherName: employee.fatherName ?? null,
    deputationType: employee.deputationType ?? null,
    natureOfDuties: employee.natureOfDuties ?? null,
    personnelNumber: employee.personnelNumber ?? null,
    serviceGroup: employee.serviceGroup ?? null,
    licenseType: employee.licenseType ?? null,
    vehicleType: employee.vehicleType ?? null,
    trainingCoursesText: employee.trainingCoursesText ?? null,
    trainingCourses: (employee.trainingCourses ?? []).map((course) => ({
      id: course.id,
      courseName: course.courseName,
      durationFrom: formatIsoDate(course.durationFrom),
      durationTo: formatIsoDate(course.durationTo),
      institution: course.institution ?? null,
      country: course.country ?? null,
    })),
    disciplinaryRecords: (employee.disciplinaryRecords ?? []).map((record) => ({
      id: record.id,
      type: record.type,
      description: record.description,
      year: record.year ?? null,
      outcome: record.outcome ?? null,
      awardedDate: formatIsoDate(record.awardedDate),
    })),
    rewards: (employee.rewards ?? []).map((reward) => ({
      id: reward.id,
      type: reward.type,
      description: reward.description,
      awardedDate: formatIsoDate(reward.awardedDate),
      awardedBy: reward.awardedBy ?? null,
    })),
    languages: (employee.languages ?? []).map((lang) => ({
      id: lang.id,
      language: lang.language,
      speaking: lang.speaking,
      reading: lang.reading,
      writing: lang.writing,
    })),
  };
}

export function mapAcr(
  acr: AcrWithRelations,
  workflowService: {
    isOverdue: (dueDate: Date, state: AcrWorkflowState) => boolean;
    overdueDays: (dueDate: Date) => number;
  },
  options?: {
    employeeSafe?: boolean;
  },
) {
  const overdue = workflowService.isOverdue(acr.dueDate, acr.workflowState);
  const reportingOfficerDesignation = acr.reportingOfficer.employeeProfiles?.[0]?.designation ?? "Reporting Officer";
  const countersigningOfficerDesignation = acr.countersigningOfficer?.employeeProfiles?.[0]?.designation ?? null;
  const employeeSafe = options?.employeeSafe ?? false;
  const servicePeriodMeta = buildServicePeriodMeta(acr.reportingPeriodFrom, acr.reportingPeriodTo);
  const submittedToReportingAt = findLatestTimelineTimestamp(acr.timeline, [
    "submitted to reporting officer",
    "resubmitted to reporting officer",
  ]);
  const forwardedToCountersigningAt = findLatestTimelineTimestamp(acr.timeline, ["forwarded to countersigning officer"]);
  const submittedToSecretBranchAt = acr.secretBranchSubmittedAt?.toISOString() ?? findLatestTimelineTimestamp(acr.timeline, ["submitted to secret branch"]);
  const secretBranchReviewedAt =
    acr.secretBranchReviewedAt?.toISOString() ?? findLatestTimelineTimestamp(acr.timeline, ["secret branch review completed"]);
  const secretBranchVerifiedAt =
    acr.secretBranchVerifiedAt?.toISOString() ?? findLatestTimelineTimestamp(acr.timeline, ["secret branch verification completed"]);
  const hasHistoricalPdf = Boolean(acr.archiveRecord?.documentPath || acr.archiveSnapshot?.documentPath);

  const currentHolderRole =
    acr.currentHolderId === acr.initiatedById
      ? "Clerk"
      : acr.currentHolderId === acr.reportingOfficerId
        ? "Reporting Officer"
        : acr.currentHolderId === acr.countersigningOfficerId
          ? "Countersigning Officer"
          : acr.currentHolderId === acr.secretBranchAllocatedToId
            || acr.currentHolderId === acr.secretBranchVerifiedById
            || acr.workflowState === AcrWorkflowState.PENDING_SECRET_BRANCH_REVIEW
            || acr.workflowState === AcrWorkflowState.PENDING_SECRET_BRANCH_VERIFICATION
            || acr.workflowState === AcrWorkflowState.ARCHIVED
            ? "Secret Branch"
            : null;
  const currentHolderName = employeeSafe && currentHolderRole === "Secret Branch"
    ? "Secret Branch"
    : acr.currentHolder?.displayName ?? null;
  const reviewerAssets = {
    reporting: groupUserAssets(acr.reportingOfficer.userAssets),
    countersigning: acr.countersigningOfficer ? groupUserAssets(acr.countersigningOfficer.userAssets) : null,
  };

  const base = {
    id: acr.id,
    acrNo: acr.acrNo,
    employee: mapEmployee(acr.employee),
    status: overdue ? "Overdue" : acr.statusLabel,
    workflowState: mapWorkflowState(acr.workflowState),
    currentHolderId: acr.currentHolderId,
    currentHolderName,
    currentHolderRole,
    reportingPeriod: formatReportingPeriod(acr.reportingPeriodFrom, acr.reportingPeriodTo),
    reportingPeriodFrom: servicePeriodMeta.reportingPeriodFrom,
    reportingPeriodTo: servicePeriodMeta.reportingPeriodTo,
    servicePeriodKey: servicePeriodMeta.servicePeriodKey,
    servicePeriodLabel: servicePeriodMeta.servicePeriodLabel,
    reportingYearStart: servicePeriodMeta.reportingYearStart,
    reportingYearEnd: servicePeriodMeta.reportingYearEnd,
    initiatedBy: acr.initiatedBy.displayName,
    initiatedDate: formatDisplayDate(acr.createdAt),
    submittedToReportingAt,
    forwardedToCountersigningAt,
    archivedAt: acr.archivedAt ? formatDisplayDate(acr.archivedAt) : null,
    hasHistoricalPdf,
    reportingOfficer: acr.reportingOfficer.displayName,
    countersigningOfficer: acr.countersigningOfficer?.displayName ?? null,
    dueDate: formatDisplayDate(acr.dueDate),
    completedDate: acr.completedDate ? formatDisplayDate(acr.completedDate) : null,
    isPriority: acr.isPriority,
    isOverdue: overdue,
    overdueDays: overdue ? workflowService.overdueDays(acr.dueDate) : undefined,
    hasAdverseRemarks: acr.hasAdverseRemarks ?? false,
    calendarYear: acr.calendarYear ?? null,
    gradeDueDate: acr.gradeDueDate ? formatDisplayDate(acr.gradeDueDate) : null,
    wing: acr.employee.wing?.name ?? acr.employee.region?.name ?? acr.employee.directorate?.name ?? "FIA",
    reportingOfficerDesignation,
    countersigningOfficerDesignation,
    reviewerAssets: employeeSafe ? undefined : reviewerAssets,
    remarks: employeeSafe ? undefined : acr.correctionRemarks ?? undefined,
    performanceScore: acr.performanceScore ?? undefined,
    templateFamily: acr.templateVersion.family,
    documentVersion: acr.templateVersion.version,
    secretBranch: {
      deskCode: acr.secretBranchDeskCode ?? null,
      allocatedTo: employeeSafe ? null : acr.secretBranchAllocatedTo?.displayName ?? null,
      verifiedBy: employeeSafe ? null : acr.secretBranchVerifiedBy?.displayName ?? null,
      submittedAt: submittedToSecretBranchAt,
      reviewedAt: secretBranchReviewedAt,
      verifiedAt: secretBranchVerifiedAt,
      verificationNotes: employeeSafe ? null : acr.secretBranchVerificationNotes ?? null,
      status: deriveSecretBranchStatus(acr),
    },
  };

  if (employeeSafe) {
    return base;
  }

  return {
    ...base,
    formData: (acr.formData as Record<string, unknown> | null) ?? null,
    employeeMetadataSnapshot: parseJsonRecord(acr.employeeMetadataSnapshot),
  };
}

export function mapArchiveRecord(record: ArchiveRecordWithRelations, options?: { employeeSafe?: boolean }) {
  const employeeSafe = options?.employeeSafe ?? false;
  const primaryDocument = record.files.find((file) => file.kind === "DOCUMENT") ?? null;
  const hasHistoricalPdf = Boolean(primaryDocument?.id || record.documentPath);
  const reportingPeriod =
    record.reportingPeriodFrom && record.reportingPeriodTo
      ? formatReportingPeriod(record.reportingPeriodFrom, record.reportingPeriodTo)
      : null;
  const snapshot = parseJsonRecord(record.organizationSnapshot);
  const employeeOrganization = record.employee ? buildOrgSnapshot(record.employee) : null;
  const organization = {
    scopeTrack: record.scopeTrack ?? employeeOrganization?.scopeTrack ?? null,
    wingId: record.wingId ?? employeeOrganization?.wingId ?? null,
    wingName: employeeOrganization?.wingName ?? (typeof snapshot?.wing === "string" ? snapshot.wing : null),
    directorateId: record.directorateId ?? employeeOrganization?.directorateId ?? null,
    directorateName: employeeOrganization?.directorateName ?? null,
    regionId: record.regionId ?? employeeOrganization?.regionId ?? null,
    regionName: employeeOrganization?.regionName ?? (typeof snapshot?.region === "string" ? snapshot.region : null),
    zoneId: record.zoneId ?? employeeOrganization?.zoneId ?? null,
    zoneName: employeeOrganization?.zoneName ?? (typeof snapshot?.zone === "string" ? snapshot.zone : null),
    circleId: record.circleId ?? employeeOrganization?.circleId ?? null,
    circleName: employeeOrganization?.circleName ?? (typeof snapshot?.circle === "string" ? snapshot.circle : null),
    stationId: record.stationId ?? employeeOrganization?.stationId ?? null,
    stationName: employeeOrganization?.stationName ?? (typeof snapshot?.station === "string" ? snapshot.station : null),
    branchId: record.branchId ?? employeeOrganization?.branchId ?? null,
    branchName: employeeOrganization?.branchName ?? (typeof snapshot?.branch === "string" ? snapshot.branch : null),
    cellId: record.cellId ?? employeeOrganization?.cellId ?? null,
    cellName: employeeOrganization?.cellName ?? (typeof snapshot?.cell === "string" ? snapshot.cell : null),
    officeId: record.officeId ?? employeeOrganization?.officeId ?? null,
    officeName: employeeOrganization?.officeName ?? (typeof snapshot?.office === "string" ? snapshot.office : null),
    departmentId: record.departmentId ?? employeeOrganization?.departmentId ?? null,
    departmentName: employeeOrganization?.departmentName ?? (typeof snapshot?.department === "string" ? snapshot.department : null),
  };

  return {
    id: record.id,
    source: record.source,
    scopeTrack: organization.scopeTrack,
    employeeId: record.employeeId,
    acrRecordId: record.acrRecordId ?? null,
    acrNo: record.acrRecord?.acrNo ?? null,
    employeeName: record.employeeName,
    employeeServiceNumber: record.employeeServiceNumber ?? null,
    employeeCnic: employeeSafe ? null : record.employeeCnic ?? null,
    employeePosting: record.employeePosting ?? null,
    templateFamily: record.templateFamily ?? null,
    reportingPeriodFrom: record.reportingPeriodFrom?.toISOString().slice(0, 10) ?? null,
    reportingPeriodTo: record.reportingPeriodTo?.toISOString().slice(0, 10) ?? null,
    reportingPeriod,
    hasHistoricalPdf,
    archiveReference: employeeSafe ? null : record.archiveReference ?? record.documentPath,
    documentFileId: employeeSafe ? null : primaryDocument?.id ?? null,
    documentFileName: employeeSafe ? null : primaryDocument?.fileName ?? null,
    documentUrl: employeeSafe ? null : primaryDocument ? `/files/${primaryDocument.id}/content` : null,
    positionTitle: record.positionTitle ?? null,
    isVerified: record.isVerified,
    createdAt: record.createdAt.toISOString(),
    verifiedAt: record.verifiedAt?.toISOString() ?? null,
    uploadedBy: employeeSafe ? null : record.uploadedBy?.displayName ?? null,
    verifiedBy: employeeSafe ? null : record.verifiedBy?.displayName ?? null,
    remarks: employeeSafe ? undefined : record.remarks ?? undefined,
    organization,
    orgLabel: displayScopeLine(organization),
    employee: record.employee ? mapEmployee(record.employee) : null,
  };
}

export function mapTimeline(entry: TimelineWithActor, options?: { employeeSafe?: boolean }) {
  const employeeSafe = options?.employeeSafe ?? false;
  const actor = employeeSafe
    ? (isSecretBranchRoleLabel(entry.actorRole) ? "Secret Branch" : entry.actor?.displayName ?? entry.actorRole)
    : entry.actor?.displayName ?? "System";
  const role = employeeSafe && isSecretBranchRoleLabel(entry.actorRole) ? "Secret Branch" : entry.actorRole;

  return {
    id: entry.id,
    action: entry.action,
    actor,
    role,
    timestamp: entry.createdAt.toLocaleString("en-PK"),
    status: entry.status as "completed" | "active" | "pending" | "returned",
    remarks: employeeSafe ? undefined : entry.remarks ?? undefined,
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
    case AcrWorkflowState.PENDING_ADMIN_FORWARDING:
      return "Pending Admin Office Forwarding";
    case AcrWorkflowState.PENDING_SECRET_CELL_INTAKE:
      return "Pending Secret Cell Intake";
    case AcrWorkflowState.PENDING_REPORTING:
      return "Pending Reporting";
    case AcrWorkflowState.PENDING_COUNTERSIGNING:
      return "Pending Countersigning";
    case AcrWorkflowState.PENDING_SECRET_BRANCH_REVIEW:
      return "Pending Secret Branch Review";
    case AcrWorkflowState.PENDING_SECRET_BRANCH_VERIFICATION:
      return "Pending Secret Branch Verification";
    case AcrWorkflowState.RETURNED_TO_CLERK:
      return "Returned to Clerk";
    case AcrWorkflowState.RETURNED_TO_REPORTING:
      return "Returned to Reporting Officer";
    case AcrWorkflowState.RETURNED_TO_COUNTERSIGNING:
      return "Returned to Countersigning Officer";
    case AcrWorkflowState.RETURNED_TO_ADMIN_OFFICE:
      return "Returned to Admin Office";
    case AcrWorkflowState.ARCHIVED:
      return "Archived";
    default:
      return "Draft";
  }
}
