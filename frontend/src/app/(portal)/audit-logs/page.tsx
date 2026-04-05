"use client";

import { Fragment, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Filter,
  Search,
  ShieldCheck,
} from "lucide-react";
import { getAuditLogs } from "@/api/client";
import type { AuditEvent } from "@/types/contracts";

const moduleOptions: Array<{ value: AuditEvent["module"] | "all"; label: string }> = [
  { value: "all", label: "All modules" },
  { value: "ACR", label: "ACR" },
  { value: "Authentication", label: "Authentication" },
  { value: "Settings", label: "Settings" },
  { value: "Administration", label: "Administration" },
  { value: "System", label: "System" },
];

const eventTypeOptions: Array<{ value: AuditEvent["eventType"] | "all"; label: string }> = [
  { value: "all", label: "All event types" },
  { value: "create", label: "Create" },
  { value: "update", label: "Update" },
  { value: "transition", label: "Transition" },
  { value: "archive", label: "Archive" },
  { value: "authentication", label: "Authentication" },
  { value: "system", label: "System" },
];

function formatTimestamp(timestamp: string) {
  return new Date(timestamp).toLocaleString("en-PK", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function actionBadgeTone(eventType: AuditEvent["eventType"]) {
  switch (eventType) {
    case "create":
      return "bg-[#ECFDF5] text-[#15803D]";
    case "update":
      return "bg-[#EFF6FF] text-[#1D4ED8]";
    case "transition":
      return "bg-[#EEF2FF] text-[#4338CA]";
    case "archive":
      return "bg-[#F5F3FF] text-[#7C3AED]";
    case "authentication":
      return "bg-[#FFF7ED] text-[#C2410C]";
    case "system":
    default:
      return "bg-[#F1F5F9] text-[#334155]";
  }
}

function moduleBadgeTone(module: AuditEvent["module"]) {
  switch (module) {
    case "ACR":
      return "bg-[#E0F2FE] text-[#0369A1]";
    case "Authentication":
      return "bg-[#FEF3C7] text-[#92400E]";
    case "Settings":
      return "bg-[#FCE7F3] text-[#BE185D]";
    case "Administration":
      return "bg-[#EDE9FE] text-[#6D28D9]";
    case "System":
    default:
      return "bg-[#F1F5F9] text-[#475569]";
  }
}

function FilterInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="relative block">
      <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-[#D8DEE8] bg-[#F8FAFC] py-2.5 pl-10 pr-4 text-sm text-[#111827] outline-none transition focus:border-[#0095D9] focus:bg-white focus:ring-4 focus:ring-[#0095D9]/10"
      />
    </label>
  );
}

function FilterSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="w-full rounded-2xl border border-[#D8DEE8] bg-[#F8FAFC] px-4 py-2.5 text-sm text-[#111827] outline-none transition focus:border-[#0095D9] focus:bg-white"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export default function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selectedAction, setSelectedAction] = useState("all");
  const [selectedRole, setSelectedRole] = useState("all");
  const [selectedModule, setSelectedModule] = useState<AuditEvent["module"] | "all">("all");
  const [selectedEventType, setSelectedEventType] = useState<AuditEvent["eventType"] | "all">("all");
  const [actorName, setActorName] = useState("");
  const [recordQuery, setRecordQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const deferredActorName = useDeferredValue(actorName);
  const deferredRecordQuery = useDeferredValue(recordQuery);

  useEffect(() => {
    setPage(1);
  }, [selectedAction, selectedRole, selectedModule, selectedEventType, deferredActorName, deferredRecordQuery, dateFrom, dateTo, pageSize]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: [
      "audit",
      {
        page,
        pageSize,
        action: selectedAction,
        actorRole: selectedRole,
        actorName: deferredActorName,
        recordQuery: deferredRecordQuery,
        dateFrom,
        dateTo,
        module: selectedModule,
        eventType: selectedEventType,
      },
    ],
    queryFn: () =>
      getAuditLogs({
        page,
        pageSize,
        action: selectedAction === "all" ? undefined : selectedAction,
        actorRole: selectedRole === "all" ? undefined : selectedRole,
        actorName: deferredActorName,
        recordQuery: deferredRecordQuery,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        module: selectedModule,
        eventType: selectedEventType,
      }),
  });

  const items = data?.items ?? [];
  const summary = useMemo(
    () => ({
      total: data?.total ?? 0,
      acr: items.filter((item) => item.module === "ACR").length,
      auth: items.filter((item) => item.module === "Authentication").length,
      changes: items.filter((item) => item.eventType === "update" || item.eventType === "transition").length,
    }),
    [data?.total, items],
  );

  async function copyText(value?: string) {
    if (!value || typeof navigator === "undefined" || !navigator.clipboard) {
      return;
    }

    await navigator.clipboard.writeText(value);
  }

  return (
    <div className="mx-auto max-w-screen-2xl space-y-4 p-5">
      <section className="overflow-hidden rounded-[26px] border border-[#D7DEEA] bg-white shadow-sm">
        <div className="border-b border-[#E6EBF2] bg-[linear-gradient(135deg,#1A1C6E_0%,#20267F_65%,#2B3B99_100%)] px-5 py-5 text-white">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/80">
                <ShieldCheck size={14} />
                System Audit Trail
              </div>
              <h1 className="mt-3 text-[1.4rem] font-semibold tracking-[-0.02em] text-white">Audit Logs</h1>
              <p className="mt-1 text-sm text-white/74">Live system events, workflow actions, authentication activity, and administrative changes.</p>
            </div>

            <div className="grid min-w-[260px] gap-2 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/12 bg-white/10 px-3.5 py-3">
                <p className="text-[11px] uppercase tracking-[0.15em] text-white/60">Total Events</p>
                <p className="mt-1 text-xl font-semibold text-white">{summary.total}</p>
              </div>
              <div className="rounded-2xl border border-white/12 bg-white/10 px-3.5 py-3">
                <p className="text-[11px] uppercase tracking-[0.15em] text-white/60">ACR Module</p>
                <p className="mt-1 text-xl font-semibold text-white">{summary.acr}</p>
              </div>
              <div className="rounded-2xl border border-white/12 bg-white/10 px-3.5 py-3">
                <p className="text-[11px] uppercase tracking-[0.15em] text-white/60">Updates / Moves</p>
                <p className="mt-1 text-xl font-semibold text-white">{summary.changes}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="border-b border-[#E6EBF2] bg-[#F8FAFD] px-5 py-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#334155]">
            <Filter size={16} />
            Filter audit stream
          </div>
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_repeat(4,minmax(0,180px))]">
            <FilterInput value={actorName} onChange={setActorName} placeholder="Search actor name" />
            <FilterInput value={recordQuery} onChange={setRecordQuery} placeholder="Search ACR number or record id" />
            <FilterSelect
              value={selectedAction}
              onChange={setSelectedAction}
              options={[
                { value: "all", label: "All actions" },
                ...(data?.facets.actions ?? []).map((action) => ({ value: action, label: action })),
              ]}
            />
            <FilterSelect
              value={selectedRole}
              onChange={setSelectedRole}
              options={[
                { value: "all", label: "All roles" },
                ...(data?.facets.actorRoles ?? []).map((role) => ({ value: role, label: role })),
              ]}
            />
            <FilterSelect value={selectedModule} onChange={(value) => setSelectedModule(value as AuditEvent["module"] | "all")} options={moduleOptions} />
            <FilterSelect
              value={selectedEventType}
              onChange={(value) => setSelectedEventType(value as AuditEvent["eventType"] | "all")}
              options={eventTypeOptions}
            />
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-[#64748B]">From date</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
                className="w-full rounded-2xl border border-[#D8DEE8] bg-white px-4 py-2.5 text-sm text-[#111827] outline-none transition focus:border-[#0095D9]"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-[#64748B]">To date</span>
              <input
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
                className="w-full rounded-2xl border border-[#D8DEE8] bg-white px-4 py-2.5 text-sm text-[#111827] outline-none transition focus:border-[#0095D9]"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-[#64748B]">Rows per page</span>
              <select
                value={String(pageSize)}
                onChange={(event) => setPageSize(Number(event.target.value))}
                className="w-full rounded-2xl border border-[#D8DEE8] bg-white px-4 py-2.5 text-sm text-[#111827] outline-none transition focus:border-[#0095D9]"
              >
                {[10, 25, 50, 100].map((size) => (
                  <option key={size} value={size}>
                    {size} rows
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 z-10 bg-[#F8FAFD] text-left text-[11px] uppercase tracking-[0.16em] text-[#64748B]">
                <tr>
                  <th className="px-5 py-3.5 font-semibold">Action</th>
                  <th className="px-5 py-3.5 font-semibold">Actor</th>
                  <th className="px-5 py-3.5 font-semibold">Record</th>
                  <th className="px-5 py-3.5 font-semibold">Timestamp</th>
                  <th className="px-5 py-3.5 font-semibold">Network</th>
                  <th className="px-5 py-3.5 font-semibold text-right">Details</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  [...Array(8)].map((_, index) => (
                    <tr key={index} className="border-t border-[#EEF2F7]">
                      <td colSpan={6} className="px-5 py-4">
                        <div className="h-16 animate-pulse rounded-2xl bg-[#F8FAFC]" />
                      </td>
                    </tr>
                  ))
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-12">
                      <div className="rounded-[22px] border border-dashed border-[#D8DEE8] bg-[#F8FAFC] px-6 py-10 text-center">
                        <p className="text-base font-semibold text-[#111827]">No audit events match the current filters</p>
                        <p className="mt-2 text-sm text-[#64748B]">Adjust the filters or clear the search inputs to widen the audit stream.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  items.map((item) => {
                    const expanded = expandedId === item.id;

                    return (
                      <Fragment key={item.id}>
                        <tr key={item.id} className="border-t border-[#EEF2F7] align-top transition hover:bg-[#FBFCFE]">
                          <td className="px-5 py-4">
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${actionBadgeTone(item.eventType)}`}>
                                  {item.action}
                                </span>
                                <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${moduleBadgeTone(item.module)}`}>
                                  {item.module}
                                </span>
                              </div>
                              <p className="max-w-[360px] leading-5 text-[#475569]">{item.description}</p>
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <div className="min-w-[180px]">
                              <p className="font-semibold text-[#111827]">{item.actorName}</p>
                              <p className="mt-1 text-xs text-[#64748B]">{item.actorRole}</p>
                              {item.actorId ? <p className="mt-1 text-xs text-[#94A3B8]">{item.actorId}</p> : null}
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            {item.recordLabel || item.recordId ? (
                              <div className="min-w-[200px]">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-xs font-semibold text-[#111827]">{item.recordLabel ?? item.recordId}</span>
                                  <button
                                    type="button"
                                    onClick={() => void copyText(item.recordLabel ?? item.recordId)}
                                    className="rounded-full p-1 text-[#94A3B8] transition hover:bg-[#F1F5F9] hover:text-[#111827]"
                                    aria-label="Copy record reference"
                                  >
                                    <Copy size={14} />
                                  </button>
                                </div>
                                <p className="mt-1 text-xs text-[#64748B]">{item.recordType}</p>
                              </div>
                            ) : (
                              <span className="text-[#94A3B8]">System</span>
                            )}
                          </td>
                          <td className="px-5 py-4">
                            <div className="min-w-[170px]">
                              <p className="font-medium text-[#111827]">{formatTimestamp(item.timestamp)}</p>
                              <p className="mt-1 text-xs text-[#94A3B8]">{item.eventType}</p>
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <div className="min-w-[120px]">
                              <p className="font-mono text-xs text-[#475569]">{item.ipAddress || "unknown"}</p>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-right">
                            <button
                              type="button"
                              onClick={() => setExpandedId((current) => (current === item.id ? null : item.id))}
                              className="inline-flex items-center gap-2 rounded-full border border-[#D8DEE8] bg-white px-3 py-1.5 text-xs font-semibold text-[#334155] transition hover:border-[#CBD5E1] hover:bg-[#F8FAFC]"
                            >
                              {expanded ? "Hide" : "View"}
                              <ChevronDown size={14} className={`transition-transform ${expanded ? "rotate-180" : ""}`} />
                            </button>
                          </td>
                        </tr>
                        {expanded ? (
                          <tr key={`${item.id}-expanded`} className="border-t border-[#F1F5F9] bg-[#FBFCFE]">
                            <td colSpan={6} className="px-5 py-4">
                              <div className="grid gap-4 rounded-[20px] border border-[#E2E8F0] bg-white p-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(260px,0.9fr)]">
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#64748B]">Full description</p>
                                  <p className="mt-2 text-sm leading-6 text-[#334155]">{item.details}</p>
                                </div>
                                <div className="rounded-[18px] bg-[#F8FAFC] p-4">
                                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#64748B]">Event metadata</p>
                                  <dl className="mt-3 space-y-2 text-sm">
                                    <div className="flex justify-between gap-3">
                                      <dt className="text-[#64748B]">Module</dt>
                                      <dd className="font-semibold text-[#111827]">{item.module}</dd>
                                    </div>
                                    <div className="flex justify-between gap-3">
                                      <dt className="text-[#64748B]">Type</dt>
                                      <dd className="font-semibold text-[#111827]">{item.eventType}</dd>
                                    </div>
                                    <div className="flex justify-between gap-3">
                                      <dt className="text-[#64748B]">Event ID</dt>
                                      <dd className="font-mono text-xs text-[#111827]">{item.id}</dd>
                                    </div>
                                    <div className="flex justify-between gap-3">
                                      <dt className="text-[#64748B]">ACR link</dt>
                                      <dd className="font-semibold text-[#111827]">{item.acrNo ?? "Not linked"}</dd>
                                    </div>
                                  </dl>
                                </div>
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E6EBF2] bg-white px-5 py-4">
          <div className="text-sm text-[#64748B]">
            Showing <span className="font-semibold text-[#111827]">{items.length}</span> of{" "}
            <span className="font-semibold text-[#111827]">{data?.total ?? 0}</span> events
            {isFetching && !isLoading ? <span className="ml-2 text-[#0095D9]">Refreshing…</span> : null}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={(data?.page ?? 1) <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="inline-flex items-center gap-1 rounded-full border border-[#D8DEE8] bg-white px-3 py-2 text-sm font-semibold text-[#334155] transition hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronLeft size={14} />
              Previous
            </button>
            <span className="rounded-full bg-[#F8FAFC] px-3.5 py-2 text-sm font-semibold text-[#111827]">
              Page {data?.page ?? 1} of {data?.totalPages ?? 1}
            </span>
            <button
              type="button"
              disabled={(data?.page ?? 1) >= (data?.totalPages ?? 1)}
              onClick={() => setPage((current) => current + 1)}
              className="inline-flex items-center gap-1 rounded-full border border-[#D8DEE8] bg-white px-3 py-2 text-sm font-semibold text-[#334155] transition hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
