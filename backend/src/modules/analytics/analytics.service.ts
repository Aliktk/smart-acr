import { ForbiddenException, Injectable } from "@nestjs/common";
import { AcrWorkflowState, Prisma, TemplateFamilyCode, UserRole } from "@prisma/client";
import { templateFamilyLabel } from "../../common/template-catalog";
import { PrismaService } from "../../common/prisma.service";
import { buildScopedOrgWhere, canAccessAcr, canViewAnalytics, loadScopedUser, type ScopedUser } from "../../helpers/security.utils";
import { mapAcr } from "../../helpers/view-mappers";
import { WorkflowService } from "../workflow/workflow.service";
import {
  DASHBOARD_DATE_PRESETS,
  type DashboardAnalyticsQueryDto,
  type DashboardDatePreset,
} from "./dto/dashboard-analytics-query.dto";

export interface HeatmapPoint {
  city: string;
  lat: number;
  lng: number;
  intensity: number;
  overdue: number;
  total: number;
}

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
      directorate: true,
      region: true,
      zone: true,
      circle: true,
      station: true,
      branch: true,
      cell: true,
      office: true,
      department: true,
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

type PerformanceSelector = {
  id: string | null | undefined;
  label: string | null | undefined;
};

type ResolvedPerformanceSelector = {
  id: string;
  label: string;
};

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

function isReturnedWorkflowState(state: AcrWorkflowState) {
  return state === AcrWorkflowState.RETURNED_TO_CLERK
    || state === AcrWorkflowState.RETURNED_TO_REPORTING
    || state === AcrWorkflowState.RETURNED_TO_COUNTERSIGNING;
}

function isSecretBranchWorkflowState(state: AcrWorkflowState) {
  return state === AcrWorkflowState.PENDING_SECRET_BRANCH_REVIEW
    || state === AcrWorkflowState.PENDING_SECRET_BRANCH_VERIFICATION
    || state === AcrWorkflowState.ARCHIVED;
}

function isPendingStage(record: AnalyticsRecord) {
  return record.raw.workflowState !== AcrWorkflowState.ARCHIVED && !isReturnedWorkflowState(record.raw.workflowState);
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
    case AcrWorkflowState.PENDING_SECRET_BRANCH_REVIEW:
    case AcrWorkflowState.PENDING_SECRET_BRANCH_VERIFICATION:
      return "secret-branch";
    case AcrWorkflowState.RETURNED_TO_CLERK:
    case AcrWorkflowState.RETURNED_TO_REPORTING:
    case AcrWorkflowState.RETURNED_TO_COUNTERSIGNING:
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
    if (record.summary.status.startsWith("Returned")) return 4;
    if (record.summary.isPriority) return 3;
    if (record.raw.workflowState === AcrWorkflowState.PENDING_SECRET_BRANCH_REVIEW || record.raw.workflowState === AcrWorkflowState.PENDING_SECRET_BRANCH_VERIFICATION) return 2;
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

function validSelector(
  selector: PerformanceSelector,
): selector is ResolvedPerformanceSelector {
  return Boolean(selector.id && selector.label);
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
      take: 5000,
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

  async heatmap(userId: string, activeRole: UserRole): Promise<HeatmapPoint[]> {
    const scopedUser = await loadScopedUser(this.prisma, userId, activeRole);
    if (!canViewAnalytics(scopedUser)) {
      throw new ForbiddenException("Insufficient permissions for heatmap data");
    }

    const employeeWhere = FULL_ANALYTICS_ROLES.includes(scopedUser.activeRole)
      ? undefined
      : buildScopedOrgWhere(scopedUser) ?? undefined;

    const where: Prisma.AcrRecordWhereInput = employeeWhere
      ? { employee: { is: employeeWhere } }
      : {};

    const acrs = await this.prisma.acrRecord.findMany({
      where,
      select: {
        workflowState: true,
        dueDate: true,
        employee: {
          select: {
            station: { select: { name: true, id: true } },
          },
        },
      },
    });

    const FIA_CITY_COORDS: Record<string, { lat: number; lng: number }> = {
      "Karachi":     { lat: 24.8607, lng: 67.0011 },
      "Lahore":      { lat: 31.5204, lng: 74.3587 },
      "Islamabad":   { lat: 33.6844, lng: 73.0479 },
      "Peshawar":    { lat: 34.0151, lng: 71.5249 },
      "Quetta":      { lat: 30.1798, lng: 66.9750 },
      "Multan":      { lat: 30.1575, lng: 71.5249 },
      "Faisalabad":  { lat: 31.4504, lng: 73.1350 },
      "Hyderabad":   { lat: 25.3960, lng: 68.3578 },
      "Rawalpindi":  { lat: 33.5651, lng: 73.0169 },
      "Gujranwala":  { lat: 32.1877, lng: 74.1945 },
      "Sialkot":     { lat: 32.4945, lng: 74.5229 },
      "Abbottabad":  { lat: 34.1463, lng: 73.2117 },
      "Sukkur":      { lat: 27.7052, lng: 68.8574 },
      "Larkana":     { lat: 27.5570, lng: 68.2140 },
    };

    const cityMap = new Map<string, { total: number; overdue: number; lat: number; lng: number }>();
    const now = new Date();

    for (const acr of acrs) {
      const stationName = acr.employee?.station?.name ?? null;
      if (!stationName) continue;

      const normalizedCity = Object.keys(FIA_CITY_COORDS).find(
        (k) =>
          k.toLowerCase() === stationName.toLowerCase() ||
          stationName.toLowerCase().startsWith(k.toLowerCase().substring(0, 4)),
      );
      if (!normalizedCity) continue;

      const coords = FIA_CITY_COORDS[normalizedCity];
      const existing = cityMap.get(normalizedCity) ?? {
        total: 0,
        overdue: 0,
        lat: coords.lat,
        lng: coords.lng,
      };
      existing.total += 1;

      const isOverdue =
        acr.dueDate &&
        acr.dueDate < now &&
        acr.workflowState !== AcrWorkflowState.ARCHIVED &&
        acr.workflowState !== AcrWorkflowState.DRAFT;
      if (isOverdue) existing.overdue += 1;

      cityMap.set(normalizedCity, existing);
    }

    const result: HeatmapPoint[] = [];

    for (const [city, coords] of Object.entries(FIA_CITY_COORDS)) {
      const data = cityMap.get(city);
      if (data && data.total > 0) {
        const intensity = Math.min(1, data.overdue / Math.max(1, data.total));
        result.push({
          city,
          lat: coords.lat,
          lng: coords.lng,
          intensity,
          overdue: data.overdue,
          total: data.total,
        });
      } else {
        result.push({ city, lat: coords.lat, lng: coords.lng, intensity: 0, overdue: 0, total: 0 });
      }
    }

    return result;
  }

  private async loadScopedRecords(user: ScopedUser, mode: "executive" | "secret-branch") {
    const acrs = await this.prisma.acrRecord.findMany({
      where: this.buildScopedWhere(user, mode),
      include: ANALYTICS_ACR_INCLUDE,
      orderBy: [{ archivedAt: "desc" }, { createdAt: "desc" }],
      take: 2000,
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
              : isSecretBranchWorkflowState(record.workflowState)
                ? "legacy"
                : record.templateVersion.requiresCountersigning
                  ? "countersigning"
                  : "reporting"
          : isSecretBranchWorkflowState(record.workflowState)
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
    const employeeWhere = FULL_ANALYTICS_ROLES.includes(user.activeRole)
      ? null
      : user.activeRole === UserRole.WING_OVERSIGHT || user.activeRole === UserRole.ZONAL_OVERSIGHT
        ? buildScopedOrgWhere(user)
        : null;

    if (employeeWhere) {
      and.push({
        employee: {
          is: employeeWhere,
        },
      });
    }

    if (mode === "secret-branch") {
      and.push({
        workflowState: {
          in: [
            AcrWorkflowState.ARCHIVED,
            AcrWorkflowState.PENDING_SECRET_BRANCH_REVIEW,
            AcrWorkflowState.PENDING_SECRET_BRANCH_VERIFICATION,
          ],
        },
      });
    }

    return and.length ? { AND: and } : {};
  }

  private applyFilters(records: AnalyticsRecord[], mode: "executive" | "secret-branch", preset: DashboardDatePreset, query: DashboardAnalyticsQueryDto) {
    const window = buildWindow(mode, preset, records);

    return records.filter((record) => {
      if (query.scopeTrack && record.raw.employee.scopeTrack !== query.scopeTrack) {
        return false;
      }

      if (query.wingId && record.raw.employee.wingId !== query.wingId) {
        return false;
      }

      if (query.directorateId && record.raw.employee.directorateId !== query.directorateId) {
        return false;
      }

      if (query.regionId && record.raw.employee.regionId !== query.regionId) {
        return false;
      }

      if (query.zoneId && record.raw.employee.zoneId !== query.zoneId) {
        return false;
      }

      if (query.circleId && record.raw.employee.circleId !== query.circleId) {
        return false;
      }

      if (query.stationId && record.raw.employee.stationId !== query.stationId) {
        return false;
      }

      if (query.branchId && record.raw.employee.branchId !== query.branchId) {
        return false;
      }

      if (query.cellId && record.raw.employee.cellId !== query.cellId) {
        return false;
      }

      if (query.officeId && record.raw.employee.officeId !== query.officeId) {
        return false;
      }

      if (query.departmentId && record.raw.employee.departmentId !== query.departmentId) {
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
    const scopeTracks = new Map<string, { value: string; label: string }>();
    const wings = new Map<string, { id: string; label: string }>();
    const directorates = new Map<string, { id: string; label: string; wingId: string | null }>();
    const regions = new Map<string, { id: string; label: string; wingId: string | null; directorateId: string | null }>();
    const zones = new Map<string, { id: string; label: string; wingId: string | null; regionId: string | null }>();
    const circles = new Map<string, { id: string; label: string; regionId: string | null; zoneId: string }>();
    const stations = new Map<string, { id: string; label: string; zoneId: string; circleId: string | null }>();
    const branches = new Map<string, { id: string; label: string; zoneId: string; stationId: string | null; circleId: string | null }>();
    const cells = new Map<string, { id: string; label: string; zoneId: string; branchId: string | null; stationId: string | null }>();
    const offices = new Map<string, { id: string; label: string; scopeTrack: string; wingId: string | null; directorateId: string | null; regionId: string | null; zoneId: string | null }>();
    const departments = new Map<string, { id: string; label: string; officeId: string }>();
    const statuses = new Map<string, { value: string; label: string }>();
    const templateFamilies = new Map<TemplateFamilyCode, { value: TemplateFamilyCode; label: string }>();

    for (const record of records) {
      scopeTracks.set(record.raw.employee.scopeTrack, {
        value: record.raw.employee.scopeTrack,
        label: record.raw.employee.scopeTrack === "REGIONAL" ? "Regional" : "Wing",
      });
      if (record.raw.employee.wingId && record.raw.employee.wing?.name) {
        wings.set(record.raw.employee.wingId, {
          id: record.raw.employee.wingId,
          label: record.raw.employee.wing.name,
        });
      }
      if (record.raw.employee.directorateId && record.raw.employee.directorate?.name) {
        directorates.set(record.raw.employee.directorateId, {
          id: record.raw.employee.directorateId,
          label: record.raw.employee.directorate.name,
          wingId: record.raw.employee.wingId ?? null,
        });
      }
      if (record.raw.employee.regionId && record.raw.employee.region?.name) {
        regions.set(record.raw.employee.regionId, {
          id: record.raw.employee.regionId,
          label: record.raw.employee.region.name,
          wingId: record.raw.employee.wingId ?? null,
          directorateId: record.raw.employee.directorateId ?? null,
        });
      }
      if (record.raw.employee.zoneId && record.raw.employee.zone?.name) {
        zones.set(record.raw.employee.zoneId, {
          id: record.raw.employee.zoneId,
          label: record.raw.employee.zone.name,
          wingId: record.raw.employee.wingId ?? null,
          regionId: record.raw.employee.regionId ?? null,
        });
      }
      if (record.raw.employee.circleId && record.raw.employee.circle?.name && record.raw.employee.zoneId) {
        circles.set(record.raw.employee.circleId, {
          id: record.raw.employee.circleId,
          label: record.raw.employee.circle.name,
          regionId: record.raw.employee.regionId ?? null,
          zoneId: record.raw.employee.zoneId,
        });
      }
      if (record.raw.employee.stationId && record.raw.employee.station?.name && record.raw.employee.zoneId) {
        stations.set(record.raw.employee.stationId, {
          id: record.raw.employee.stationId,
          label: record.raw.employee.station.name,
          zoneId: record.raw.employee.zoneId,
          circleId: record.raw.employee.circleId ?? null,
        });
      }
      if (record.raw.employee.branchId && record.raw.employee.branch?.name && record.raw.employee.zoneId) {
        branches.set(record.raw.employee.branchId, {
          id: record.raw.employee.branchId,
          label: record.raw.employee.branch.name,
          zoneId: record.raw.employee.zoneId,
          stationId: record.raw.employee.stationId ?? null,
          circleId: record.raw.employee.circleId ?? null,
        });
      }
      if (record.raw.employee.cellId && record.raw.employee.cell?.name && record.raw.employee.zoneId) {
        cells.set(record.raw.employee.cellId, {
          id: record.raw.employee.cellId,
          label: record.raw.employee.cell.name,
          zoneId: record.raw.employee.zoneId,
          branchId: record.raw.employee.branchId ?? null,
          stationId: record.raw.employee.stationId ?? null,
        });
      }
      offices.set(record.raw.employee.officeId, {
        id: record.raw.employee.officeId,
        label: record.raw.employee.office.name,
        scopeTrack: record.raw.employee.scopeTrack,
        wingId: record.raw.employee.wingId ?? null,
        directorateId: record.raw.employee.directorateId ?? null,
        regionId: record.raw.employee.regionId ?? null,
        zoneId: record.raw.employee.zoneId ?? null,
      });
      if (record.raw.employee.departmentId && record.raw.employee.department?.name) {
        departments.set(record.raw.employee.departmentId, {
          id: record.raw.employee.departmentId,
          label: record.raw.employee.department.name,
          officeId: record.raw.employee.officeId,
        });
      }
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
      scopeTracks: Array.from(scopeTracks.values()).sort((left, right) => left.label.localeCompare(right.label)),
      wings: Array.from(wings.values()).sort((left, right) => left.label.localeCompare(right.label)),
      directorates: Array.from(directorates.values()).sort((left, right) => left.label.localeCompare(right.label)),
      regions: Array.from(regions.values()).sort((left, right) => left.label.localeCompare(right.label)),
      zones: Array.from(zones.values()).sort((left, right) => left.label.localeCompare(right.label)),
      circles: Array.from(circles.values()).sort((left, right) => left.label.localeCompare(right.label)),
      stations: Array.from(stations.values()).sort((left, right) => left.label.localeCompare(right.label)),
      branches: Array.from(branches.values()).sort((left, right) => left.label.localeCompare(right.label)),
      cells: Array.from(cells.values()).sort((left, right) => left.label.localeCompare(right.label)),
      offices: Array.from(offices.values()).sort((left, right) => left.label.localeCompare(right.label)),
      departments: Array.from(departments.values()).sort((left, right) => left.label.localeCompare(right.label)),
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
        label: record.raw.employee.wing?.name,
      }),
    );
    const regionPerformance = this.buildPerformanceEntries(
      records,
      (record) => ({
        id: record.raw.employee.regionId,
        label: record.raw.employee.region?.name,
      }),
    );
    const zonePerformance = this.buildPerformanceEntries(
      records,
      (record) => ({
        id: record.raw.employee.zoneId,
        label: record.raw.employee.zone?.name,
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
        const groupId = record.raw.employee.wingId ?? record.raw.employee.regionId ?? record.raw.employee.officeId;
        const groupLabel = record.raw.employee.wing?.name ?? record.raw.employee.region?.name ?? record.raw.employee.office.name;
        if (!groupId || !groupLabel) {
          return map;
        }

        const row = map.get(groupId) ?? {
          id: groupId,
          label: groupLabel,
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
        map.set(groupId, row);
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
        description: "",
      },
      appliedFilters: {
        datePreset: query.datePreset ?? "180d",
        dateLabel: window.label,
        scopeTrack: query.scopeTrack ?? "",
        wingId: query.wingId ?? "",
        directorateId: query.directorateId ?? "",
        regionId: query.regionId ?? "",
        zoneId: query.zoneId ?? "",
        circleId: query.circleId ?? "",
        stationId: query.stationId ?? "",
        branchId: query.branchId ?? "",
        cellId: query.cellId ?? "",
        officeId: query.officeId ?? "",
        departmentId: query.departmentId ?? "",
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
        region: regionPerformance,
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

    const pendingDARecords = records.filter(
      (record) => record.raw.workflowState === AcrWorkflowState.PENDING_SECRET_BRANCH_REVIEW,
    );

    const kpis = [
      {
        key: "total",
        label: "Total records in scope",
        value: records.length,
        helper: window.label,
        tone: "navy",
      },
      {
        key: "pendingDA",
        label: "Pending DA assignment",
        value: pendingDARecords.length,
        helper: "Awaiting DA review",
        tone: pendingDARecords.length > 0 ? "amber" : "green",
      },
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
        filterValue: "Pending Secret Branch Review",
      },
    ]);

    const byWing = this.buildSecretBranchEntries(
      records,
      (record) => ({
        id: record.raw.employee.wingId,
        label: record.raw.employee.wing?.name,
      }),
    );
    const byRegion = this.buildSecretBranchEntries(
      records,
      (record) => ({
        id: record.raw.employee.regionId,
        label: record.raw.employee.region?.name,
      }),
    );
    const byZone = this.buildSecretBranchEntries(
      records,
      (record) => ({
        id: record.raw.employee.zoneId,
        label: record.raw.employee.zone?.name,
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
        description: "",
      },
      appliedFilters: {
        datePreset: query.datePreset ?? "180d",
        dateLabel: window.label,
        scopeTrack: query.scopeTrack ?? "",
        wingId: query.wingId ?? "",
        directorateId: query.directorateId ?? "",
        regionId: query.regionId ?? "",
        zoneId: query.zoneId ?? "",
        circleId: query.circleId ?? "",
        stationId: query.stationId ?? "",
        branchId: query.branchId ?? "",
        cellId: query.cellId ?? "",
        officeId: query.officeId ?? "",
        departmentId: query.departmentId ?? "",
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
        region: byRegion,
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
    selector: (record: AnalyticsRecord) => PerformanceSelector,
  ) {
    return Array.from(
      records.reduce((map, record) => {
        const key = selector(record);
        if (!validSelector(key)) {
          return map;
        }
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
    selector: (record: AnalyticsRecord) => PerformanceSelector,
  ) {
    return Array.from(
      records.reduce((map, record) => {
        const key = selector(record);
        if (!validSelector(key)) {
          return map;
        }
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
