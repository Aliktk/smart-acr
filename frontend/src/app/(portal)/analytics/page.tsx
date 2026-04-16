"use client";

import { useQuery } from "@tanstack/react-query";
import { getAnalytics, getSession } from "@/api/client";
import { getRoleLabel } from "@/utils/roles";

export default function AnalyticsPage() {
  const sessionQuery = useQuery({
    queryKey: ["session"],
    queryFn: getSession,
  });
  const { data } = useQuery({
    queryKey: ["analytics"],
    queryFn: getAnalytics,
  });
  const totalBacklog = data?.backlogDistribution.reduce((sum, item) => sum + item.pending, 0) ?? 0;
  const totalWings = data?.wingWiseTrends.length ?? 0;
  const totalAcrs = data?.wingWiseTrends.reduce((sum, item) => sum + item.acrCount, 0) ?? 0;

  const kpis = [
    { label: "Visible Wings", value: totalWings, color: "#1A1C6E", bg: "#EEF2FF" },
    { label: "Visible ACRs", value: totalAcrs, color: "#0095D9", bg: "#EEF8FF" },
    { label: "Current Backlog", value: totalBacklog, color: "#BE123C", bg: "#FFF1F2" },
  ];

  const maxBacklog = Math.max(1, ...(data?.backlogDistribution.map((item) => item.pending) ?? []));

  return (
    <div className="mx-auto max-w-screen-xl space-y-5 p-6">
      <div>
        <span className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-[var(--fia-navy-50)] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[var(--fia-navy-500)] dark:text-[var(--fia-cyan)]">
          {getRoleLabel(sessionQuery.data?.activeRoleCode ?? "DG")}
        </span>
        <h1 className="text-[1.75rem] font-bold text-[var(--fia-gray-900)]">Leadership Analytics</h1>
        <p className="mt-0.5 text-sm text-[var(--fia-text-secondary)]">Executive summary of wing throughput, backlog concentration, and organizational load.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {kpis.map((item) => (
          <div key={item.label} className="rounded-2xl border border-[var(--fia-gray-200)] bg-[var(--card)] px-5 py-4 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: item.color }} />
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--fia-gray-400)]">{item.label}</p>
            </div>
            <p className="mt-2 text-[2rem] font-bold" style={{ color: item.color }}>{item.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-[var(--fia-gray-200)] bg-[var(--card)] shadow-sm overflow-hidden">
          <div className="border-b border-[var(--fia-gray-200)] bg-gradient-to-r from-[var(--fia-navy-50)] via-[var(--fia-gray-50)] to-transparent px-5 py-3.5">
            <h2 className="text-sm font-semibold text-[var(--fia-gray-900)]">Wing-wise Trends</h2>
          </div>
          <div className="space-y-2.5 p-5">
            {data?.wingWiseTrends.map((item) => (
              <div key={item.name} className="rounded-xl border border-[var(--fia-gray-100)] bg-[var(--fia-gray-50)] px-4 py-3">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-[var(--fia-gray-900)]">{item.name}</p>
                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--fia-navy-50)] px-2.5 py-0.5 text-xs font-semibold text-[var(--fia-navy-500)]">
                    {item.acrCount} ACRs
                  </span>
                </div>
                <p className="mt-1 text-sm text-[var(--fia-text-secondary)]">{item.employees} employees · {item.offices} offices</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--fia-gray-200)] bg-[var(--card)] shadow-sm overflow-hidden">
          <div className="border-b border-[var(--fia-gray-200)] bg-gradient-to-r from-[var(--fia-danger-bg)] via-[var(--fia-gray-50)] to-transparent px-5 py-3.5">
            <h2 className="text-sm font-semibold text-[var(--fia-gray-900)]">Backlog Distribution</h2>
          </div>
          <div className="space-y-4 p-5">
            {data?.backlogDistribution.map((item) => (
              <div key={item.name}>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-medium text-[var(--fia-gray-700)]">{item.name}</span>
                  <span className="rounded-full bg-[var(--fia-danger-bg)] px-2 py-0.5 text-xs font-bold text-[var(--fia-danger)]">{item.pending}</span>
                </div>
                <div className="h-2 rounded-full bg-[var(--fia-gray-100)]">
                  <div
                    className="h-2 rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(4, (item.pending / maxBacklog) * 100)}%`, background: "linear-gradient(to right, var(--fia-navy), var(--fia-navy-400))" }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
