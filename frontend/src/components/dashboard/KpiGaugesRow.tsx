"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { KpiGauge } from "./charts";
import type { DashboardDistributionItem, DashboardKpi } from "@/types/contracts";
import { DT } from "@/styles/dashboard-tokens";

interface KpiGaugesRowProps {
  kpis: DashboardKpi[];
  mode?: "executive" | "secret-branch";
  distributions?: {
    status?: DashboardDistributionItem[];
  };
}

interface GaugeConfig {
  key: string;
  label: string;
  sublabel: string;
  target: number;
  maxDays?: number;
  invertDisplay?: boolean;
  fromCount?: boolean; // value is a raw count — derive % from total
}

const GAUGE_KEYS: GaugeConfig[] = [
  { key: "completionRate", label: "Completion Rate", sublabel: "Target: 80%", target: 80 },
  { key: "onTimeRate",     label: "On-Time Rate",    sublabel: "Target: 75%", target: 75 },
  { key: "turnaround",     label: "Avg Turnaround",  sublabel: "Inverted score (60d max)", target: 70, maxDays: 60 },
  { key: "returnRate",     label: "Return Rate",     sublabel: "Lower is better", target: 15, invertDisplay: true, fromCount: true },
  { key: "pendingDA",      label: "Pending DA",      sublabel: "Lower is better", target: 5,  invertDisplay: true, fromCount: true },
];

// Status label → chart color mapping for mini bar
const STATUS_COLOR_MAP: Record<string, string> = {
  completed:    DT.teal[500],
  archived:     DT.teal[600],
  pending:      DT.sapphire[400],
  overdue:      DT.crimson[500],
  returned:     DT.amber[500],
  draft:        DT.slate[300],
  "in review":  DT.violet[400],
  "pending ro": "#F97316",
  "pending cso":"#3B82F6",
};

function pickStatusColor(label: string, idx: number): string {
  const lower = label.toLowerCase();
  for (const [keyword, color] of Object.entries(STATUS_COLOR_MAP)) {
    if (lower.includes(keyword)) return color;
  }
  const fallbacks = [
    DT.sapphire[500], DT.teal[500], DT.amber[500],
    DT.crimson[500],  DT.violet[500], "#0EA5E9", "#10B981",
  ];
  return fallbacks[idx % fallbacks.length];
}

function rawNum(kpi: DashboardKpi | undefined): number {
  if (!kpi) return 0;
  return typeof kpi.value === "number"
    ? kpi.value
    : parseFloat(String(kpi.value)) || 0;
}

function buildEnrichedMap(kpis: DashboardKpi[]): Map<string, DashboardKpi> {
  const map = new Map(kpis.map((k) => [k.key, k]));

  // ── Cross-mode aliases ────────────────────────────────────────────────
  // Executive sends "turnaround"; Secret Branch sends "avgTurnaround".
  // Normalise both to "turnaround" so gauge keys work for both modes.
  if (!map.has("turnaround") && map.has("avgTurnaround")) {
    map.set("turnaround", map.get("avgTurnaround")!);
  }

  // ── Derive completionRate ─────────────────────────────────────────────
  // Executive has it directly. Secret Branch derives from archived/total.
  if (!map.has("completionRate")) {
    const done  = map.get("completed") ?? map.get("archived");
    const total = map.get("total");
    if (done && total) {
      const d = rawNum(done);
      const t = rawNum(total);
      const rate = t > 0 ? Math.round((d / t) * 100) : 0;
      map.set("completionRate", {
        key: "completionRate", label: "Archive Rate",
        value: `${rate}%`, helper: `${d} of ${t} archived`, tone: "green",
      });
    }
  }

  // ── Derive onTimeRate  ────────────────────────────────────────────────
  // = (total - overdue) / total  — non-overdue rate, distinct from completionRate
  if (!map.has("onTimeRate")) {
    const overdue = map.get("overdue") ?? map.get("anomalies");
    const total   = map.get("total");
    if (overdue && total) {
      const o = rawNum(overdue);
      const t = rawNum(total);
      const rate = t > 0 ? Math.round(((t - o) / t) * 100) : 100;
      map.set("onTimeRate", {
        key: "onTimeRate", label: "On-Time Rate",
        value: `${rate}%`, helper: `${o} overdue of ${t}`, tone: "cyan",
      });
    }
  }

  // ── Derive returnRate ─────────────────────────────────────────────────
  // Executive: "returned" count.  Secret Branch: "anomalies" count.
  if (!map.has("returnRate")) {
    const src = map.get("returned") ?? map.get("anomalies");
    if (src) {
      map.set("returnRate", {
        key: "returnRate", label: "Return / Anomaly Rate",
        value: rawNum(src), helper: "records flagged", tone: "amber",
      });
    }
  }

  return map;
}

function toPercent(key: string, kpiMap: Map<string, DashboardKpi>, cfg: GaugeConfig): number {
  const kpi = kpiMap.get(key);
  if (!kpi) return 0;
  let raw = rawNum(kpi);

  if (cfg.maxDays) {
    return Math.max(0, Math.min(100, Math.round((1 - raw / cfg.maxDays) * 100)));
  }
  if (cfg.fromCount) {
    // Convert count → rate → invert
    const total = rawNum(kpiMap.get("total"));
    raw = total > 0 ? Math.round((raw / total) * 100) : 0;
    return Math.max(0, Math.min(100, 100 - raw));
  }
  if (cfg.invertDisplay) {
    return Math.max(0, Math.min(100, 100 - raw));
  }
  return Math.max(0, Math.min(100, Math.round(raw)));
}

// ── Metric chip colours ──────────────────────────────────────────────────
const CHIP_PRESETS: Record<string, { bg: string; text: string; dot: string }> = {
  overdue:       { bg: "#FFF1F2", text: "#BE123C", dot: DT.crimson[500]  },
  priority:      { bg: "#FFF7ED", text: "#C2410C", dot: "#F97316"         },
  returned:      { bg: "#FFFBEB", text: "#B45309", dot: DT.amber[500]     },
  pending:       { bg: "#EFF6FF", text: "#1D4ED8", dot: "#3B82F6"         },
  archive:       { bg: "#F0FDFA", text: "#0D9488", dot: DT.teal[500]      },
  total:         { bg: "#EEF2FF", text: "#4338CA", dot: DT.sapphire[500]  },
  archived:      { bg: "#F0FDFA", text: "#0F766E", dot: DT.teal[600]      },
  discrepancies: { bg: "#FFF1F2", text: "#9F1239", dot: DT.crimson[600]   },
  pendingDA:     { bg: "#FFFBEB", text: "#92400E", dot: DT.amber[600]     },
};

export function KpiGaugesRow({ kpis, mode = "executive", distributions }: KpiGaugesRowProps) {
  const kpiMap = useMemo(() => buildEnrichedMap(kpis), [kpis]);
  const isSB = mode === "secret-branch";

  // In SB mode rename gauge labels to better reflect context
  const gauges = GAUGE_KEYS
    .filter((g) => kpiMap.has(g.key))
    .map((g) => {
      if (!isSB) return g;
      if (g.key === "completionRate") return { ...g, label: "Archive Rate",    sublabel: "Target: 80%" };
      if (g.key === "returnRate")     return { ...g, label: "Discrepancy Rate", sublabel: "Lower is better" };
      return g;
    });

  const chips = useMemo(() => {
    const items: Array<{ label: string; value: number | string; preset: keyof typeof CHIP_PRESETS }> = [];

    if (isSB) {
      // Secret Branch chips
      const archivedKpi   = kpiMap.get("archived");
      const anomaliesKpi  = kpiMap.get("anomalies");
      const pendingDAKpi  = kpiMap.get("pendingDA");
      const total         = kpiMap.get("total");

      if (archivedKpi)  items.push({ label: "Archived",      value: rawNum(archivedKpi),  preset: "archived"      });
      if (anomaliesKpi) items.push({ label: "Discrepancies", value: rawNum(anomaliesKpi), preset: "discrepancies" });
      if (pendingDAKpi) items.push({ label: "Pending DA",    value: rawNum(pendingDAKpi), preset: "pendingDA"     });
      if (total && archivedKpi) {
        const arch = rawNum(archivedKpi);
        const tot  = rawNum(total);
        const rate = tot > 0 ? `${Math.round((arch / tot) * 100)}%` : "—";
        items.push({ label: "Archive Rate", value: rate, preset: "archive" });
      }
    } else {
      // Executive chips
      const overdue   = kpiMap.get("overdue");
      const priority  = kpiMap.get("priority");
      const returned  = kpiMap.get("returned");
      const total     = kpiMap.get("total");
      const completed = kpiMap.get("completed");

      if (overdue)  items.push({ label: "Overdue",  value: rawNum(overdue),  preset: "overdue"  });
      if (priority) items.push({ label: "Priority", value: rawNum(priority), preset: "priority" });
      if (returned) items.push({ label: "Returned", value: rawNum(returned), preset: "returned" });
      if (total && completed) {
        const arch = rawNum(completed);
        const tot  = rawNum(total);
        const rate = tot > 0 ? `${Math.round((arch / tot) * 100)}%` : "—";
        items.push({ label: "Archive Rate", value: rate, preset: "archive" });
      }
    }
    return items;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kpiMap, isSB]);

  const statusItems = (distributions?.status ?? []).filter((s) => s.value > 0);

  const [activeGauge, setActiveGauge] = useState<string | null>(null);
  const router = useRouter();

  // Click destinations for each gauge key
  const gaugeLinks: Record<string, string> = {
    completionRate: "/queue",
    onTimeRate:     "/queue?overdue=true",
    turnaround:     "/queue",
    returnRate:     "/queue",
    pendingDA:      "/queue",
  };

  if (gauges.length === 0 && chips.length === 0) return null;

  return (
    <div className="rounded-2xl border border-[var(--fia-gray-200)] bg-[var(--card)] p-5 shadow-sm">
      <h3 className="mb-5 text-sm font-bold text-[var(--fia-gray-900)]">Performance Overview</h3>

      {/* ── Gauge dials — responsive auto-fit row ───────────────────────── */}
      {gauges.length > 0 && (
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))" }}
        >
            {gauges.map((g) => {
              const rawKpi = kpiMap.get(g.key);
              const rawVal = rawKpi
                ? (typeof rawKpi.value === "string" ? rawKpi.value : String(rawKpi.value))
                : "—";
              const helper = rawKpi?.helper ?? g.sublabel;
              const isHovered = activeGauge === g.key;
              const hasLink = !!gaugeLinks[g.key];

              return (
                <div
                  key={g.key}
                  className="relative flex flex-col items-center rounded-xl bg-[var(--fia-gray-50)] py-3 px-2 transition-all duration-150"
                  style={{
                    cursor: hasLink ? "pointer" : "default",
                    boxShadow: isHovered ? "0 4px 14px rgba(0,0,0,0.10)" : "none",
                    background: isHovered ? "white" : "var(--fia-gray-50, #F8FAFC)",
                    transform: isHovered ? "translateY(-2px)" : "none",
                    border: isHovered ? "1px solid var(--fia-gray-200)" : "1px solid transparent",
                  }}
                  onMouseEnter={() => setActiveGauge(g.key)}
                  onMouseLeave={() => setActiveGauge(null)}
                  onClick={() => hasLink && router.push(gaugeLinks[g.key])}
                >
                  <KpiGauge
                    value={toPercent(g.key, kpiMap, g)}
                    target={g.target}
                    label={g.label}
                    sublabel={g.sublabel}
                    size={128}
                  />

                  {/* Hover tooltip */}
                  {isHovered && (
                    <div
                      className="absolute bottom-full left-1/2 z-20 mb-2 rounded-xl px-3 py-2 text-center shadow-xl"
                      style={{
                        transform: "translateX(-50%)",
                        background: "#0F172A",
                        minWidth: 140,
                        pointerEvents: "none",
                      }}
                    >
                      <p className="text-sm font-bold text-white">{rawVal}</p>
                      <p className="mt-0.5 text-[10px] text-slate-400">{helper}</p>
                      {hasLink && (
                        <p className="mt-1 text-[9px] font-semibold uppercase tracking-wide text-slate-500">
                          Click to view queue →
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}

      {/* ── Metric chips ────────────────────────────────────────────────── */}
      {chips.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--fia-gray-100)] pt-4">
          {chips.map((chip) => {
            const c = CHIP_PRESETS[chip.preset];
            return (
              <div
                key={chip.label}
                className="flex items-center gap-2 rounded-full border px-3 py-1.5"
                style={{ background: c.bg, borderColor: c.dot + "44" }}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: c.dot }} />
                <span className="text-[11px] font-medium" style={{ color: c.text }}>{chip.label}</span>
                <span className="text-sm font-bold" style={{ color: c.text }}>{chip.value}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Status distribution mini bar ────────────────────────────────── */}
      {statusItems.length > 0 && (
        <div className="mt-4 border-t border-[var(--fia-gray-100)] pt-4">
          <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--fia-gray-400)]">
            Status Breakdown
          </p>
          <MiniStatusBar items={statusItems} />
        </div>
      )}
    </div>
  );
}

function MiniStatusBar({ items }: { items: DashboardDistributionItem[] }) {
  const total = Math.max(1, items.reduce((s, i) => s + i.value, 0));
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
      {items.map((item, idx) => {
        const color = pickStatusColor(item.label, idx);
        const pct = Math.round((item.value / total) * 100);
        return (
          <span
            key={item.key ?? item.label}
            className="inline-flex items-center gap-1.5 text-[11px] text-[var(--fia-gray-600)]"
          >
            <span className="h-2 w-2 rounded-full" style={{ background: color }} />
            {item.label}
            <span className="ml-0.5 font-bold text-[var(--fia-gray-800)]">{item.value}</span>
            <span className="text-[var(--fia-gray-400)]">({pct}%)</span>
          </span>
        );
      })}
    </div>
  );
}
