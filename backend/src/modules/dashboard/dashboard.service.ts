import { Injectable } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { PrismaService } from "../../common/prisma.service";
import { canAccessAcr, loadScopedUser } from "../../helpers/security.utils";
import { mapAcr } from "../../helpers/view-mappers";
import { WorkflowService } from "../workflow/workflow.service";

type DashboardItem = ReturnType<typeof mapAcr>;

function parseReportingYears(reportingPeriod: string) {
  const years = reportingPeriod.match(/\b20\d{2}\b/g)?.map(Number) ?? [];
  if (years.length >= 2) {
    return { startYear: years[0], endYear: years[1] };
  }

  return null;
}

function percentageDelta(current: number, previous: number) {
  if (previous <= 0) {
    return current > 0 ? 100 : null;
  }

  return Math.round(((current - previous) / previous) * 100);
}

function buildDistribution(items: DashboardItem[]) {
  return [
    { label: "Completed", value: items.filter((item) => item.status === "Archived" || item.status === "Completed" || item.status === "Submitted to Secret Branch").length },
    { label: "In Review", value: items.filter((item) => item.status === "In Review").length },
    { label: "Pending RO", value: items.filter((item) => item.status === "Pending Reporting Officer").length },
    { label: "Pending CSO", value: items.filter((item) => item.status === "Pending Countersigning").length },
    { label: "Overdue", value: items.filter((item) => item.isOverdue).length },
    { label: "Draft", value: items.filter((item) => item.status === "Draft").length },
  ];
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workflowService: WorkflowService,
  ) {}

  async getOverview(userId: string, activeRole: UserRole) {
    const user = await loadScopedUser(this.prisma, userId, activeRole);
    const acrs = await this.prisma.acrRecord.findMany({
      include: {
        employee: { include: { wing: true, zone: true, office: true } },
        initiatedBy: true,
        currentHolder: true,
        reportingOfficer: true,
        countersigningOfficer: true,
        timeline: {
          select: {
            actorId: true,
          },
        },
        templateVersion: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const accessibleAcrs = acrs.filter((acr) => canAccessAcr(user, acr));
    const visible = accessibleAcrs.map((acr) => mapAcr(acr, this.workflowService));
    const withYears = visible.map((item) => ({
      item,
      years: parseReportingYears(item.reportingPeriod),
    }));
    const currentStartYear = withYears.reduce((max, entry) => Math.max(max, entry.years?.startYear ?? 0), 0) || new Date().getFullYear();
    const currentFiscalItems = withYears
      .filter((entry) => entry.years?.startYear === currentStartYear)
      .map((entry) => entry.item);
    const previousFiscalItems = withYears
      .filter((entry) => entry.years?.startYear === currentStartYear - 1)
      .map((entry) => entry.item);

    const draftCount = visible.filter((item) => item.status === "Draft").length;
    const returnedCount = visible.filter((item) => item.status === "Returned").length;
    const submittedCount = visible.filter((item) => item.status !== "Draft" && item.status !== "Returned").length;
    const currentFiscalPendingCount = currentFiscalItems.filter((item) => item.status.includes("Pending") || item.status === "In Review").length;
    const currentFiscalCompletedCount = currentFiscalItems.filter((item) => item.status === "Archived" || item.status === "Completed" || item.status === "Submitted to Secret Branch").length;
    const currentFiscalReturnedCount = currentFiscalItems.filter((item) => item.status === "Returned").length;

    const completedAcrs = accessibleAcrs.filter((acr) => acr.completedDate);
    const averageCompletionDays = completedAcrs.length
      ? Math.round(
          completedAcrs.reduce((sum, acr) => {
            return sum + Math.max(1, Math.ceil((acr.completedDate!.getTime() - acr.createdAt.getTime()) / (1000 * 60 * 60 * 24)));
          }, 0) / completedAcrs.length,
        )
      : 0;

    const metrics = {
      initiatedCount: visible.length,
      pendingCount: visible.filter((item) => item.status.includes("Pending") || item.status === "In Review").length,
      overdueCount: visible.filter((item) => item.isOverdue).length,
      completedCount: visible.filter((item) => item.status === "Archived" || item.status === "Completed" || item.status === "Submitted to Secret Branch").length,
      archivedCount: visible.filter((item) => item.status === "Archived" || item.status === "Submitted to Secret Branch").length,
      priorityCount: visible.filter((item) => item.isPriority).length,
      averageCompletionDays,
    };

    return {
      metrics,
      summary: {
        fiscalYearLabel: `${currentStartYear}-${String((currentStartYear + 1) % 100).padStart(2, "0")}`,
        totalCount: visible.length,
        draftCount,
        submittedCount,
        returnedCount,
        currentFiscalInitiatedCount: currentFiscalItems.length,
        currentFiscalPendingCount,
        currentFiscalCompletedCount,
        currentFiscalReturnedCount,
        initiatedDeltaPercent: percentageDelta(currentFiscalItems.length, previousFiscalItems.length),
        completedDeltaPercent: percentageDelta(
          currentFiscalCompletedCount,
          previousFiscalItems.filter((item) => item.status === "Archived" || item.status === "Completed" || item.status === "Submitted to Secret Branch").length,
        ),
      },
      items: visible,
      distribution: buildDistribution(visible),
    };
  }
}
