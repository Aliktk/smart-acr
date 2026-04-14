"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Archive, Search, ShieldCheck, Users } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { getAcrs, getEmployees } from "@/api/client";
import { PortalPageHeader, PortalSurface, EmptyState, SegmentedTabs } from "@/components/portal/PortalPrimitives";
import { OverdueBadge, PriorityBadge, StatCard, StatusChip } from "@/components/ui";
import { countStatuses, sortAcrsByUrgency } from "@/utils/acr";

type ResultMode = "all" | "acrs" | "employees";

export function SearchClientPage() {
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();
  const initialQuery = searchParams.get("query") ?? "";
  const [queryText, setQueryText] = useState(initialQuery);
  const [resultMode, setResultMode] = useState<ResultMode>("all");
  const [wingFilter, setWingFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const deferredQuery = useDeferredValue(queryText.trim());

  useEffect(() => {
    setQueryText(searchParams.get("query") ?? "");
  }, [searchKey, searchParams]);

  const employeesQuery = useQuery({
    queryKey: ["employees", deferredQuery],
    queryFn: () => getEmployees(deferredQuery),
    enabled: deferredQuery.length > 0,
  });

  const acrQuery = useQuery({
    queryKey: ["acrs-search", deferredQuery],
    queryFn: () => getAcrs({ query: deferredQuery }),
    enabled: deferredQuery.length > 0,
  });

  const employeeItems = employeesQuery.data?.items ?? [];
  const acrItems = sortAcrsByUrgency(acrQuery.data?.items ?? []);
  const statusCounts = countStatuses(acrItems);
  const wingLabel = (value?: string | null) => value ?? "Unassigned";

  const wingOptions = useMemo(
    () => ["All", ...new Set([...acrItems.map((item) => wingLabel(item.wing)), ...employeeItems.map((item) => wingLabel(item.wing))])],
    [acrItems, employeeItems],
  );

  const statusOptions = useMemo(
    () => ["All", ...new Set(acrItems.map((item) => item.status))],
    [acrItems],
  );

  const filteredAcrs = useMemo(
    () =>
      acrItems.filter((item) => {
        const wingMatches = wingFilter === "All" || wingLabel(item.wing) === wingFilter;
        const statusMatches = statusFilter === "All" || item.status === statusFilter;
        return wingMatches && statusMatches;
      }),
    [acrItems, statusFilter, wingFilter],
  );

  const filteredEmployees = useMemo(
    () =>
      employeeItems.filter((item) => {
        return wingFilter === "All" || wingLabel(item.wing) === wingFilter;
      }),
    [employeeItems, wingFilter],
  );

  const tabs: Array<{ key: ResultMode; label: string; count: number }> = [
    { key: "all", label: "All results", count: filteredAcrs.length + filteredEmployees.length },
    { key: "acrs", label: "ACR records", count: filteredAcrs.length },
    { key: "employees", label: "Employees", count: filteredEmployees.length },
  ];

  const hasQuery = deferredQuery.length > 0;

  return (
    <div className="mx-auto flex max-w-screen-2xl flex-col gap-5 p-5">
      <PortalPageHeader
        eyebrow="Enterprise search"
        title="Search Records"
      />

      <PortalSurface title="Search">
        <div className="space-y-3.5">
          <label className="relative block">
            <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--fia-gray-400)]" />
            <input
              value={queryText}
              onChange={(event) => setQueryText(event.target.value)}
              placeholder="Try: FIA/ACR, officer name, CNIC, mobile, wing, or office"
              className="w-full rounded-[20px] border border-[var(--fia-gray-200)] bg-[var(--fia-gray-50)] py-3 pl-12 pr-4 text-[15px] outline-none transition-all focus:border-[var(--fia-cyan)] focus:bg-white focus:ring-4 focus:ring-[rgba(0,149,217,0.10)]"
            />
          </label>

          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <SegmentedTabs tabs={tabs} value={resultMode} onChange={setResultMode} />
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={wingFilter}
                onChange={(event) => setWingFilter(event.target.value)}
                className="rounded-full border border-[var(--fia-gray-200)] bg-white px-4 py-2 text-sm text-[var(--fia-gray-700)] outline-none focus:border-[var(--fia-cyan)]"
              >
                {wingOptions.map((option) => (
                  <option key={option} value={option}>
                    {option === "All" ? "All wings" : option}
                  </option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="rounded-full border border-[var(--fia-gray-200)] bg-white px-4 py-2 text-sm text-[var(--fia-gray-700)] outline-none focus:border-[var(--fia-cyan)]"
              >
                {statusOptions.map((option) => (
                  <option key={option} value={option}>
                    {option === "All" ? "All statuses" : option}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </PortalSurface>

      {!hasQuery ? (
        <EmptyState
          title="Start with one broad term"
          description="Search is designed to work from a single strong keyword first. Good examples are a CNIC fragment, officer name, ACR number, office, or wing."
        />
      ) : (
        <>
          {employeesQuery.isLoading || acrQuery.isLoading ? (
            <PortalSurface title="Searching">
              <div className="py-12 text-center text-sm text-[var(--fia-gray-500)]">Loading search results...</div>
            </PortalSurface>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <StatCard title="ACR Results" value={filteredAcrs.length} subtitle="Records matched after local filters" icon={<Search size={18} />} accent="navy" />
                <StatCard title="Employee Results" value={filteredEmployees.length} subtitle="Directory matches after local filters" icon={<Users size={18} />} accent="cyan" />
                <StatCard title="Needs Attention" value={filteredAcrs.filter((item) => item.isPriority || item.isOverdue || item.status.startsWith("Returned")).length} subtitle="Priority, overdue, or returned" icon={<ShieldCheck size={18} />} accent="amber" />
                <StatCard title="Closed Records" value={statusCounts.closed} subtitle="Archived or completed matches" icon={<Archive size={18} />} accent="green" />
              </div>

              {(resultMode === "all" || resultMode === "acrs") ? (
                <PortalSurface title="ACR records">
                  {filteredAcrs.length === 0 ? (
                    <EmptyState
                      title="No ACR records matched"
                      description="Try a broader keyword or switch the local wing and status filters back to All."
                    />
                  ) : (
                    <div className="space-y-2.5">
                      {filteredAcrs.map((record) => (
                        <Link
                          key={record.id}
                          href={`/acr/${record.id}`}
                          className="block rounded-[18px] border border-[var(--fia-gray-200)] bg-[linear-gradient(180deg,#FFFFFF_0%,#FCFCFD_100%)] px-4 py-3.5 transition-all hover:border-[var(--fia-gray-300)] hover:shadow-[0_10px_24px_rgba(15,23,42,0.06)]"
                        >
                          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                            <div className="space-y-1.5">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-semibold text-[var(--fia-navy)]">{record.acrNo}</span>
                                <StatusChip status={record.status} />
                                {record.isPriority ? <PriorityBadge priority /> : null}
                                {record.isOverdue ? <OverdueBadge days={record.overdueDays} /> : null}
                              </div>
                              <div>
                                <p className="text-base font-semibold text-[var(--fia-gray-950)]">{record.employee.name}</p>
                                <p className="mt-0.5 text-sm text-[var(--fia-gray-500)]">
                                  {record.employee.rank} · {wingLabel(record.wing)} · {record.reportingPeriod}
                                </p>
                              </div>
                            </div>
                            <div className="grid gap-1.5 text-sm text-[var(--fia-gray-600)] xl:text-right">
                              <p>Reporting Officer: <span className="font-medium text-[var(--fia-gray-800)]">{record.reportingOfficer}</span></p>
                              <p>Due: <span className={`font-medium ${record.isOverdue ? "text-[var(--fia-danger)]" : "text-[var(--fia-gray-800)]"}`}>{record.dueDate}</span></p>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </PortalSurface>
              ) : null}

              {(resultMode === "all" || resultMode === "employees") ? (
                <PortalSurface title="Employees">
                  {filteredEmployees.length === 0 ? (
                    <EmptyState
                      title="No employee records matched"
                      description="Try a broader term such as a mobile fragment, CNIC fragment, rank, or office."
                    />
                  ) : (
                    <div className="grid gap-2.5 md:grid-cols-2">
                      {filteredEmployees.map((employee) => (
                        <div
                          key={employee.id}
                          className="rounded-[18px] border border-[var(--fia-gray-200)] bg-[linear-gradient(180deg,#FFFFFF_0%,#FCFCFD_100%)] px-4 py-3.5"
                        >
                          <p className="text-base font-semibold text-[var(--fia-gray-950)]">{employee.name}</p>
                          <p className="mt-1 text-sm text-[var(--fia-gray-500)]">
                            {employee.rank} · BPS-{employee.bps} · {wingLabel(employee.wing)}
                          </p>
                          <div className="mt-3 grid gap-1.5 text-sm text-[var(--fia-gray-600)]">
                            <p>Office: <span className="font-medium text-[var(--fia-gray-800)]">{employee.office ?? "Not assigned"}</span></p>
                            <p>CNIC: <span className="font-medium text-[var(--fia-gray-800)]">{employee.cnic}</span></p>
                            <p>Mobile: <span className="font-medium text-[var(--fia-gray-800)]">{employee.mobile}</span></p>
                            <p>Reporting Officer: <span className="font-medium text-[var(--fia-gray-800)]">{employee.reportingOfficer ?? "Not assigned"}</span></p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </PortalSurface>
              ) : null}
            </>
          )}
        </>
      )}
    </div>
  );
}
