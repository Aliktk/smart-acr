import { Injectable } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { PrismaService } from "../../common/prisma.service";
import { buildAcrAccessPreFilter, canAccessAcr, loadScopedUser } from "../../helpers/security.utils";
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
    { label: "Completed", value: items.filter((item) => item.status === "Archived" || item.status === "Completed").length },
    { label: "In Review", value: items.filter((item) => item.status === "Pending Secret Branch Review" || item.status === "Pending Secret Branch Verification").length },
    { label: "Pending RO", value: items.filter((item) => item.status === "Pending Reporting Officer").length },
    { label: "Pending CSO", value: items.filter((item) => item.status === "Pending Countersigning Officer").length },
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
    const accessWhere = buildAcrAccessPreFilter(user);

    const acrs = await this.prisma.acrRecord.findMany({
      where: accessWhere ?? undefined,
      include: {
        employee: { include: { wing: true, directorate: true, region: true, zone: true, circle: true, station: true, branch: true, cell: true, office: true, department: true } },
        initiatedBy: true,
        currentHolder: true,
        reportingOfficer: true,
        countersigningOfficer: true,
        timeline: {
          select: {
            actorId: true,
            action: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: "asc" },
          take: 10,
        },
        templateVersion: true,
        archiveSnapshot: true,
        archiveRecord: true,
      },
      orderBy: { createdAt: "desc" },
      take: 1000,
    });

    const accessibleAcrs = acrs.filter((acr) => canAccessAcr(user, acr));
    const employeeSafe = activeRole === UserRole.EMPLOYEE;
    const visible = accessibleAcrs.map((acr) => mapAcr(acr, this.workflowService, { employeeSafe }));
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
    const returnedCount = visible.filter((item) => item.status.startsWith("Returned")).length;
    const submittedCount = visible.filter((item) => item.status !== "Draft" && !item.status.startsWith("Returned")).length;
    const currentFiscalPendingCount = currentFiscalItems.filter((item) => item.status.includes("Pending") || item.status === "In Review").length;
    const currentFiscalCompletedCount = currentFiscalItems.filter((item) => item.status === "Archived" || item.status === "Completed").length;
    const currentFiscalReturnedCount = currentFiscalItems.filter((item) => item.status.startsWith("Returned")).length;

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
      completedCount: visible.filter((item) => item.status === "Archived" || item.status === "Completed").length,
      archivedCount: visible.filter((item) => item.status === "Archived").length,
      priorityCount: visible.filter((item) => item.isPriority).length,
      averageCompletionDays,
      rectificationReturnsCount: visible.filter((item) => item.status === "Returned to Admin Office").length,
      adversePendingCount: visible.filter((item) => item.hasAdverseRemarks && item.status !== "Archived").length,
      intakeIssuesCount: visible.filter((item) => item.status === "Returned to Admin Office").length,
      secretCellPendingIntake: visible.filter((item) => item.status === "Pending Secret Cell Intake").length,
      pendingAdminForwarding: visible.filter((item) => item.status === "Pending Admin Office Forwarding").length,
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
          previousFiscalItems.filter((item) => item.status === "Archived" || item.status === "Completed").length,
        ),
      },
      items: visible,
      distribution: buildDistribution(visible),
      retirementWarnings: await this.getRetirementWarnings(userId, activeRole),
    };
  }

  private async getRetirementWarnings(userId: string, activeRole: UserRole) {
    if (
      activeRole !== UserRole.REPORTING_OFFICER &&
      activeRole !== UserRole.SUPER_ADMIN &&
      activeRole !== UserRole.IT_OPS
    ) {
      return [];
    }

    const ninetyDaysFromNow = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

    const retiringEmployees = await this.prisma.employee.findMany({
      where: {
        reportingOfficerId: userId,
        status: "ACTIVE",
        retirementDate: {
          lte: ninetyDaysFromNow,
          gte: new Date(),
        },
      },
      select: {
        id: true,
        name: true,
        designation: true,
        bps: true,
        retirementDate: true,
        acrRecords: {
          where: {
            calendarYear: new Date().getFullYear(),
            workflowState: { not: "ARCHIVED" },
          },
          select: { id: true, workflowState: true },
        },
      },
    });

    return retiringEmployees
      .filter((employee) => employee.acrRecords.length === 0)
      .map((employee) => ({
        employeeId: employee.id,
        employeeName: employee.name,
        designation: employee.designation,
        bps: employee.bps,
        retirementDate: employee.retirementDate!.toISOString(),
        daysUntilRetirement: Math.ceil(
          (employee.retirementDate!.getTime() - Date.now()) / (24 * 60 * 60 * 1000),
        ),
        pendingAcrCount: 0,
        message: `${employee.name} (BPS-${employee.bps}) retires on ${employee.retirementDate!.toISOString().slice(0, 10)}. Complete their ACR before retirement per FIA Standing Order.`,
      }));
  }
}
