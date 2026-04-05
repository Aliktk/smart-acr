import type { AcrStatus, AcrSummary, DashboardDistributionEntry, UserRoleCode } from "@/types/contracts";

export type DashboardMode =
  | "clerk"
  | "reporting"
  | "countersigning"
  | "secret-branch"
  | "executive"
  | "employee";

const closedStatuses = new Set<AcrStatus>(["Archived", "Completed", "Submitted to Secret Branch"]);
const actionableStatuses = new Set<AcrStatus>([
  "Draft",
  "Returned",
  "In Review",
  "Pending Reporting Officer",
  "Pending Countersigning",
  "Overdue",
]);

export function getDashboardMode(roleCode: UserRoleCode): DashboardMode {
  switch (roleCode) {
    case "REPORTING_OFFICER":
      return "reporting";
    case "COUNTERSIGNING_OFFICER":
      return "countersigning";
    case "SECRET_BRANCH":
      return "secret-branch";
    case "DG":
    case "EXECUTIVE_VIEWER":
    case "SUPER_ADMIN":
    case "IT_OPS":
    case "WING_OVERSIGHT":
    case "ZONAL_OVERSIGHT":
      return "executive";
    case "EMPLOYEE":
      return "employee";
    case "CLERK":
    default:
      return "clerk";
  }
}

export function isClosedStatus(status: AcrStatus) {
  return closedStatuses.has(status);
}

export function isDraftStatus(status: AcrStatus) {
  return status === "Draft";
}

export function isReturnedStatus(status: AcrStatus) {
  return status === "Returned";
}

export function isOverdueStatus(item: AcrSummary) {
  return item.isOverdue || item.status === "Overdue";
}

export function isActionableStatus(status: AcrStatus) {
  return actionableStatuses.has(status);
}

export function isOpenStatus(status: AcrStatus) {
  return !isClosedStatus(status);
}

export function parseIsoDate(value: string | null | undefined) {
  if (!value) {
    return Number.POSITIVE_INFINITY;
  }

  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

function urgencyWeight(item: AcrSummary) {
  if (isOverdueStatus(item)) {
    return 5;
  }
  if (item.isPriority) {
    return 4;
  }
  if (isReturnedStatus(item.status)) {
    return 3;
  }
  if (item.status === "Pending Reporting Officer" || item.status === "Pending Countersigning" || item.status === "In Review") {
    return 2;
  }
  if (item.status === "Submitted to Secret Branch") {
    return 1;
  }
  return 0;
}

export function sortAcrsByUrgency(items: AcrSummary[]) {
  return [...items].sort((left, right) => {
    const weightDiff = urgencyWeight(right) - urgencyWeight(left);
    if (weightDiff !== 0) {
      return weightDiff;
    }

    const dueDiff = parseIsoDate(left.dueDate) - parseIsoDate(right.dueDate);
    if (dueDiff !== 0) {
      return dueDiff;
    }

    return left.employee.name.localeCompare(right.employee.name);
  });
}

export function getCurrentStageLabel(item: AcrSummary) {
  if (item.workflowState === "Draft" || isDraftStatus(item.status)) {
    return "Clerk drafting";
  }
  if (item.workflowState === "Returned" || isReturnedStatus(item.status)) {
    return "Returned to clerk";
  }
  if (item.workflowState === "Pending Reporting" || item.status === "Pending Reporting Officer" || item.status === "In Review" || item.status === "Overdue") {
    return "Reporting review";
  }
  if (item.workflowState === "Pending Countersigning" || item.status === "Pending Countersigning") {
    return "Countersigning review";
  }
  if (item.workflowState === "Submitted to Secret Branch" || item.status === "Submitted to Secret Branch") {
    return "Secret Branch archive";
  }
  if (isClosedStatus(item.status)) {
    return "Closed record";
  }
  return item.status;
}

export function getCurrentOwnerLabel(item: AcrSummary) {
  if (item.currentHolderName) {
    return item.currentHolderRole ? `${item.currentHolderName} · ${item.currentHolderRole}` : item.currentHolderName;
  }

  if (isDraftStatus(item.status) || isReturnedStatus(item.status)) {
    return item.initiatedBy;
  }
  if (item.status === "Pending Reporting Officer" || item.status === "In Review" || item.status === "Overdue") {
    return item.reportingOfficer;
  }
  if (item.status === "Pending Countersigning") {
    return item.countersigningOfficer ?? "Pending assignment";
  }
  if (item.status === "Submitted to Secret Branch" || item.status === "Archived" || item.status === "Completed") {
    return "Secret Branch";
  }
  return item.reportingOfficer;
}

export function countStatuses(items: AcrSummary[]) {
  return {
    total: items.length,
    open: items.filter((item) => isOpenStatus(item.status)).length,
    closed: items.filter((item) => isClosedStatus(item.status)).length,
    drafts: items.filter((item) => isDraftStatus(item.status)).length,
    returned: items.filter((item) => isReturnedStatus(item.status)).length,
    overdue: items.filter((item) => isOverdueStatus(item)).length,
    priority: items.filter((item) => item.isPriority).length,
    pendingReview: items.filter((item) =>
      item.status === "Pending Reporting Officer" ||
      item.status === "Pending Countersigning" ||
      item.status === "In Review",
    ).length,
  };
}

export function buildStatusDistribution(items: AcrSummary[]): DashboardDistributionEntry[] {
  return [
    { label: "Draft", value: items.filter((item) => item.status === "Draft").length },
    { label: "Needs Review", value: items.filter((item) => item.status === "Pending Reporting Officer" || item.status === "In Review").length },
    { label: "Countersigning", value: items.filter((item) => item.status === "Pending Countersigning").length },
    { label: "Secret Branch Final", value: items.filter((item) => item.status === "Submitted to Secret Branch" || item.status === "Archived" || item.status === "Completed").length },
    { label: "Returned", value: items.filter((item) => item.status === "Returned").length },
    { label: "Closed", value: items.filter((item) => isClosedStatus(item.status)).length },
  ];
}

export function buildDueDateDistribution(items: AcrSummary[]) {
  const now = Date.now();

  const counts = {
    overdue: 0,
    thisWeek: 0,
    nextWeek: 0,
    later: 0,
  };

  for (const item of items.filter((entry) => isOpenStatus(entry.status))) {
    const dueDate = parseIsoDate(item.dueDate);
    const dayDelta = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));

    if (dayDelta < 0 || item.isOverdue) {
      counts.overdue += 1;
    } else if (dayDelta <= 7) {
      counts.thisWeek += 1;
    } else if (dayDelta <= 14) {
      counts.nextWeek += 1;
    } else {
      counts.later += 1;
    }
  }

  return [
    { label: "Overdue", value: counts.overdue },
    { label: "0-7 days", value: counts.thisWeek },
    { label: "8-14 days", value: counts.nextWeek },
    { label: "15+ days", value: counts.later },
  ];
}
