"use client";

import { FileStack, CheckCircle2, RotateCcw, Activity, Archive, Clock } from "lucide-react";
import Link from "next/link";
import type { DashboardOverview, UserSession, AcrSummary } from "@/types/contracts";
import {
  PortalPageHeader,
  PortalSurface,
  EmptyState,
} from "@/components/portal/PortalPrimitives";
import { StatCard, StatusChip, OverdueBadge } from "@/components/ui";
import { isOpenStatus, isClosedStatus, isReturnedStatus } from "@/utils/acr";

interface EmployeeDashboardProps {
  session: UserSession;
  overview: DashboardOverview;
}

export function EmployeeDashboard({ session, overview }: EmployeeDashboardProps) {
  // The backend already scopes overview.items to this employee's ACRs via buildAcrAccessPreFilter.
  // item.employee.id is the employee profile ID, not the user ID, so no client-side filter is needed.
  const employeeItems = overview.items;

  const stats = {
    total: employeeItems.length,
    active: employeeItems.filter((item) => isOpenStatus(item.status)).length,
    completed: employeeItems.filter((item) => isClosedStatus(item.status))
      .length,
    returned: employeeItems.filter((item) => isReturnedStatus(item.status))
      .length,
  };

  // Get active (non-archived) items for current status
  const activeItems = employeeItems.filter((item) => isOpenStatus(item.status));

  // Group items by calendar year for service history
  const groupedByYear = new Map<number, AcrSummary[]>();
  for (const item of employeeItems) {
    const year = item.calendarYear || new Date(item.reportingPeriodTo || item.initiatedDate).getFullYear();
    if (!groupedByYear.has(year)) {
      groupedByYear.set(year, []);
    }
    groupedByYear.get(year)!.push(item);
  }

  const yearGroups = Array.from(groupedByYear.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([year, items]) => ({
      year,
      items,
      count: items.length,
      archivedCount: items.filter((i) => isClosedStatus(i.status)).length,
      latestStatus: items[0]?.status || "Unknown",
    }));

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PortalPageHeader
        eyebrow={`${session.activeRole} · Personal Record View`}
        title={session.name || "My ACR Records"}
        description={overview.summary.fiscalYearLabel}
      />

      {/* KPI Stats - 4 cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="My ACR Records"
          value={stats.total}
          icon={<FileStack size={18} />}
          accent="navy"
        />
        <StatCard
          title="Active / In-Progress"
          value={stats.active}
          icon={<Activity size={18} />}
          accent="cyan"
        />
        <StatCard
          title="Completed / Archived"
          value={stats.completed}
          icon={<CheckCircle2 size={18} />}
          accent="green"
        />
        <StatCard
          title="Returned for Rework"
          value={stats.returned}
          icon={<RotateCcw size={18} />}
          accent="amber"
        />
      </div>

      {/* Current Status Panel */}
      <PortalSurface title="Current Workflow Status">
        {activeItems.length > 0 ? (
          <div className="space-y-3">
            {activeItems.slice(0, 3).map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-2 rounded-lg border border-[var(--fia-gray-200)] bg-[var(--fia-gray-50)] p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[var(--fia-gray-900)]">
                    {item.acrNo}
                  </p>
                  <p className="text-sm text-[var(--fia-gray-500)]">
                    {item.reportingPeriod}
                    {item.templateFamily && (
                      <span className="ml-2">· {item.templateFamily}</span>
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <StatusChip status={item.status} size="sm" />
                  {item.isOverdue && item.overdueDays !== undefined && (
                    <OverdueBadge days={item.overdueDays} />
                  )}
                </div>
              </div>
            ))}
            {activeItems.length > 3 && (
              <p className="text-sm text-[var(--fia-gray-500)]">
                +{activeItems.length - 3} more record(s)
              </p>
            )}
          </div>
        ) : (
          <EmptyState
            title="No Active Records"
            description="All your ACR records have been completed or archived."
          />
        )}
      </PortalSurface>

      {/* Service Period History */}
      <PortalSurface title="Service Record History">
        {yearGroups.length > 0 ? (
          <div className="space-y-2.5">
            {yearGroups.map((group) => (
              <div
                key={group.year}
                className="flex flex-col gap-2 rounded-lg border border-[var(--fia-gray-200)] bg-[var(--fia-gray-50)] p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-semibold text-[var(--fia-gray-900)]">
                    {group.year}
                  </p>
                  <p className="text-sm text-[var(--fia-gray-500)]">
                    {group.count} record{group.count !== 1 ? "s" : ""} ·{" "}
                    {group.archivedCount} archived
                  </p>
                </div>
                <StatusChip status={group.latestStatus} size="sm" />
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No Records"
            description="You don't have any ACR records yet."
          />
        )}
      </PortalSurface>

      {/* Complete ACR History Table */}
      <PortalSurface title="Complete ACR History">
        {employeeItems.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--fia-gray-200)]">
                  <th className="pb-2.5 text-left font-semibold text-[var(--fia-gray-600)]">
                    ACR No
                  </th>
                  <th className="pb-2.5 text-left font-semibold text-[var(--fia-gray-600)]">
                    Reporting Period
                  </th>
                  <th className="pb-2.5 text-left font-semibold text-[var(--fia-gray-600)]">
                    Status
                  </th>
                  <th className="pb-2.5 text-left font-semibold text-[var(--fia-gray-600)]">
                    Submitted
                  </th>
                  <th className="pb-2.5 text-left font-semibold text-[var(--fia-gray-600)]">
                    Completed
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--fia-gray-200)]">
                {employeeItems.map((item) => (
                  <tr key={item.id} className="hover:bg-[var(--fia-gray-50)]">
                    <td className="py-2.5 font-semibold text-[var(--fia-gray-900)]">
                      {item.acrNo}
                    </td>
                    <td className="py-2.5 text-[var(--fia-gray-600)]">
                      {item.reportingPeriod}
                    </td>
                    <td className="py-2.5">
                      <StatusChip status={item.status} size="sm" />
                    </td>
                    <td className="py-2.5 text-[var(--fia-gray-600)]">
                      {item.initiatedDate
                        ? new Date(item.initiatedDate).toLocaleDateString(
                            "en-PK",
                            { month: "short", day: "numeric", year: "numeric" },
                          )
                        : "—"}
                    </td>
                    <td className="py-2.5 text-[var(--fia-gray-600)]">
                      {item.completedDate
                        ? new Date(item.completedDate).toLocaleDateString(
                            "en-PK",
                            { month: "short", day: "numeric", year: "numeric" },
                          )
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No Records"
            description="Your complete ACR history will appear here."
          />
        )}
      </PortalSurface>
    </div>
  );
}
