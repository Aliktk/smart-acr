import { ForbiddenException, Injectable } from "@nestjs/common";
import { AcrWorkflowState, Prisma, TemplateFamilyCode, UserRole } from "@prisma/client";
import { PrismaService } from "../../common/prisma.service";
import { canAccessAcr, canViewAnalytics, loadScopedUser, type ScopedUser } from "../../helpers/security.utils";
import { mapAcr } from "../../helpers/view-mappers";
import { WorkflowService } from "../workflow/workflow.service";
import {
  DASHBOARD_DATE_PRESETS,
  type DashboardAnalyticsQueryDto,
  type DashboardDatePreset,
} from "./dto/dashboard-analytics-query.dto";

const FULL_ANALYTICS_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.IT_OPS,
  UserRole.SECRET_BRANCH,
  UserRole.DG,
  UserRole.EXECUTIVE_VIEWER,
];

const ANALYTICS_ACR_INCLUDE = {
  employee: {
    include: {
      wing: true,
      zone: true,
      office: true,
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
      actorRole: true,
      action: true,
      status: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  },
  templateVersion: true,
  archiveSnapshot: true,
  auditLogs: {
    select: {
      action: true,
      createdAt: true,
    },
    where: {
      OR: [
        {
          action: {
            contains: "Export",
          },
        },
        {
          action: {
            contains: "Download",
          },
        },
      ],
    },
  },
} satisfies Prisma.AcrRecordInclude;

type AnalyticsAcrRecord = Prisma.AcrRecordGetPayload<{
  include: typeof ANALYTICS_ACR_INCLUDE;
}>;

type AnalyticsSummary = ReturnType<typeof mapAcr>;

type AnalyticsRecord = {
  raw: AnalyticsAcrRecord;
  summary: AnalyticsSummary;
  completionDate: Date | null;
  activityDate: Date;
  currentStage: "draft" | "reporting" | "countersigning" | "secret-branch" | "returned" | "archived";
  currentStatusLabel: string;
  returnCount: number;
  hadReturnBeforeArchive: boolean;
  secretSource: "reporting" | "countersigning" | "legacy";
  secretEntryDate: Date | null;
  downloadCount: number;
};

type DateWindow = {
  key: DashboardDatePreset;
  label: string;
  from: Date | null;
  to: Date;
  interval: "day" | "week" | "month";
};

type Bucket = {
  key: string;
  label: string;
  start: Date;
  end: Date;
};

type SeriesKey =
  | "initiated"
  | "pending"
  | "completed"
  | "overdue"
  | "archived"
  | "cumulativeArchived"
  | "receivedFromReporting"
  | "receivedFromCountersigning"
  | "returnedBeforeArchive"
  | "downloads"
  | "anomalies";

type TrendPoint = {
  key: string;
  label: string;
} & Record<SeriesKey, number>;

function templateFamilyLabel(family: TemplateFamilyCode) {
  switch (family) {
    case TemplateFamilyCode.ASSISTANT_UDC_LDC:
      return "Assistant / UDC / LDC";
    case TemplateFamilyCode.APS_STENOTYPIST:
      return "APS / Stenotypist";
    case TemplateFamilyCode.INSPECTOR_SI_ASI:
      return "Inspector / SI / ASI";
    case TemplateFamilyCode.SUPERINTENDENT_AINCHARGE:
      return "Superintendent / A/Incharge";
    default:
      return family;
  }
}

function toPercentage(part: number, whole: number) {
  if (whole <= 0) {
    return 0;
  }

  return Math.round((part / whole) * 100);
}

function average(values: number[]) {
  if (!values.length) {
    return 0;
  }

  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

function diffInDays(start: Date, end: Date) {
  return Math.max(1, Math.round(((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) * 10) / 10);
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function startOfWeek(date: Date) {
  const normalized = startOfDay(date);
  const day = normalized.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  normalized.setDate(normalized.getDate() + diff);
  return normalized;
}

function endOfWeek(date: Date) {
  const start = startOfWeek(date);
  return endOfDay(new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6));
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return endOfDay(new Date(date.getFullYear(), date.getMonth() + 1, 0));
}

function addDays(date: Date, days: number) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + days,
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
    date.getMilliseconds(),
  );
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function formatCompactDate(date: Date) {
  return date.toLocaleDateString("en-PK", {
    day: "2-digit",
    month: "short",
  });
}

function formatCompactMonth(date: Date) {
  return date.toLocaleDateString("en-PK", {
    month: "short",
    year: "2-digit",
  });
}

function bucketKey(date: Date, interval: DateWindow["interval"]) {
  if (interval === "day") {
    return startOfDay(date).toISOString();
  }

  if (interval === "week") {
    return startOfWeek(date).toISOString();
  }

  return startOfMonth(date).toISOString();
}

function createBuckets(window: DateWindow) {
  const buckets: Bucket[] = [];
  const from = window.from ?? startOfMonth(window.to);

  if (window.interval === "day") {
    let cursor = startOfDay(from);
    while (cursor <= window.to) {
      const start = startOfDay(cursor);
      buckets.push({
        key: start.toISOString(),
        label: formatCompactDate(start),
        start,
        end: endOfDay(start),
      });
      cursor = addDays(cursor, 1);
    }
    return buckets;
  }

  if (window.interval === "week") {
    let cursor = startOfWeek(from);
    while (cursor <= window.to) {
      const start = startOfWeek(cursor);
      buckets.push({
        key: start.toISOString(),
        label: `${formatCompactDate(start)} - ${formatCompactDate(endOfWeek(start))}`,
        start,
        end: endOfWeek(start),
      });
      cursor = addDays(cursor, 7);
    }
    return buckets;
  }

  let cursor = startOfMonth(from);
  while (cursor <= window.to) {
    const start = startOfMonth(cursor);
    buckets.push({
      key: start.toISOString(),
      label: formatCompactMonth(start),
      start,
      end: endOfMonth(start),
    });
    cursor = addMonths(cursor, 1);
  }
  return buckets;
}

function buildWindow(mode: "executive" | "secret-branch", preset: DashboardDatePreset, records: AnalyticsRecord[]): DateWindow {
  const now = new Date();
  const effectivePreset = DASHBOARD_DATE_PRESETS.includes(preset) ? preset : "180d";

  if (effectivePreset === "all") {
    const dates = records
      .map((record) => (mode === "secret-branch" ? record.activityDate : record.raw.createdAt))
      .filter((value): value is Date => Boolean(value))
      .sort((left, right) => left.getTime() - right.getTime());

    const from = dates[0] ? startOfMonth(dates[0]) : startOfMonth(addMonths(now, -11));
    return {
      key: effectivePreset,
      label: "All available activity",
      from,
      to: now,
      interval: "month",
    };
  }

  if (effectivePreset === "fy") {
    const fiscalStartYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
    return {
      key: effectivePreset,
      label: `Fiscal year ${fiscalStartYear}-${String((fiscalStartYear + 1) % 100).padStart(2, "0")}`,
      from: new Date(fiscalStartYear, 6, 1),
      to: now,
      interval: "month",
    };
  }

  const daySpan = effectivePreset === "30d"
    ? 30
    : effectivePreset === "90d"
      ? 90
      : effectivePreset === "365d"
        ? 365
        : 180;

  return {
    key: effectivePreset,
    label: `Last ${daySpan} days`,
    from: startOfDay(addDays(now, -(daySpan - 1))),
    to: now,
    interval: daySpan <= 31 ? "day" : daySpan <= 120 ? "week" : "month",
  };
}

function inWindow(date: Date | null | undefined, window: DateWindow) {
  if (!date) {
    return false;
  }

  if (!window.from) {
    return date <= window.to;
  }

  return date >= window.from && date <= window.to;
}

function normalizeAction(action: string) {
  return action.trim().toLowerCase();
}

function isReturnedAction(action: string) {
  return normalizeAction(action).includes("return");
}

function isSecretBranchAction(action: string) {
  return normalizeAction(action).includes("secret branch");
}

function isClosedStage(record: AnalyticsRecord) {
  return record.raw.workflowState === AcrWorkflowState.ARCHIVED;
}

function isPendingStage(record: AnalyticsRecord) {
  return record.raw.workflowState !== AcrWorkflowState.ARCHIVED && record.raw.workflowState !== AcrWorkflowState.RETURNED;
}

function isOverdueStage(record: AnalyticsRecord) {
  return record.summary.isOverdue;
}

function buildCurrentStage(record: AnalyticsAcrRecord): AnalyticsRecord["currentStage"] {
  switch (record.workflowState) {
    case AcrWorkflowState.DRAFT:
      return "draft";
    case AcrWorkflowState.PENDING_REPORTING:
      return "reporting";
    case AcrWorkflowState.PENDING_COUNTERSIGNING:
      return "countersigning";
    case AcrWorkflowState.SUBMITTED_TO_SECRET_BRANCH:
      return "secret-branch";
    case AcrWorkflowState.RETURNED:
      return "returned";
    case AcrWorkflowState.ARCHIVED:
    default:
      return "archived";
  }
}

function buildCurrentStatusLabel(record: AnalyticsAcrRecord, summary: AnalyticsSummary) {
  if (summary.isOverdue) {
    return "Overdue";
  }

  return summary.status;
}

function calculateStageDurations(record: AnalyticsAcrRecord) {
  const reportingStartsAt = record.createdAt;
  const reportingEndedAt = record.timeline.find((entry) => {
    const action = normalizeAction(entry.action);
    return action.includes("forward to countersigning") || action.includes("forwarded to countersigning") || action.includes("submit to secret branch") || action.includes("submitted to secret branch") || action.includes("return");
  })?.createdAt ?? null;

  const countersigningStartedAt = record.timeline.find((entry) => {
    const action = normalizeAction(entry.action);
    return action.includes("forward to countersigning") || action.includes("forwarded to countersigning");
  })?.createdAt ?? null;
  const countersigningEndedAt = countersigningStartedAt
    ? record.timeline.find((entry) => {
        if (entry.createdAt <= countersigningStartedAt) {
          return false;
        }

        const action = normalizeAction(entry.action);
        return action.includes("submit to secret branch") || action.includes("submitted to secret branch") || action.includes("return");
      })?.createdAt ?? record.archivedAt ?? null
    : null;

  const secretBranchStartedAt = record.timeline.find((entry) => isSecretBranchAction(entry.action))?.createdAt ?? null;
  const secretBranchEndedAt = secretBranchStartedAt ? record.archivedAt ?? record.completedDate ?? null : null;

  return {
    reporting: reportingEndedAt ? diffInDays(reportingStartsAt, reportingEndedAt) : null,
    countersigning: countersigningStartedAt && countersigningEndedAt ? diffInDays(countersigningStartedAt, countersigningEndedAt) : null,
    secretBranch: secretBranchStartedAt && secretBranchEndedAt ? diffInDays(secretBranchStartedAt, secretBranchEndedAt) : null,
  };
}

function compareSummaryPriority(left: AnalyticsRecord, right: AnalyticsRecord) {
  const severity = (record: AnalyticsRecord) => {
    if (record.summary.isOverdue) return 5;
    if (record.summary.status === "Returned") return 4;
    if (record.summary.isPriority) return 3;
    if (record.raw.workflowState === AcrWorkflowState.SUBMITTED_TO_SECRET_BRANCH) return 2;
    if (record.raw.workflowState === AcrWorkflowState.ARCHIVED) return 1;
    return 0;
  };

  const severityDiff = severity(right) - severity(left);
  if (severityDiff !== 0) {
    return severityDiff;
  }

  const leftDue = left.raw.dueDate.getTime();
  const rightDue = right.raw.dueDate.getTime();
  if (leftDue !== rightDue) {
    return leftDue - rightDue;
  }

  return left.summary.employee.name.localeCompare(right.summary.employee.name);
}

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workflowService: WorkflowService,
  ) {}

  async leadership(userId: string, activeRole: UserRole) {
    const user = await loadScopedUser(this.prisma, userId, activeRole);
    if (!canViewAnalytics(user)) {
      throw new ForbiddenException("The current role cannot access leadership analytics.");
    }

    const wings = await this.prisma.wing.findMany({
      include: {
        employees: true,
        offices: true,
      },
      orderBy: { name: "asc" },
    });
    const acrs = await this.prisma.acrRecord.findMany({
      include: {
        employee: {
          select: {
            wingId: true,
            zoneId: true,
            officeId: true,
            reportingOfficerId: true,
            countersigningOfficerId: true,
            userId: true,
            id: true,
          },
        },
      },
    });

    const visibleAcrs = acrs.filter((acr) => canAccessAcr(user, acr));
    const visibleWingIds = new Set(
      wings
        .filter((wing) => {
          if (FULL_ANALYTICS_ROLES.includes(user.activeRole)) {
            return true;
          }

          if (user.activeRole === UserRole.WING_OVERSIGHT) {
            return wing.id === (user.activeAssignment?.wingId ?? user.wingId);
          }

          if (user.activeRole === UserRole.ZONAL_OVERSIGHT) {
            const zoneId = user.activeAssignment?.zoneId ?? user.zoneId;
            return wing.offices.some((office) => office.zoneId === zoneId);
          }

          return false;
        })
        .map((wing) => wing.id),
    );

    return {
      wingWiseTrends: wings
        .filter((wing) => visibleWingIds.has(wing.id))
        .map((wing) => ({
          name: wing.name,
          employees: wing.employees.length,
          offices: wing.offices.length,
          acrCount: visibleAcrs.filter((acr) => acr.employee.wingId === wing.id).length,
        }))
        .filter((entry) => entry.employees > 0 || entry.offices > 0 || entry.acrCount > 0),
      backlogDistribution: wings
        .filter((wing) => visibleWingIds.has(wing.id))
        .map((wing) => ({
          name: wing.name,
          pending: visibleAcrs.filter((acr) => acr.employee.wingId === wing.id && acr.workflowState !== AcrWorkflowState.ARCHIVED).length,
        }))
        .filter((entry) => entry.pending > 0 || visibleWingIds.size === 1),
    };
  }

  async dashboard(userId: string, activeRole: UserRole, query: DashboardAnalyticsQueryDto) {
    const user = await loadScopedUser(this.prisma, userId, activeRole);
    if (!canViewAnalytics(user)) {
      throw new ForbiddenException("The current role cannot access dashboard analytics.");
    }

    const mode: "executive" | "secret-branch" = activeRole === UserRole.SECRET_BRANCH ? "secret-branch" : "executive";
    const accessibleRecords = await this.loadScopedRecords(user, mode);
    const filterOptions = this.buildFilterOptions(accessibleRecords);
    const filteredRecords = this.applyFilters(accessibleRecords, mode, query.datePreset ?? "180d", query);

    return mode === "secret-branch"
      ? this.buildSecretBranchAnalytics(filteredRecords, accessibleRecords, filterOptions, query)
      : this.buildExecutiveAnalytics(filteredRecords, accessibleRecords, filterOptions, query);
  }

  private async loadScopedRecords(user: ScopedUser, mode: "executive" | "secret-branch") {
    const acrs = await this.prisma.acrRecord.findMany({
      where: this.buildScopedWhere(user, mode),
      include: ANALYTICS_ACR_INCLUDE,
      orderBy: [{ archivedAt: "desc" }, { createdAt: "desc" }],
    });

    return acrs
      .filter((record) => canAccessAcr(user, record))
      .map((record) => {
        const summary = mapAcr(record, this.workflowService);
        const returnEvents = record.timeline.filter((entry) => isReturnedAction(entry.action));
        const secretEvent = record.timeline.find((entry) => isSecretBranchAction(entry.action)) ?? null;
        const secretSource = secretEvent
          ? normalizeAction(secretEvent.actorRole).includes("counter")
            ? "countersigning"
            : normalizeAction(secretEvent.actorRole).includes("reporting")
              ? "reporting"
              : record.workflowState === AcrWorkflowState.SUBMITTED_TO_SECRET_BRANCH
                ? "legacy"
                : record.templateVersion.requiresCountersigning
                  ? "countersigning"
                  : "reporting"
          : record.workflowState === AcrWorkflowState.SUBMITTED_TO_SECRET_BRANCH
            ? "legacy"
            : record.templateVersion.requiresCountersigning
              ? "countersigning"
              : "reporting";
        const completionDate = record.archivedAt ?? record.completedDate ?? null;

        return {
          raw: record,
          summary,
          completionDate,
          activityDate: mode === "secret-branch"
            ? completionDate ?? secretEvent?.createdAt ?? record.createdAt
            : record.createdAt,
          currentStage: buildCurrentStage(record),
          currentStatusLabel: buildCurrentStatusLabel(record, summary),
          returnCount: returnEvents.length,
          hadReturnBeforeArchive: Boolean(returnEvents.length && completionDate),
          secretSource,
          secretEntryDate: secretEvent?.createdAt ?? null,
          downloadCount: record.auditLogs.length,
        } satisfies AnalyticsRecord;
      });
  }

  private buildScopedWhere(user: ScopedUser, mode: "executive" | "secret-branch"): Prisma.AcrRecordWhereInput {
    const and: Prisma.AcrRecordWhereInput[] = [];
    const employeeWhere: Prisma.EmployeeWhereInput = {};

    if (!FULL_ANALYTICS_ROLES.includes(user.activeRole) && user.activeRole === UserRole.WING_OVERSIGHT) {
      employeeWhere.wingId = user.activeAssignment?.wingId ?? user.wingId ?? undefined;
    }

    if (!FULL_ANALYTICS_ROLES.includes(user.activeRole) && user.activeRole === UserRole.ZONAL_OVERSIGHT) {
      employeeWhere.zoneId = user.activeAssignment?.zoneId ?? user.zoneId ?? undefined;
    }

    if (Object.keys(employeeWhere).length > 0) {
      and.push({
        employee: {
          is: employeeWhere,
        },
      });
    }

    if (mode === "secret-branch") {
      and.push({
        workflowState: {
          in: [AcrWorkflowState.ARCHIVED, AcrWorkflowState.SUBMITTED_TO_SECRET_BRANCH],
        },
      });
    }

    return and.length ? { AND: and } : {};
  }

  private applyFilters(records: AnalyticsRecord[], mode: "executive" | "secret-branch", preset: DashboardDatePreset, query: DashboardAnalyticsQueryDto) {
    const window = buildWindow(mode, preset, records);

    return records.filter((record) => {
      if (query.wingId && record.raw.employee.wingId !== query.wingId) {
        return false;
      }

      if (query.zoneId && record.raw.employee.zoneId !== query.zoneId) {
        return false;
      }

      if (query.officeId && record.raw.employee.officeId !== query.officeId) {
        return false;
      }

      if (query.templateFamily && record.raw.templateVersion.family !== query.templateFamily) {
        return false;
      }

      if (!inWindow(record.activityDate, window)) {
        return false;
      }

      if (query.status && record.currentStatusLabel !== query.status) {
        return false;
      }

      return true;
    });
  }

  private buildFilterOptions(records: AnalyticsRecord[]) {
    const wings = new Map<string, { id: string; label: string }>();
    const zones = new Map<string, { id: string; label: string; wingId: string }>();
    const offices = new Map<string, { id: string; label: string; wingId: string; zoneId: string }>();
    const statuses = new Map<string, { value: string; label: string }>();
    const templateFamilies = new Map<TemplateFamilyCode, { value: TemplateFamilyCode; label: string }>();

    for (const record of records) {
      wings.set(record.raw.employee.wingId, {
        id: record.raw.employee.wingId,
        label: record.raw.employee.wing.name,
      });
      zones.set(record.raw.employee.zoneId, {
        id: record.raw.employee.zoneId,
        label: record.raw.employee.zone.name,
        wingId: record.raw.employee.wingId,
      });
      offices.set(record.raw.employee.officeId, {
        id: record.raw.employee.officeId,
        label: record.raw.employee.office.name,
        wingId: record.raw.employee.wingId,
        zoneId: record.raw.employee.zoneId,
      });
      statuses.set(record.currentStatusLabel, {
        value: record.currentStatusLabel,
        label: record.currentStatusLabel,
      });
      templateFamilies.set(record.raw.templateVersion.family, {
        value: record.raw.templateVersion.family,
        label: templateFamilyLabel(record.raw.templateVersion.family),
      });
    }

    return {
      datePresets: [
        { value: "30d", label: "30 days" },
        { value: "90d", label: "90 days" },
        { value: "180d", label: "180 days" },
        { value: "365d", label: "365 days" },
        { value: "fy", label: "Current FY" },
        { value: "all", label: "All data" },
      ],
      wings: Array.from(wings.values()).sort((left, right) => left.label.localeCompare(right.label)),
      zones: Array.from(zones.values()).sort((left, right) => left.label.localeCompare(right.label)),
      offices: Array.from(offices.values()).sort((left, right) => left.label.localeCompare(right.label)),
      statuses: Array.from(statuses.values()).sort((left, right) => left.label.localeCompare(right.label)),
      templateFamilies: Array.from(templateFamilies.values()).sort((left, right) => left.label.localeCompare(right.label)),
    };
  }

  private buildExecutiveAnalytics(
    records: AnalyticsRecord[],
    allAccessibleRecords: AnalyticsRecord[],
    filterOptions: ReturnType<AnalyticsService["buildFilterOptions"]>,
    query: DashboardAnalyticsQueryDto,
  ) {
    const window = buildWindow("executive", query.datePreset ?? "180d", allAccessibleRecords);
    const previousWindow = this.buildPreviousWindow(window);
    const previousRecords = allAccessibleRecords.filter((record) => inWindow(record.raw.createdAt, previousWindow));

    const completedRecords = records.filter((record) => isClosedStage(record));
    const pendingRecords = records.filter((record) => isPendingStage(record));
    const returnedRecords = records.filter((record) => record.currentStage === "returned");
    const overdueRecords = records.filter((record) => isOverdueStage(record));
    const priorityRecords = records.filter((record) => record.summary.isPriority);

    const kpis = [
      {
        key: "total",
        label: "Total ACRs",
        value: records.length,
        helper: window.label,
        tone: "navy",
      },
      {
        key: "completed",
        label: "Completed / Archived",
        value: completedRecords.length,
        helper: `${toPercentage(completedRecords.length, records.length)}% completion rate`,
        tone: "green",
      },
      {
        key: "pending",
        label: "Pending",
        value: pendingRecords.length,
        helper: "Open workflow records",
        tone: "cyan",
      },
      {
        key: "overdue",
        label: "Overdue",
        value: overdueRecords.length,
        helper: "Need leadership attention",
        tone: "red",
      },
      {
        key: "returned",
        label: "Returned",
        value: returnedRecords.length,
        helper: "Correction workload",
        tone: "amber",
      },
      {
        key: "priority",
        label: "Priority",
        value: priorityRecords.length,
        helper: "Flagged for escalation",
        tone: "amber",
      },
      {
        key: "turnaround",
        label: "Avg completion time",
        value: `${average(completedRecords.map((record) => record.completionDate ? diffInDays(record.raw.createdAt, record.completionDate) : 0)) || 0}d`,
        helper: "Created to archive",
        tone: "slate",
      },
      {
        key: "completionRate",
        label: "Completion rate",
        value: `${toPercentage(completedRecords.length, records.length)}%`,
        helper: `${completedRecords.length} of ${records.length} records`,
        tone: "green",
      },
    ];

    const buckets = createBuckets(window);
    const workloadTrend = this.createTrendPoints(buckets, (points) => {
      for (const record of records) {
        this.incrementPoint(points, record.raw.createdAt, window.interval, "initiated");
        if (isPendingStage(record)) {
          this.incrementPoint(points, record.raw.createdAt, window.interval, "pending");
        }
        if (record.completionDate) {
          this.incrementPoint(points, record.completionDate, window.interval, "completed");
          if (record.raw.archivedAt) {
            this.incrementPoint(points, record.raw.archivedAt, window.interval, "archived");
          }
        }
        if (record.summary.isOverdue) {
          this.incrementPoint(points, record.raw.dueDate, window.interval, "overdue");
        }
      }

      let runningArchived = 0;
      for (const point of points) {
        runningArchived += point.archived;
        point.cumulativeArchived = runningArchived;
      }
    });

    const wingPerformance = this.buildPerformanceEntries(
      records,
      (record) => ({
        id: record.raw.employee.wingId,
        label: record.raw.employee.wing.name,
      }),
    );
    const zonePerformance = this.buildPerformanceEntries(
      records,
      (record) => ({
        id: record.raw.employee.zoneId,
        label: record.raw.employee.zone.name,
      }),
    );
    const officeBacklog = this.buildPerformanceEntries(
      records,
      (record) => ({
        id: record.raw.employee.officeId,
        label: record.raw.employee.office.name,
      }),
    )
      .sort((left, right) => {
        const backlogDiff = (right.pending + right.overdue + right.returned) - (left.pending + left.overdue + left.returned);
        if (backlogDiff !== 0) {
          return backlogDiff;
        }
        return right.avgTurnaroundDays - left.avgTurnaroundDays;
      })
      .slice(0, 6);

    const stageDurations = records.map((record) => calculateStageDurations(record.raw));
    const turnaroundByStage = [
      {
        key: "reporting",
        label: "Reporting stage",
        avgDays: average(stageDurations.map((entry) => entry.reporting).filter((value): value is number => value !== null)),
      },
      {
        key: "countersigning",
        label: "Countersigning stage",
        avgDays: average(stageDurations.map((entry) => entry.countersigning).filter((value): value is number => value !== null)),
      },
      {
        key: "secret-branch",
        label: "Secret Branch stage",
        avgDays: average(stageDurations.map((entry) => entry.secretBranch).filter((value): value is number => value !== null)),
      },
    ];

    const statusDistribution = this.sortedDistribution([
      { key: "draft", label: "Draft", value: records.filter((record) => record.currentStage === "draft").length },
      { key: "reporting", label: "Pending reporting", value: records.filter((record) => record.currentStage === "reporting").length },
      { key: "countersigning", label: "Pending countersigning", value: records.filter((record) => record.currentStage === "countersigning").length },
      { key: "returned", label: "Returned", value: returnedRecords.length },
      { key: "overdue", label: "Overdue", value: overdueRecords.length },
      { key: "archived", label: "Archived", value: completedRecords.length },
    ]);

    const templateDistribution = this.sortedDistribution(
      Array.from(new Set(records.map((record) => record.raw.templateVersion.family))).map((family) => ({
        key: family,
        label: templateFamilyLabel(family),
        value: records.filter((record) => record.raw.templateVersion.family === family).length,
        filterValue: family,
      })),
    );

    const returnRateByWing = wingPerformance
      .map((entry) => ({
        ...entry,
        rate: entry.total ? Math.round((entry.returned / entry.total) * 100) : 0,
      }))
      .sort((left, right) => right.rate - left.rate || right.returned - left.returned)
      .slice(0, 6);

    const heatmapColumns = [
      { key: "draft", label: "Draft" },
      { key: "reporting", label: "Reporting" },
      { key: "countersigning", label: "Countersigning" },
      { key: "secret-branch", label: "Secret Branch" },
      { key: "returned", label: "Returned" },
      { key: "archived", label: "Archived" },
    ];
    const heatmapRows = Array.from(
      records.reduce((map, record) => {
        const row = map.get(record.raw.employee.wingId) ?? {
          id: record.raw.employee.wingId,
          label: record.raw.employee.wing.name,
          values: {
            draft: 0,
            reporting: 0,
            countersigning: 0,
            "secret-branch": 0,
            returned: 0,
            archived: 0,
          },
          completionRate: 0,
          overdue: 0,
          total: 0,
          completed: 0,
        };

        row.values[record.currentStage] += 1;
        row.total += 1;
        row.completed += isClosedStage(record) ? 1 : 0;
        row.overdue += record.summary.isOverdue ? 1 : 0;
        row.completionRate = toPercentage(row.completed, row.total);
        map.set(record.raw.employee.wingId, row);
        return map;
      }, new Map<string, { id: string; label: string; values: Record<string, number>; completionRate: number; overdue: number; total: number; completed: number }>()),
    )
      .map(([, value]) => value)
      .sort((left, right) => right.overdue - left.overdue || right.completionRate - left.completionRate);

    const focusRecords = [...records]
      .sort(compareSummaryPriority)
      .slice(0, 8)
      .map((record) => record.summary);

    return {
      mode: "executive",
      heading: {
        eyebrow: "Director General overview",
        title: "DG Dashboard",
        description: "National-level execution view across workflow health, completion momentum, backlog concentration, and exception-heavy units.",
      },
      appliedFilters: {
        datePreset: query.datePreset ?? "180d",
        dateLabel: window.label,
        wingId: query.wingId ?? "",
        zoneId: query.zoneId ?? "",
        officeId: query.officeId ?? "",
        status: query.status ?? "",
        templateFamily: query.templateFamily ?? "",
      },
      filterOptions,
      kpis,
      trends: {
        workload: {
          title: "Workload trend",
          subtitle: "Pending, completed, overdue, and initiated records over the selected window.",
          points: workloadTrend,
          series: [
            { key: "pending", label: "Pending", color: "cyan" },
            { key: "completed", label: "Completed", color: "green" },
            { key: "overdue", label: "Overdue", color: "red" },
            { key: "initiated", label: "Initiated", color: "navy" },
          ],
          defaultSeries: ["pending", "completed", "overdue"],
        },
        archive: {
          title: "Archive growth",
          subtitle: "Archive additions and cumulative closure movement across the same period.",
          points: workloadTrend,
          series: [
            { key: "archived", label: "Archived", color: "green" },
            { key: "cumulativeArchived", label: "Cumulative archived", color: "navy" },
          ],
          defaultSeries: ["archived", "cumulativeArchived"],
        },
      },
      performance: {
        wing: wingPerformance,
        zone: zonePerformance,
        offices: officeBacklog,
        turnaroundByStage,
      },
      distributions: {
        status: statusDistribution,
        template: templateDistribution,
        returnRateByWing,
      },
      heatmap: {
        title: "Wing vs workflow stage",
        subtitle: "Matrix view of where work is accumulating across leadership lines.",
        columns: heatmapColumns,
        rows: heatmapRows,
      },
      focus: {
        title: "Executive exception watchlist",
        subtitle: "Highest-severity records after filters, ranked by overdue pressure, return state, and priority.",
        items: focusRecords,
      },
      benchmarks: {
        previousPeriodCompleted: previousRecords.filter((record) => isClosedStage(record)).length,
        previousPeriodOverdue: previousRecords.filter((record) => isOverdueStage(record)).length,
      },
      generatedAt: new Date().toISOString(),
    };
  }

  private buildSecretBranchAnalytics(
    records: AnalyticsRecord[],
    allAccessibleRecords: AnalyticsRecord[],
    filterOptions: ReturnType<AnalyticsService["buildFilterOptions"]>,
    query: DashboardAnalyticsQueryDto,
  ) {
    const window = buildWindow("secret-branch", query.datePreset ?? "180d", allAccessibleRecords);
    const archivedRecords = records.filter((record) => isClosedStage(record));
    const anomalyRecords = records.filter((record) => record.currentStage === "secret-branch");
    const downloadsTotal = records.reduce((sum, record) => sum + record.downloadCount, 0);
    const todayStart = startOfDay(new Date());
    const weekStart = startOfWeek(new Date());
    const monthStart = startOfMonth(new Date());

    const kpis = [
      {
        key: "archived",
        label: "Total archived ACRs",
        value: archivedRecords.length,
        helper: window.label,
        tone: "green",
      },
      {
        key: "today",
        label: "Archived today",
        value: archivedRecords.filter((record) => record.raw.archivedAt && record.raw.archivedAt >= todayStart).length,
        helper: "Daily archive closures",
        tone: "navy",
      },
      {
        key: "week",
        label: "Archived this week",
        value: archivedRecords.filter((record) => record.raw.archivedAt && record.raw.archivedAt >= weekStart).length,
        helper: "Week-to-date archive inflow",
        tone: "cyan",
      },
      {
        key: "month",
        label: "Archived this month",
        value: archivedRecords.filter((record) => record.raw.archivedAt && record.raw.archivedAt >= monthStart).length,
        helper: "Month-to-date archive inflow",
        tone: "cyan",
      },
      {
        key: "anomalies",
        label: "Pending receipt anomalies",
        value: anomalyRecords.length,
        helper: "Final packets still not fully archived",
        tone: anomalyRecords.length > 0 ? "red" : "green",
      },
      {
        key: "downloads",
        label: "Tracked downloads",
        value: downloadsTotal,
        helper: "Archive retrieval activity",
        tone: "amber",
      },
      {
        key: "avgTurnaround",
        label: "Avg archive turnaround",
        value: `${average(archivedRecords.map((record) => record.completionDate ? diffInDays(record.raw.createdAt, record.completionDate) : 0)) || 0}d`,
        helper: "Created to archive",
        tone: "slate",
      },
    ];

    const buckets = createBuckets(window);
    const archiveTrend = this.createTrendPoints(buckets, (points) => {
      for (const record of records) {
        if (record.raw.archivedAt) {
          this.incrementPoint(points, record.raw.archivedAt, window.interval, "archived");
        }

        if (record.secretEntryDate && record.secretSource === "reporting") {
          this.incrementPoint(points, record.secretEntryDate, window.interval, "receivedFromReporting");
        }

        if (record.secretEntryDate && record.secretSource === "countersigning") {
          this.incrementPoint(points, record.secretEntryDate, window.interval, "receivedFromCountersigning");
        }

        if (record.hadReturnBeforeArchive && record.raw.archivedAt) {
          this.incrementPoint(points, record.raw.archivedAt, window.interval, "returnedBeforeArchive");
        }

        if (record.currentStage === "secret-branch") {
          this.incrementPoint(points, record.activityDate, window.interval, "anomalies");
        }

        for (const auditLog of record.raw.auditLogs) {
          this.incrementPoint(points, auditLog.createdAt, window.interval, "downloads");
        }
      }
    });

    const templateDistribution = this.sortedDistribution(
      Array.from(new Set(records.map((record) => record.raw.templateVersion.family))).map((family) => ({
        key: family,
        label: templateFamilyLabel(family),
        value: records.filter((record) => record.raw.templateVersion.family === family).length,
        filterValue: family,
      })),
    );

    const sourceFlow = this.sortedDistribution([
      {
        key: "reporting",
        label: "From reporting",
        value: records.filter((record) => record.secretSource === "reporting").length,
      },
      {
        key: "countersigning",
        label: "From countersigning",
        value: records.filter((record) => record.secretSource === "countersigning").length,
      },
      {
        key: "legacy",
        label: "Legacy / pending receipt",
        value: records.filter((record) => record.secretSource === "legacy").length,
      },
    ]);

    const finalStatus = this.sortedDistribution([
      {
        key: "archived",
        label: "Archived",
        value: archivedRecords.length,
        filterValue: "Archived",
      },
      {
        key: "submitted",
        label: "Pending receipt",
        value: anomalyRecords.length,
        filterValue: "Submitted to Secret Branch",
      },
    ]);

    const byWing = this.buildSecretBranchEntries(
      records,
      (record) => ({
        id: record.raw.employee.wingId,
        label: record.raw.employee.wing.name,
      }),
    );
    const byZone = this.buildSecretBranchEntries(
      records,
      (record) => ({
        id: record.raw.employee.zoneId,
        label: record.raw.employee.zone.name,
      }),
    );
    const topUnits = this.buildSecretBranchEntries(
      records,
      (record) => ({
        id: record.raw.employee.officeId,
        label: record.raw.employee.office.name,
      }),
    )
      .sort((left, right) => right.archived - left.archived || right.avgTurnaroundDays - left.avgTurnaroundDays)
      .slice(0, 6);

    const anomaliesByUnit = this.buildSecretBranchEntries(
      anomalyRecords,
      (record) => ({
        id: record.raw.employee.officeId,
        label: record.raw.employee.office.name,
      }),
    )
      .filter((entry) => entry.anomalies > 0)
      .sort((left, right) => right.anomalies - left.anomalies)
      .slice(0, 6);

    const focusRecords = [...records]
      .sort(compareSummaryPriority)
      .slice(0, 8)
      .map((record) => record.summary);

    return {
      mode: "secret-branch",
      heading: {
        eyebrow: "Secret Branch archive operations",
        title: "Secret Branch Dashboard",
        description: "Archive-focused monitoring across final inflow, pending receipt anomalies, workflow source mix, and retrieval activity.",
      },
      appliedFilters: {
        datePreset: query.datePreset ?? "180d",
        dateLabel: window.label,
        wingId: query.wingId ?? "",
        zoneId: query.zoneId ?? "",
        officeId: query.officeId ?? "",
        status: query.status ?? "",
        templateFamily: query.templateFamily ?? "",
      },
      filterOptions,
      kpis,
      trends: {
        workload: {
          title: "Archive inflow",
          subtitle: "Archived packets and upstream hand-offs reaching Secret Branch over time.",
          points: archiveTrend,
          series: [
            { key: "archived", label: "Archived", color: "green" },
            { key: "receivedFromReporting", label: "From reporting", color: "navy" },
            { key: "receivedFromCountersigning", label: "From countersigning", color: "cyan" },
          ],
          defaultSeries: ["archived", "receivedFromReporting", "receivedFromCountersigning"],
        },
        archive: {
          title: "Archive activity",
          subtitle: "Returns before archival, download traffic, and current receipt anomalies.",
          points: archiveTrend,
          series: [
            { key: "returnedBeforeArchive", label: "Returned before archive", color: "amber" },
            { key: "downloads", label: "Downloads", color: "slate" },
            { key: "anomalies", label: "Pending receipt", color: "red" },
          ],
          defaultSeries: ["returnedBeforeArchive", "downloads", "anomalies"],
        },
      },
      performance: {
        wing: byWing,
        zone: byZone,
        offices: topUnits,
        turnaroundByStage: [],
      },
      distributions: {
        status: finalStatus,
        template: templateDistribution,
        returnRateByWing: anomaliesByUnit,
        sourceFlow,
      },
      heatmap: null,
      focus: {
        title: "Archive register spotlight",
        subtitle: "Pending receipt anomalies are ranked ahead of the most recent archived packets.",
        items: focusRecords,
      },
      generatedAt: new Date().toISOString(),
    };
  }

  private buildPerformanceEntries(
    records: AnalyticsRecord[],
    selector: (record: AnalyticsRecord) => { id: string; label: string },
  ) {
    return Array.from(
      records.reduce((map, record) => {
        const key = selector(record);
        const current = map.get(key.id) ?? {
          id: key.id,
          label: key.label,
          total: 0,
          pending: 0,
          completed: 0,
          overdue: 0,
          returned: 0,
          completionRate: 0,
          avgTurnaroundDays: 0,
          turnaroundValues: [] as number[],
        };

        current.total += 1;
        current.pending += isPendingStage(record) ? 1 : 0;
        current.completed += isClosedStage(record) ? 1 : 0;
        current.overdue += record.summary.isOverdue ? 1 : 0;
        current.returned += record.currentStage === "returned" ? 1 : 0;
        if (record.completionDate) {
          current.turnaroundValues.push(diffInDays(record.raw.createdAt, record.completionDate));
        }
        current.completionRate = toPercentage(current.completed, current.total);
        current.avgTurnaroundDays = average(current.turnaroundValues);
        map.set(key.id, current);
        return map;
      }, new Map<string, { id: string; label: string; total: number; pending: number; completed: number; overdue: number; returned: number; completionRate: number; avgTurnaroundDays: number; turnaroundValues: number[] }>()),
    )
      .map(([, value]) => ({
        id: value.id,
        label: value.label,
        total: value.total,
        pending: value.pending,
        completed: value.completed,
        overdue: value.overdue,
        returned: value.returned,
        completionRate: value.completionRate,
        avgTurnaroundDays: value.avgTurnaroundDays,
      }))
      .sort((left, right) => right.total - left.total || right.overdue - left.overdue);
  }

  private buildSecretBranchEntries(
    records: AnalyticsRecord[],
    selector: (record: AnalyticsRecord) => { id: string; label: string },
  ) {
    return Array.from(
      records.reduce((map, record) => {
        const key = selector(record);
        const current = map.get(key.id) ?? {
          id: key.id,
          label: key.label,
          total: 0,
          archived: 0,
          anomalies: 0,
          downloads: 0,
          turnaroundValues: [] as number[],
          avgTurnaroundDays: 0,
        };

        current.total += 1;
        current.archived += isClosedStage(record) ? 1 : 0;
        current.anomalies += record.currentStage === "secret-branch" ? 1 : 0;
        current.downloads += record.downloadCount;
        if (record.completionDate) {
          current.turnaroundValues.push(diffInDays(record.raw.createdAt, record.completionDate));
        }
        current.avgTurnaroundDays = average(current.turnaroundValues);
        map.set(key.id, current);
        return map;
      }, new Map<string, { id: string; label: string; total: number; archived: number; anomalies: number; downloads: number; turnaroundValues: number[]; avgTurnaroundDays: number }>()),
    )
      .map(([, value]) => ({
        id: value.id,
        label: value.label,
        total: value.total,
        archived: value.archived,
        anomalies: value.anomalies,
        downloads: value.downloads,
        avgTurnaroundDays: value.avgTurnaroundDays,
      }))
      .sort((left, right) => right.total - left.total || right.archived - left.archived);
  }

  private sortedDistribution<T extends { value: number }>(items: T[]) {
    return items.filter((item) => item.value > 0).sort((left, right) => right.value - left.value);
  }

  private createTrendPoints(buckets: Bucket[], fill: (points: TrendPoint[]) => void) {
    const points = buckets.map((bucket) => ({
      key: bucket.key,
      label: bucket.label,
      initiated: 0,
      pending: 0,
      completed: 0,
      overdue: 0,
      archived: 0,
      cumulativeArchived: 0,
      receivedFromReporting: 0,
      receivedFromCountersigning: 0,
      returnedBeforeArchive: 0,
      downloads: 0,
      anomalies: 0,
    }));

    fill(points);
    return points;
  }

  private incrementPoint(points: TrendPoint[], date: Date | null | undefined, interval: DateWindow["interval"], key: SeriesKey) {
    if (!date) {
      return;
    }

    const targetKey = bucketKey(date, interval);
    const point = points.find((entry) => entry.key === targetKey);
    if (!point) {
      return;
    }

    point[key] += 1;
  }

  private buildPreviousWindow(window: DateWindow): DateWindow {
    if (!window.from) {
      return window;
    }

    const durationMs = window.to.getTime() - window.from.getTime();
    const previousTo = new Date(window.from.getTime() - 1);
    const previousFrom = new Date(previousTo.getTime() - durationMs);

    return {
      ...window,
      from: previousFrom,
      to: previousTo,
    };
  }
}
