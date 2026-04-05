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

  return (
    <div className="mx-auto max-w-screen-xl space-y-5 p-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#64748B]">
          {getRoleLabel(sessionQuery.data?.activeRoleCode ?? "DG")}
        </p>
        <h1 className="mt-1 text-xl font-bold text-[#111827]">Leadership Analytics</h1>
        <p className="mt-0.5 text-sm text-gray-500">Executive summary of wing throughput, backlog concentration, and organizational load.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          { label: "Visible Wings", value: totalWings },
          { label: "Visible ACRs", value: totalAcrs },
          { label: "Current Backlog", value: totalBacklog },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-gray-200 bg-white px-4 py-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#94A3B8]">{item.label}</p>
            <p className="mt-2 text-2xl font-semibold text-[#111827]">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-[#111827]">Wing-wise Trends</h2>
          <div className="mt-4 space-y-3">
            {data?.wingWiseTrends.map((item) => (
              <div key={item.name} className="rounded-lg border border-gray-100 bg-[#F9FAFB] p-4">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-[#111827]">{item.name}</p>
                  <span className="text-sm text-[#1A1C6E]">{item.acrCount} ACRs</span>
                </div>
                <p className="mt-1 text-sm text-gray-500">{item.employees} employees across {item.offices} offices</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-[#111827]">Backlog Distribution</h2>
          <div className="mt-4 space-y-3">
            {data?.backlogDistribution.map((item) => (
              <div key={item.name}>
                <div className="mb-1 flex items-center justify-between text-sm text-gray-600">
                  <span>{item.name}</span>
                  <span className="font-semibold text-[#111827]">{item.pending}</span>
                </div>
                <div className="h-2 rounded-full bg-gray-100">
                  <div className="h-2 rounded-full bg-[#1A1C6E]" style={{ width: `${Math.max(8, item.pending * 20)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
