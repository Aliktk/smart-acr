"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDeferredValue, useEffect, useMemo, useState, useTransition } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Archive,
  ArrowRight,
  BarChart3,
  ClipboardCheck,
  Clock3,
  FileArchive,
  Filter,
  Gauge,
  ChevronDown,
  Landmark,
  Layers3,
  RefreshCw,
  ShieldAlert,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { getDashboardAnalytics, getDashboardHeatmap } from "@/api/client";
import { PortalPageHeader, PortalSurface, EmptyState, SegmentedTabs } from "@/components/portal/PortalPrimitives";
import { DashboardSkeleton, LiveIndicator, OverdueBadge, PriorityBadge, StatCard, StatusChip } from "@/components/ui";
import { InsightsPanel } from "./InsightsPanel";
import { KpiGaugesRow } from "./KpiGaugesRow";
import { WorkflowPipeline } from "./WorkflowPipeline";
import {
  ArchiveWaterfall,
  EChartsAreaTrend,
  EChartsDonut,
  EChartsHorizontalBar,
  EChartsStackedBar,
  FIAOperationsMap,
  HeatmapTable,
  OfficerWorkloadBubble,
  TurnaroundLollipop,
  UnitPerformanceRadar,
} from "./charts";
import type {
  AcrSummary,
  DashboardAnalyticsResponse,
  DashboardDatePreset,
  DashboardDistributionItem,
  DashboardHeatmap,
  DashboardKpi,
  DashboardPerformanceEntry,
  DashboardTone,
  DashboardTrendCard,
  DashboardTrendPoint,
  OrgScopeTrack,
  UserSession,
} from "@/types/contracts";
import { getCurrentOwnerLabel, getCurrentStageLabel } from "@/utils/acr";

type LeadershipDashboardProps = {
  session: UserSession;
};

type DashboardFilterState = {
  datePreset: DashboardDatePreset;
  scopeTrack: OrgScopeTrack | "";
  wingId: string;
  regionId: string;
  zoneId: string;
  officeId: string;
  status: string;
  templateFamily: string;
};

type ToneKey = DashboardTone | "purple";

const toneToColor: Record<ToneKey, string> = {
  navy: "var(--fia-navy)",
  cyan: "var(--fia-cyan)",
  green: "var(--fia-success)",
  amber: "var(--fia-warning)",
  red: "var(--fia-danger)",
  slate: "var(--fia-gray-600)",
  purple: "#7C3AED",
};

const donutPalette: ToneKey[] = ["navy", "cyan", "green", "amber", "red", "purple", "slate"];

const kpiIcons: Record<string, typeof BarChart3> = {
  total: BarChart3,
  completed: Archive,
  pending: ClipboardCheck,
  overdue: Clock3,
  returned: AlertTriangle,
  priority: ShieldAlert,
  turnaround: Gauge,
  completionRate: Landmark,
  archived: FileArchive,
  today: Archive,
  week: Layers3,
  month: Layers3,
  anomalies: AlertTriangle,
  downloads: BarChart3,
  avgTurnaround: Gauge,
};

function formatNumber(value: string | number) {
  if (typeof value === "string") {
    return value;
  }

  return new Intl.NumberFormat("en-PK").format(value);
}

function buildInitialFilters(_session: UserSession): DashboardFilterState {
  return {
    datePreset: "all",
    scopeTrack: "",
    wingId: "",
    regionId: "",
    zoneId: "",
    officeId: "",
    status: "",
    templateFamily: "",
  };
}

function metricTone(key: string): ToneKey {
  switch (key) {
    case "completed":
    case "completionRate":
    case "archived":
      return "green";
    case "pending":
    case "week":
    case "month":
      return "cyan";
    case "overdue":
    case "anomalies":
      return "red";
    case "returned":
    case "priority":
    case "downloads":
      return "amber";
    case "turnaround":
    case "avgTurnaround":
      return "slate";
    default:
      return "navy";
  }
}

function chartLegendColor(color: DashboardTone | string) {
  if (color in toneToColor) {
    return toneToColor[color as ToneKey];
  }

  return color;
}

function InlineFilter({
  value, options, onChange, allLabel = "All", icon,
}: {
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  allLabel?: string;
  icon?: React.ReactNode;
}) {
  const isActive = Boolean(value);

  return (
    <div className="relative shrink-0">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`appearance-none cursor-pointer whitespace-nowrap rounded-full border py-1.5 text-xs font-semibold outline-none transition-all duration-150 ${
          icon ? "pl-6 pr-7" : "pl-3 pr-7"
        } ${
          isActive
            ? "border-[#1A1C6E] bg-[#1A1C6E] text-white shadow-sm"
            : "border-[var(--fia-gray-200)] bg-[var(--fia-gray-50)] text-[var(--fia-gray-600)] hover:border-[var(--fia-gray-300)] hover:bg-[var(--card)] hover:text-[var(--fia-gray-800)] hover:shadow-sm"
        }`}
      >
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
      {icon && (
        <span className={`pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 ${isActive ? "text-white/80" : "text-[var(--fia-gray-400)]"}`}>
          {icon}
        </span>
      )}
      <ChevronDown
        size={10}
        className={`pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 ${isActive ? "text-white/70" : "text-[var(--fia-gray-400)]"}`}
      />
    </div>
  );
}

function ActiveChip({ label, value, onClear }: { label: string; value: string; onClear: () => void }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#1A1C6E] pl-2.5 pr-1.5 py-1 text-[10px] font-semibold text-white shadow-sm">
      <span className="opacity-60">{label}:</span>
      <span className="max-w-[110px] truncate">{value}</span>
      <button
        type="button"
        onClick={onClear}
        className="ml-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white/15 transition hover:bg-white/30"
        aria-label={`Clear ${label}`}
      >
        <X size={8} />
      </button>
    </span>
  );
}

function LeadershipFilters({
  filters,
  analytics,
  onChange,
  onReset,
  pending,
}: {
  filters: DashboardFilterState;
  analytics: DashboardAnalyticsResponse;
  onChange: (key: keyof DashboardFilterState, value: string) => void;
  onReset: () => void;
  pending: boolean;
}) {
  const zones = useMemo(() => {
    return filters.regionId
      ? analytics.filterOptions.zones.filter((zone) => zone.regionId === filters.regionId)
      : analytics.filterOptions.zones;
  }, [analytics.filterOptions.zones, filters.regionId]);

  const offices = useMemo(() => {
    return analytics.filterOptions.offices.filter((office) => {
      if (filters.scopeTrack && office.scopeTrack !== filters.scopeTrack) return false;
      if (filters.zoneId) return office.zoneId === filters.zoneId;
      if (filters.regionId) return office.regionId === filters.regionId;
      if (filters.wingId) return office.wingId === filters.wingId;
      return true;
    });
  }, [analytics.filterOptions.offices, filters.regionId, filters.scopeTrack, filters.wingId, filters.zoneId]);

  const activeFilters: Array<{ key: keyof DashboardFilterState; label: string; value: string }> = [];
  if (filters.scopeTrack) activeFilters.push({ key: "scopeTrack", label: "Track", value: analytics.filterOptions.scopeTracks.find((o) => o.value === filters.scopeTrack)?.label ?? filters.scopeTrack });
  if (filters.wingId) activeFilters.push({ key: "wingId", label: "Wing", value: analytics.filterOptions.wings.find((o) => o.id === filters.wingId)?.label ?? "Selected" });
  if (filters.regionId) activeFilters.push({ key: "regionId", label: "Region", value: analytics.filterOptions.regions.find((o) => o.id === filters.regionId)?.label ?? "Selected" });
  if (filters.zoneId) activeFilters.push({ key: "zoneId", label: "Zone", value: zones.find((o) => o.id === filters.zoneId)?.label ?? "Selected" });
  if (filters.officeId) activeFilters.push({ key: "officeId", label: "Office", value: offices.find((o) => o.id === filters.officeId)?.label ?? "Selected" });
  if (filters.status) activeFilters.push({ key: "status", label: "Status", value: analytics.filterOptions.statuses.find((o) => o.value === filters.status)?.label ?? filters.status });
  if (filters.templateFamily) activeFilters.push({ key: "templateFamily", label: "Template", value: analytics.filterOptions.templateFamilies.find((o) => o.value === filters.templateFamily)?.label ?? filters.templateFamily });

  const hasActive = activeFilters.length > 0;

  return (
    <div className={`rounded-2xl border bg-[var(--card)] shadow-sm transition-all ${hasActive ? "border-[#1A1C6E]/25" : "border-[var(--fia-gray-200)]"}`}>
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 px-3.5 py-2.5">
        {/* Label */}
        <div className="flex shrink-0 items-center gap-1.5 mr-1">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[var(--fia-gray-100)]">
            <SlidersHorizontal size={11} className="text-[var(--fia-gray-500)]" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--fia-gray-400)]">Filter</span>
        </div>

        {/* Divider */}
        <div className="h-4 w-px bg-[var(--fia-gray-200)] shrink-0" />

        <InlineFilter
          value={filters.datePreset === "all" ? "" : filters.datePreset}
          options={analytics.filterOptions.datePresets.filter((o) => o.value !== "all").map((o) => ({ value: o.value, label: o.label }))}
          onChange={(value) => onChange("datePreset", value || "all")}
          allLabel="All time"
          icon={<Clock3 size={10} />}
        />
        <InlineFilter
          value={filters.scopeTrack}
          options={analytics.filterOptions.scopeTracks.map((o) => ({ value: o.value, label: o.label }))}
          onChange={(value) => onChange("scopeTrack", value)}
          allLabel="Track"
          icon={<Layers3 size={10} />}
        />
        <InlineFilter
          value={filters.wingId}
          options={analytics.filterOptions.wings.map((o) => ({ value: o.id, label: o.label }))}
          onChange={(value) => onChange("wingId", value)}
          allLabel="Wing"
          icon={<Landmark size={10} />}
        />
        <InlineFilter
          value={filters.regionId}
          options={analytics.filterOptions.regions.map((o) => ({ value: o.id, label: o.label }))}
          onChange={(value) => onChange("regionId", value)}
          allLabel="Region"
          icon={<Filter size={10} />}
        />
        <InlineFilter
          value={filters.zoneId}
          options={zones.map((o) => ({ value: o.id, label: o.label }))}
          onChange={(value) => onChange("zoneId", value)}
          allLabel="Zone"
        />
        <InlineFilter
          value={filters.officeId}
          options={offices.map((o) => ({ value: o.id, label: o.label }))}
          onChange={(value) => onChange("officeId", value)}
          allLabel="Office"
        />
        <InlineFilter
          value={filters.status}
          options={analytics.filterOptions.statuses.map((o) => ({ value: o.value, label: o.label }))}
          onChange={(value) => onChange("status", value)}
          allLabel="Status"
          icon={<BarChart3 size={10} />}
        />
        <InlineFilter
          value={filters.templateFamily}
          options={analytics.filterOptions.templateFamilies.map((o) => ({ value: o.value, label: o.label }))}
          onChange={(value) => onChange("templateFamily", value)}
          allLabel="Form"
          icon={<ClipboardCheck size={10} />}
        />

        {hasActive ? (
          <button
            type="button"
            onClick={onReset}
            className="ml-auto shrink-0 inline-flex items-center gap-1.5 rounded-full border border-[var(--fia-gray-200)] bg-[var(--fia-gray-50)] px-2.5 py-1 text-[10px] font-semibold text-[var(--fia-gray-500)] transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
          >
            <RefreshCw size={9} className={pending ? "animate-spin" : ""} />
            Reset
          </button>
        ) : null}
      </div>

      {/* Active chips row — only when filters are applied */}
      {hasActive ? (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-[#1A1C6E]/10 bg-[#1A1C6E]/[0.03] px-3.5 py-2">
          <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#1A1C6E]/50 mr-1">Active:</span>
          {activeFilters.map((chip) => (
            <ActiveChip key={chip.key} label={chip.label} value={chip.value} onClear={() => onChange(chip.key, "")} />
          ))}
          <span className="ml-auto shrink-0 text-[10px] text-[var(--fia-gray-400)]">
            {analytics.appliedFilters.dateLabel}
          </span>
        </div>
      ) : null}
    </div>
  );
}

const kpiQueueLinks: Record<string, string> = {
  overdue:  "/queue?overdue=true",
  priority: "/queue?priority=true",
  pending:  "/queue",
};

function LeadershipKpiGrid({ kpis, trendCard }: { kpis: DashboardKpi[]; trendCard?: DashboardTrendCard }) {
  const router = useRouter();
  // Map KPI keys → trend series keys so every card gets a sparkline
  const sparklineKeyMap: Record<string, string> = {
    total:          "initiated",
    completed:      "completed",
    pending:        "pending",
    overdue:        "overdue",
    archived:       "cumulativeArchived",
    returned:       "pending",    // proxy — closest signal
    priority:       "overdue",    // proxy — exception signal
    completionRate: "completed",
    turnaround:     "completed",
    avgTurnaround:  "archived",
    today:          "archived",
    week:           "archived",
    month:          "archived",
    anomalies:      "overdue",
    downloads:      "archived",
  };

  function sparklineFor(key: string): number[] | undefined {
    if (!trendCard || trendCard.points.length < 2) return undefined;
    const resolvedKey = sparklineKeyMap[key] ?? key;
    const seriesKey = trendCard.series.find((s) => s.key === resolvedKey)?.key;
    if (!seriesKey) return undefined;
    return trendCard.points.map((p) => Number((p as unknown as Record<string, unknown>)[seriesKey] ?? 0));
  }

  return (
    <div className="overflow-x-auto pb-1">
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: `repeat(${kpis.length}, minmax(140px, 1fr))` }}
      >
        {kpis.map((kpi) => {
          const Icon = kpiIcons[kpi.key] ?? BarChart3;
          return (
            <StatCard
              key={kpi.key}
              title={kpi.label}
              value={formatNumber(kpi.value)}
              subtitle={kpi.helper}
              icon={<Icon size={13} />}
              accent={metricTone(kpi.key)}
              sparkline={sparklineFor(kpi.key)}
              size="compact"
              onClick={kpiQueueLinks[kpi.key] ? () => router.push(kpiQueueLinks[kpi.key]) : undefined}
            />
          );
        })}
      </div>
    </div>
  );
}

function TrendExplorer({ card }: { card: DashboardTrendCard }) {
  const [visibleKeys, setVisibleKeys] = useState<string[]>(card.defaultSeries);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(card.points.length ? card.points.length - 1 : null);

  useEffect(() => {
    setVisibleKeys(card.defaultSeries);
    setHoveredIndex(card.points.length ? card.points.length - 1 : null);
  }, [card.defaultSeries, card.points.length]);

  const activeSeries = card.series.filter((series) => visibleKeys.includes(series.key));
  const maxValue = Math.max(1, ...card.points.flatMap((point) => activeSeries.map((series) => Number(point[series.key as keyof DashboardTrendPoint] ?? 0))));
  const chartWidth = 720;
  const chartHeight = 240;
  const paddingX = 34;
  const paddingTop = 18;
  const paddingBottom = 30;
  const paddingRight = 16;
  const innerWidth = chartWidth - paddingX - paddingRight;
  const innerHeight = chartHeight - paddingTop - paddingBottom;
  const step = card.points.length > 1 ? innerWidth / (card.points.length - 1) : innerWidth;
  const labelStep = card.points.length > 12 ? Math.ceil(card.points.length / 8) : 1;
  const hoveredPoint = hoveredIndex !== null ? card.points[hoveredIndex] : null;

  function toggleSeries(key: string) {
    setVisibleKeys((current) => {
      if (current.includes(key)) {
        return current.length === 1 ? current : current.filter((item) => item !== key);
      }

      return [...current, key];
    });
  }

  function coordinatesFor(point: DashboardTrendPoint, valueKey: string, index: number) {
    const x = paddingX + step * index;
    const value = Number(point[valueKey as keyof DashboardTrendPoint] ?? 0);
    const y = paddingTop + innerHeight - (value / maxValue) * innerHeight;
    return { x, y, value };
  }

  function handleMove(event: React.MouseEvent<SVGSVGElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const relativeX = Math.min(Math.max(event.clientX - bounds.left - paddingX, 0), innerWidth);
    const nextIndex = card.points.length > 1 ? Math.round(relativeX / step) : 0;
    setHoveredIndex(nextIndex);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {card.series.map((series) => {
          const active = visibleKeys.includes(series.key);
          return (
            <button
              key={series.key}
              type="button"
              onClick={() => toggleSeries(series.key)}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                active
                  ? "border-transparent text-white"
                  : "border-[var(--fia-gray-200)] bg-[var(--card)] text-[var(--fia-gray-700)]"
              }`}
              style={active ? { background: chartLegendColor(series.color) } : undefined}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: chartLegendColor(series.color) }} />
              {series.label}
            </button>
          );
        })}
      </div>

      <div className="rounded-[22px] border border-[var(--fia-gray-100)] bg-[var(--card)] dark:bg-[var(--card)] p-4">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="h-[260px] w-full"
          onMouseMove={handleMove}
          onMouseLeave={() => setHoveredIndex(card.points.length ? card.points.length - 1 : null)}
        >
          {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
            const y = paddingTop + innerHeight - innerHeight * fraction;
            const value = Math.round(maxValue * fraction);
            return (
              <g key={fraction}>
                <line x1={paddingX} y1={y} x2={chartWidth - paddingRight} y2={y} stroke="rgba(148,163,184,0.18)" strokeDasharray="3 6" />
                <text x={paddingX - 10} y={y + 4} textAnchor="end" className="fill-[var(--fia-gray-400)] text-[11px]">
                  {value}
                </text>
              </g>
            );
          })}

          {hoveredPoint && hoveredIndex !== null ? (
            <line
              x1={paddingX + step * hoveredIndex}
              y1={paddingTop}
              x2={paddingX + step * hoveredIndex}
              y2={paddingTop + innerHeight}
              stroke="rgba(26,28,110,0.18)"
              strokeDasharray="4 4"
            />
          ) : null}

          {activeSeries.map((series) => {
            const points = card.points.map((point, index) => coordinatesFor(point, series.key, index));
            const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
            return (
              <g key={series.key}>
                <path d={path} fill="none" stroke={chartLegendColor(series.color)} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                {points.map((point, index) => (
                  <circle
                    key={`${series.key}-${card.points[index]?.key ?? index}`}
                    cx={point.x}
                    cy={point.y}
                    r={hoveredIndex === index ? 4.8 : 3.4}
                    fill={chartLegendColor(series.color)}
                    opacity={hoveredIndex === index ? 1 : 0.86}
                  />
                ))}
              </g>
            );
          })}

          {card.points.map((point, index) => (
            index % labelStep === 0 || index === card.points.length - 1 ? (
              <text
                key={point.key}
                x={paddingX + step * index}
                y={chartHeight - 8}
                textAnchor="middle"
                className="fill-[var(--fia-gray-400)] text-[11px]"
              >
                {point.label}
              </text>
            ) : null
          ))}
        </svg>

        {hoveredPoint ? (
          <div className="mt-3 flex flex-wrap items-start justify-between gap-3 rounded-[18px] border border-[var(--fia-gray-100)] bg-[var(--card)] px-4 py-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--fia-gray-400)]">Selected point</p>
              <p className="mt-1 text-sm font-semibold text-[var(--fia-gray-900)]">{hoveredPoint.label}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              {activeSeries.map((series) => (
                <div key={series.key} className="min-w-[120px] rounded-[14px] bg-[var(--fia-gray-50)] px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: chartLegendColor(series.color) }} />
                    <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--fia-gray-400)]">{series.label}</span>
                  </div>
                  <p className="mt-1 text-lg font-semibold text-[var(--fia-gray-900)]">
                    {formatNumber(Number(hoveredPoint[series.key as keyof DashboardTrendPoint] ?? 0))}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function InteractiveDonut({
  items,
  activeValue,
  onSelect,
}: {
  items: DashboardDistributionItem[];
  activeValue?: string;
  onSelect?: (value?: string) => void;
}) {
  const total = Math.max(1, items.reduce((sum, item) => sum + item.value, 0));
  const radius = 62;
  const circumference = 2 * Math.PI * radius;
  let cursor = 0;

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="relative flex items-center justify-center">
        <svg viewBox="0 0 180 180" className="h-40 w-40 -rotate-90">
          <circle cx="90" cy="90" r={radius} fill="none" stroke="var(--fia-gray-100)" strokeWidth="18" />
          {items.map((item, index) => {
            const segment = (item.value / total) * circumference;
            const dasharray = `${segment} ${circumference - segment}`;
            const dashoffset = -cursor;
            cursor += segment;

            return (
              <circle
                key={item.key}
                cx="90"
                cy="90"
                r={radius}
                fill="none"
                stroke={toneToColor[donutPalette[index % donutPalette.length]]}
                strokeWidth={activeValue === item.filterValue ? 22 : 18}
                strokeDasharray={dasharray}
                strokeDashoffset={dashoffset}
                strokeLinecap="round"
              >
                <title>{`${item.label}: ${item.value}`}</title>
              </circle>
            );
          })}
        </svg>
        <div className="absolute flex h-20 w-20 flex-col items-center justify-center rounded-full bg-[var(--card)] shadow-[var(--shadow-md)]">
          <span className="text-[1.15rem] font-semibold text-[var(--fia-gray-950)]">{formatNumber(total)}</span>
          <span className="text-[11px] uppercase tracking-[0.16em] text-[var(--fia-gray-400)]">records</span>
        </div>
      </div>
      <div className="w-full space-y-2 lg:max-w-[270px]">
        {items.map((item, index) => {
          const selected = activeValue === item.filterValue;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onSelect?.(selected ? undefined : item.filterValue)}
              className={`flex w-full items-center justify-between rounded-[16px] border px-3 py-2.5 text-left transition ${
                selected
                  ? "border-transparent bg-[var(--fia-navy-50)]"
                  : "border-[var(--fia-gray-200)] bg-[var(--card)] hover:bg-[var(--fia-gray-50)]"
              }`}
            >
              <span className="flex items-center gap-2.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: toneToColor[donutPalette[index % donutPalette.length]] }} />
                <span className="text-sm text-[var(--fia-gray-700)]">{item.label}</span>
              </span>
              <span className="text-sm font-semibold text-[var(--fia-gray-900)]">{formatNumber(item.value)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ComparisonBars({
  entries,
  metrics,
  selectedId,
  onSelect,
  valueFormatter,
}: {
  entries: DashboardPerformanceEntry[];
  metrics: Array<{ key: keyof DashboardPerformanceEntry; label: string; color: ToneKey }>;
  selectedId?: string;
  onSelect?: (id?: string) => void;
  valueFormatter?: (entry: DashboardPerformanceEntry) => string;
}) {
  const maxValue = Math.max(
    1,
    ...entries.map((entry) => metrics.reduce((sum, metric) => sum + Number(entry[metric.key] ?? 0), 0)),
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {metrics.map((metric) => (
          <span key={String(metric.key)} className="inline-flex items-center gap-2 rounded-full bg-[var(--fia-gray-50)] px-3 py-1.5 text-xs font-semibold text-[var(--fia-gray-700)]">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: toneToColor[metric.color] }} />
            {metric.label}
          </span>
        ))}
      </div>

      {entries.length === 0 ? (
        <EmptyState title="No comparison data" description="No records match the current filter combination for this comparison view." />
      ) : (
        entries.map((entry) => {
          const total = metrics.reduce((sum, metric) => sum + Number(entry[metric.key] ?? 0), 0);
          const active = selectedId === entry.id;

          return (
            <div key={entry.id} className={`rounded-[18px] border px-4 py-3 transition ${active ? "border-transparent bg-[var(--fia-navy-50)]" : "border-[var(--fia-gray-200)] bg-[var(--card)]"}`}>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => onSelect?.(active ? undefined : entry.id)}
                  className="text-left"
                >
                  <p className="text-sm font-semibold text-[var(--fia-gray-900)]">{entry.label}</p>
                  <p className="mt-0.5 text-xs text-[var(--fia-gray-500)]">
                    {valueFormatter ? valueFormatter(entry) : `${formatNumber(total)} records`}
                  </p>
                </button>
                <div className="text-right">
                  <p className="text-lg font-semibold text-[var(--fia-gray-950)]">{formatNumber(total)}</p>
                  {typeof entry.completionRate === "number" ? (
                    <p className="text-xs text-[var(--fia-gray-500)]">{entry.completionRate}% completion</p>
                  ) : null}
                </div>
              </div>
              <div className="flex h-3 overflow-hidden rounded-full bg-[var(--fia-gray-100)]">
                {metrics.map((metric) => {
                  const metricValue = Number(entry[metric.key] ?? 0);
                  if (!metricValue) {
                    return null;
                  }
                  return (
                    <div
                      key={String(metric.key)}
                      className="h-full"
                      style={{
                        width: `${Math.max(6, (metricValue / maxValue) * 100)}%`,
                        background: toneToColor[metric.color],
                      }}
                      title={`${metric.label}: ${metricValue}`}
                    />
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

function MetricList({
  entries,
  emptyTitle,
  emptyDescription,
  formatter,
  selectedId,
  onSelect,
}: {
  entries: Array<{ id?: string; label: string; value: number; meta?: string }>;
  emptyTitle: string;
  emptyDescription: string;
  formatter?: (value: number) => string;
  selectedId?: string;
  onSelect?: (id?: string) => void;
}) {
  const maxValue = Math.max(1, ...entries.map((entry) => entry.value));

  if (!entries.length) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="space-y-3">
      {entries.map((entry) => {
        const active = Boolean(entry.id && selectedId === entry.id);
        return (
          <button
            key={`${entry.id ?? entry.label}`}
            type="button"
            onClick={() => entry.id ? onSelect?.(active ? undefined : entry.id) : undefined}
            className={`block w-full rounded-[18px] border px-4 py-3 text-left transition ${
              active
                ? "border-transparent bg-[var(--fia-navy-50)]"
                : "border-[var(--fia-gray-200)] bg-[var(--card)] hover:bg-[var(--fia-gray-50)]"
            }`}
          >
            <div className="mb-2 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[var(--fia-gray-900)]">{entry.label}</p>
                {entry.meta ? <p className="mt-0.5 text-xs text-[var(--fia-gray-500)]">{entry.meta}</p> : null}
              </div>
              <p className="text-lg font-semibold text-[var(--fia-gray-950)]">{formatter ? formatter(entry.value) : formatNumber(entry.value)}</p>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-[var(--fia-gray-100)]">
              <div
                className="h-full rounded-full bg-[var(--fia-navy)]"
                style={{ width: `${Math.max(8, (entry.value / maxValue) * 100)}%` }}
              />
            </div>
          </button>
        );
      })}
    </div>
  );
}

function HeatmapMatrix({
  heatmap,
  selectedId,
  onSelect,
}: {
  heatmap: DashboardHeatmap;
  selectedId?: string;
  onSelect?: (id?: string) => void;
}) {
  const maxValue = Math.max(1, ...heatmap.rows.flatMap((row) => heatmap.columns.map((column) => row.values[column.key] ?? 0)));

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[680px]">
        <div className="grid grid-cols-[220px_repeat(6,minmax(88px,1fr))] gap-2">
          <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--fia-gray-400)]">Wing / Stage</div>
          {heatmap.columns.map((column) => (
            <div key={column.key} className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--fia-gray-400)]">
              {column.label}
            </div>
          ))}
        </div>
        <div className="mt-2 space-y-2">
          {heatmap.rows.map((row) => (
            <div key={row.id} className="grid grid-cols-[220px_repeat(6,minmax(88px,1fr))] gap-2">
              <button
                type="button"
                onClick={() => onSelect?.(selectedId === row.id ? undefined : row.id)}
                className={`rounded-[16px] border px-4 py-3 text-left transition ${
                  selectedId === row.id
                    ? "border-transparent bg-[var(--fia-navy-50)]"
                    : "border-[var(--fia-gray-200)] bg-[var(--card)] hover:bg-[var(--fia-gray-50)]"
                }`}
              >
                <p className="text-sm font-semibold text-[var(--fia-gray-900)]">{row.label}</p>
                <p className="mt-1 text-xs text-[var(--fia-gray-500)]">
                  {row.completionRate}% completion · {row.overdue} overdue
                </p>
              </button>
              {heatmap.columns.map((column) => {
                const value = row.values[column.key] ?? 0;
                const alpha = value ? 0.14 + (value / maxValue) * 0.58 : 0.06;
                return (
                  <div
                    key={`${row.id}-${column.key}`}
                    className="flex items-center justify-center rounded-[16px] border border-[var(--fia-gray-100)] text-sm font-semibold text-[var(--fia-gray-900)]"
                    style={{ background: `rgba(26, 28, 110, ${alpha})` }}
                    title={`${row.label} · ${column.label}: ${value}`}
                  >
                    {value}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function LeadershipFocusTable({
  title,
  subtitle,
  items,
  mode,
}: {
  title: string;
  subtitle: string;
  items: AcrSummary[];
  mode: DashboardAnalyticsResponse["mode"];
}) {
  // Sort: overdue first, then priority, then rest
  const sorted = [...items].sort((a, b) => {
    if (a.isOverdue && !b.isOverdue) return -1;
    if (!a.isOverdue && b.isOverdue) return 1;
    if (a.isPriority && !b.isPriority) return -1;
    if (!a.isPriority && b.isPriority) return 1;
    return (b.overdueDays ?? 0) - (a.overdueDays ?? 0);
  });

  if (!sorted.length) {
    return (
      <PortalSurface title={title} subtitle={subtitle}>
        <EmptyState title="No records to highlight" description="The current filter combination does not surface any high-priority records." />
      </PortalSurface>
    );
  }

  return (
    <PortalSurface title={title} subtitle={subtitle}>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="border-b border-[var(--fia-gray-100)] bg-[var(--fia-gray-50)] text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--fia-gray-400)]">
            <tr>
              <th className="px-3.5 py-3">ACR No</th>
              <th className="px-3.5 py-3">Employee</th>
              <th className="px-3.5 py-3">Stage</th>
              <th className="px-3.5 py-3">Status</th>
              <th className="px-3.5 py-3">Days Overdue</th>
              <th className="px-3.5 py-3">Owner</th>
              <th className="px-3.5 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((item) => (
              <tr key={item.id} className={`border-b border-[var(--fia-gray-100)] last:border-b-0 ${item.isOverdue ? "bg-[rgba(239,68,68,0.02)]" : ""}`}>
                <td className="px-3.5 py-3.5">
                  <Link href={`/acr/${item.id}`} className="font-semibold text-[var(--fia-navy)] hover:text-[var(--fia-cyan)]">
                    {item.acrNo}
                  </Link>
                  <p className="mt-1 text-xs text-[var(--fia-gray-400)]">{item.reportingPeriod}</p>
                </td>
                <td className="px-3.5 py-3.5">
                  <p className="font-semibold text-[var(--fia-gray-900)]">{item.employee.name}</p>
                  <p className="mt-1 text-xs text-[var(--fia-gray-500)]">
                    {item.employee.rank} · {item.employee.office}
                  </p>
                </td>
                <td className="px-3.5 py-3.5 text-[var(--fia-gray-700)]">{getCurrentStageLabel(item)}</td>
                <td className="px-3.5 py-3.5">
                  <div className="flex flex-wrap gap-1.5">
                    <StatusChip status={item.status} />
                    {item.isPriority ? <PriorityBadge priority /> : null}
                  </div>
                </td>
                <td className="px-3.5 py-3.5">
                  {item.isOverdue ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--fia-danger-bg,rgba(239,68,68,0.1))] px-2.5 py-0.5 text-xs font-bold text-[var(--fia-danger)]">
                      +{item.overdueDays ?? 0}d
                    </span>
                  ) : (
                    <span className="text-xs text-[var(--fia-gray-400)]">—</span>
                  )}
                </td>
                <td className="px-3.5 py-3.5 text-[var(--fia-gray-700)] text-xs">{getCurrentOwnerLabel(item)}</td>
                <td className="px-3.5 py-3.5 text-right">
                  <Link
                    href={`/acr/${item.id}`}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[var(--fia-cyan-100)] px-3.5 py-1.5 text-xs font-semibold text-[var(--fia-cyan)] transition-colors hover:bg-[#D7EFFB]"
                  >
                    {mode === "secret-branch" ? "Open file" : "View brief"}
                    <ArrowRight size={11} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PortalSurface>
  );
}

export function LeadershipDashboard({ session }: LeadershipDashboardProps) {
  const [isPending, startTransition] = useTransition();
  const [filters, setFilters] = useState<DashboardFilterState>(() => buildInitialFilters(session));
  const [mainTab, setMainTab] = useState<"overview" | "analytics" | "region" | "focus">("overview");
  const [trendView, setTrendView] = useState<"workload" | "archive">("workload");
  const [distributionView, setDistributionView] = useState<"status" | "template" | "exceptions">("status");
  const [comparisonView, setComparisonView] = useState<"wing" | "region" | "zone" | "offices">("wing");
  const deferredFilters = useDeferredValue(filters);

  useEffect(() => {
    setFilters(buildInitialFilters(session));
  }, [session]);

  const analyticsQuery = useQuery({
    queryKey: ["dashboard-analytics", session.activeRoleCode, deferredFilters],
    queryFn: () => getDashboardAnalytics({
      datePreset: deferredFilters.datePreset,
      scopeTrack: deferredFilters.scopeTrack || undefined,
      wingId: deferredFilters.wingId || undefined,
      regionId: deferredFilters.regionId || undefined,
      zoneId: deferredFilters.zoneId || undefined,
      officeId: deferredFilters.officeId || undefined,
      status: deferredFilters.status || undefined,
      templateFamily: deferredFilters.templateFamily || undefined,
    }),
    placeholderData: (previous) => previous,
  });

  const heatmapQuery = useQuery({
    queryKey: ["dashboard-heatmap"],
    queryFn: getDashboardHeatmap,
    staleTime: 5 * 60 * 1000,
  });

  const analytics = analyticsQuery.data;

  function updateFilter(key: keyof DashboardFilterState, value: string) {
    startTransition(() => {
      setFilters((current) => {
        if (key === "scopeTrack") {
          return { ...current, scopeTrack: value as OrgScopeTrack | "", wingId: "", regionId: "", zoneId: "", officeId: "" };
        }
        if (key === "wingId") {
          return { ...current, wingId: value, officeId: "" };
        }
        if (key === "regionId") {
          return { ...current, regionId: value, zoneId: "", officeId: "" };
        }
        if (key === "zoneId") {
          return { ...current, zoneId: value, officeId: "" };
        }
        return { ...current, [key]: value };
      });
    });
  }

  function resetFilters() {
    startTransition(() => {
      setFilters(buildInitialFilters(session));
    });
  }

  // ── Derived data for advanced charts — must be declared before early returns ─
  // Unit Performance Radar — top 4 wings mapped to 5 axes
  const radarSeries = useMemo(() => {
    const wings = (analytics?.performance.wing ?? []).filter((w) => w.total > 0).slice(0, 4);
    if (wings.length === 0) return [];
    const isSB = analytics?.mode === "secret-branch";
    const maxTotal = Math.max(1, ...wings.map((w) => w.total));
    return wings.map((w) => {
      const completedCount = isSB ? (w.archived ?? 0) : (w.completed ?? 0);
      const overdueCount   = isSB ? (w.anomalies ?? 0) : (w.overdue ?? 0);
      const completionPct  = w.total > 0 ? Math.round((completedCount / w.total) * 100) : 0;
      const lowOverduePct  = w.total > 0 ? Math.max(0, 100 - Math.round((overdueCount / w.total) * 100)) : 100;
      return {
        name: w.label,
        values: [
          completionPct,
          Math.max(0, 100 - Math.min(100, (w.avgTurnaroundDays ?? 0) * 2)),
          completionPct,
          lowOverduePct,
          Math.round((w.total / maxTotal) * 100),
        ],
      };
    });
  }, [analytics?.performance.wing, analytics?.mode]);

  // Archive Waterfall — monthly deltas from cumulative archive trend
  const waterfallData = useMemo(() => {
    const pts = analytics?.trends.archive.points ?? [];
    if (pts.length < 2) return [];
    return pts.map((p, i, arr) => ({
      label: p.label,
      value: p.cumulativeArchived - (i > 0 ? arr[i - 1].cumulativeArchived : 0),
      cumulative: p.cumulativeArchived,
    }));
  }, [analytics?.trends.archive.points]);

  // Officer Workload Bubble — aggregate focus items by holder
  const bubbleData = useMemo(() => {
    const now = new Date();
    const grouped = new Map<string, { name: string; role: string; queueDepth: number; daysSinceOldest: number; overdueCount: number }>();
    (analytics?.focus.items ?? []).forEach((item: AcrSummary) => {
      const holderKey = item.currentHolderName ?? item.currentHolderId ?? null;
      if (!holderKey) return;
      const existing = grouped.get(holderKey) ?? {
        name: holderKey,
        role: item.currentHolderRole ?? "UNKNOWN",
        queueDepth: 0,
        daysSinceOldest: 0,
        overdueCount: 0,
      };
      existing.queueDepth += 1;
      const age = Math.round((now.getTime() - new Date(item.initiatedDate).getTime()) / 86_400_000);
      existing.daysSinceOldest = Math.max(existing.daysSinceOldest, age);
      if (item.isOverdue) existing.overdueCount += 1;
      grouped.set(holderKey, existing);
    });
    return Array.from(grouped.values());
  }, [analytics?.focus.items]);

  if (analyticsQuery.isLoading && !analytics) {
    return <DashboardSkeleton />;
  }

  if (analyticsQuery.isError || !analytics) {
    return (
      <div className="mx-auto max-w-screen-xl p-6">
        <PortalSurface title="Dashboard analytics unavailable">
          <EmptyState
            title="Unable to load dashboard analytics"
            description={analyticsQuery.error instanceof Error ? analyticsQuery.error.message : "Please refresh the page or try again shortly."}
          />
        </PortalSurface>
      </div>
    );
  }

  const trendCard = analytics.trends[trendView];
  const comparisonEntries = comparisonView === "wing"
    ? analytics.performance.wing
    : comparisonView === "region"
      ? analytics.performance.region
    : comparisonView === "zone"
      ? analytics.performance.zone
      : analytics.performance.offices;

  const distributionItems = distributionView === "status"
    ? analytics.distributions.status
    : distributionView === "template"
      ? analytics.distributions.template
      : analytics.mode === "secret-branch"
        ? analytics.distributions.returnRateByWing.map((entry) => ({
            id: entry.id,
            label: entry.label,
            value: entry.anomalies ?? 0,
            meta: `${entry.archived ?? 0} archived · ${entry.avgTurnaroundDays ?? 0}d turnaround`,
          }))
        : analytics.distributions.returnRateByWing.map((entry) => ({
            id: entry.id,
            label: entry.label,
            value: entry.rate ?? 0,
            meta: `${entry.returned ?? 0} returned of ${entry.total}`,
          }));

  const turnaroundItems = analytics.performance.turnaroundByStage.map((entry) => ({
    label: entry.label,
    value: entry.avgDays,
    meta: "Average elapsed days",
  }));

  return (
    <div className="mx-auto flex max-w-screen-2xl flex-col gap-5 p-5">
      <PortalPageHeader
        eyebrow={analytics.heading.eyebrow}
        title={analytics.heading.title}
        description={analytics.heading.description}
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            {/* Quick date preset tabs */}
            <div className="flex items-center gap-0.5 rounded-full border border-[var(--fia-gray-200)] bg-[var(--fia-gray-50)] p-0.5">
              {[
                { value: "all", label: "All time" },
                { value: "fy", label: "This FY" },
                { value: "90d", label: "90d" },
                { value: "30d", label: "30d" },
              ].map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => updateFilter("datePreset", preset.value)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${
                    filters.datePreset === preset.value
                      ? "bg-[var(--fia-navy)] text-white shadow-sm"
                      : "text-[var(--fia-gray-600)] hover:bg-[var(--fia-gray-100)] hover:text-[var(--fia-gray-900)]"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        )}
      />

      <LeadershipFilters
        filters={filters}
        analytics={analytics}
        onChange={updateFilter}
        onReset={resetFilters}
        pending={isPending || analyticsQuery.isFetching}
      />

      {/* ── Main tab navigation ── */}
      <div className="flex gap-1 rounded-2xl border border-[var(--fia-gray-200)] bg-[var(--fia-gray-100)] p-1">
        {([
          { key: "overview",  label: "Overview" },
          { key: "analytics", label: "Analytics" },
          { key: "region",    label: "By Region" },
          { key: "focus",     label: "Exception Focus" },
        ] as const).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setMainTab(tab.key)}
            className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-150 ${
              mainTab === tab.key
                ? "bg-[var(--fia-navy)] text-white shadow-md"
                : "text-[var(--fia-gray-500)] hover:bg-[var(--fia-gray-100)] hover:text-[var(--fia-gray-900)] hover:shadow-sm"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════ OVERVIEW TAB ══════════════════════════ */}
      {mainTab === "overview" && (
        <>
          <LeadershipKpiGrid kpis={analytics.kpis} trendCard={analytics.trends.workload} />

          {/* Pipeline + Insights */}
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(240px,300px)]">
            <WorkflowPipeline
              stages={(() => {
                const kv = (key: string) => Number(analytics.kpis.find((k) => k.key === key)?.value ?? 0);
                const sv = (match: string) => analytics.distributions.status.find((d) => d.label.includes(match))?.value ?? 0;
                return [
                  { label: "Draft",          count: kv("draft")           || sv("Draft"),        color: "#94A3B8" },
                  { label: "Admin Office",   count: kv("adminForwarding") || sv("Admin"),         color: "#8B5CF6" },
                  { label: "Reporting",      count: kv("pendingRO")       || sv("Reporting"),     color: "#F59E0B" },
                  { label: "Countersigning", count: kv("pendingCSO")      || sv("Countersigning"), color: "#3B82F6" },
                  { label: "Secret Branch",  count: kv("pendingSB")       || sv("Secret"),        color: "#0EA5E9" },
                  { label: "Archived",       count: kv("archived")        || sv("Archived") || sv("Completed"), color: "#10B981" },
                ];
              })()}
            />
            <InsightsPanel kpis={analytics.kpis} mode={analytics.mode} />
          </div>

          {/* KPI Gauges row — performance dials */}
          <KpiGaugesRow kpis={analytics.kpis} mode={analytics.mode} distributions={analytics.distributions} />

          {/* Charts row: Trend + Status Donut (equal halves) */}
          <div className="grid gap-4 xl:grid-cols-2">
            <EChartsAreaTrend
              title="ACR Activity Trend"
              subtitle={trendCard.subtitle}
              data={trendCard.points as unknown as Array<{ label: string; [key: string]: string | number | null | undefined }>}
              series={trendCard.series.map((s) => ({ key: s.key, label: s.label, color: s.color }))}
              defaultSeries={trendCard.defaultSeries}
              height={220}
            />
            <EChartsDonut
              title="Status Distribution"
              subtitle="Click a segment to filter"
              data={analytics.distributions.status.map((d) => ({
                key: d.filterValue ?? d.key ?? d.label,
                label: d.label,
                value: d.value,
                filterValue: d.filterValue,
              }))}
              selectedKey={filters.status}
              onSelect={(key) => updateFilter("status", key ?? "")}
              height={220}
            />
          </div>
          <TurnaroundLollipop
            title="Avg Turnaround by Stage"
            data={analytics.performance.turnaroundByStage}
          />

        </>
      )}

      {/* ══════════════════════════ ANALYTICS TAB ══════════════════════════ */}
      {mainTab === "analytics" && (
        <>
          {/* Radar + Waterfall + Bubble — advanced analytics */}
          {(radarSeries.length > 0 || waterfallData.length > 0 || bubbleData.length > 0) && (
            <div className="grid gap-4 xl:grid-cols-3">
              {radarSeries.length > 0 ? (
                <UnitPerformanceRadar title="Wing Performance Radar" series={radarSeries} />
              ) : null}
              {waterfallData.length > 0 ? (
                <ArchiveWaterfall title="Archive Growth (Monthly)" data={waterfallData} />
              ) : null}
              {bubbleData.length > 0 ? (
                <OfficerWorkloadBubble title="Officer Workload" data={bubbleData} />
              ) : null}
            </div>
          )}

          {/* Performance — ECharts stacked bars */}
          <div className="grid gap-4 xl:grid-cols-2">
            <EChartsStackedBar
              title="Wing-wise Performance"
              subtitle={analytics.mode === "secret-branch" ? "Archived vs Pending vs Anomalies by Wing" : "Completed vs Pending vs Overdue by Wing"}
              data={analytics.performance.wing.map((w) => ({
                label: w.label,
                id: w.id,
                completed: analytics.mode === "secret-branch" ? (w.archived ?? 0) : (w.completed ?? 0),
                pending: analytics.mode === "secret-branch"
                  ? Math.max(0, w.total - (w.archived ?? 0) - (w.anomalies ?? 0))
                  : (w.pending ?? 0),
                overdue: analytics.mode === "secret-branch" ? (w.anomalies ?? 0) : (w.overdue ?? 0),
              }))}
              selectedId={filters.wingId}
              onSelect={(id) => updateFilter("wingId", id ?? "")}
            />
            <EChartsStackedBar
              title="Zone-wise Performance"
              subtitle={analytics.mode === "secret-branch" ? "Archive breakdown by Zone" : "Stacked breakdown by Zone"}
              data={analytics.performance.zone.slice(0, 8).map((z) => ({
                label: z.label,
                id: z.id,
                completed: analytics.mode === "secret-branch" ? (z.archived ?? 0) : (z.completed ?? 0),
                pending: analytics.mode === "secret-branch"
                  ? Math.max(0, z.total - (z.archived ?? 0) - (z.anomalies ?? 0))
                  : (z.pending ?? 0),
                overdue: analytics.mode === "secret-branch" ? (z.anomalies ?? 0) : (z.overdue ?? 0),
              }))}
              selectedId={filters.zoneId}
              onSelect={(id) => updateFilter("zoneId", id ?? "")}
            />
          </div>

          {/* Heatmap */}
          {analytics.heatmap ? <HeatmapTable heatmap={analytics.heatmap} /> : null}

          {/* Trend + Distribution */}
          <div className="grid gap-4 xl:grid-cols-2">
            {/* Left: ECharts area trend with view toggle */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-[var(--fia-gray-900)]">{trendCard.title}</h3>
                  <p className="mt-0.5 text-[11px] text-[var(--fia-gray-500)]">{trendCard.subtitle}</p>
                </div>
                <SegmentedTabs
                  value={trendView}
                  onChange={(next) => setTrendView(next as "workload" | "archive")}
                  tabs={[
                    { key: "workload", label: analytics.mode === "secret-branch" ? "Inflow" : "Workload" },
                    { key: "archive", label: analytics.mode === "secret-branch" ? "Activity" : "Archive" },
                  ]}
                />
              </div>
              <EChartsAreaTrend
                data={trendCard.points as unknown as Array<{ label: string; [key: string]: string | number | null | undefined }>}
                series={trendCard.series.map((s) => ({ key: s.key, label: s.label, color: s.color }))}
                defaultSeries={trendCard.defaultSeries}
                height={240}
              />
            </div>

            {/* Right: distribution donut / exceptions list */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-[var(--fia-gray-900)]">
                    {distributionView === "status" ? "Status distribution" : distributionView === "template" ? "Template distribution" : analytics.mode === "secret-branch" ? "Receipt anomalies" : "Return-rate distribution"}
                  </h3>
                  <p className="mt-0.5 text-[11px] text-[var(--fia-gray-500)]">
                    {distributionView === "status"
                      ? "Click a segment to filter the dashboard."
                      : distributionView === "template"
                        ? "Template family mix across the current filter scope."
                        : analytics.mode === "secret-branch"
                          ? "Units with pending receipt anomalies after filtering."
                          : "Wings with the heaviest correction burden."}
                  </p>
                </div>
                <SegmentedTabs
                  value={distributionView}
                  onChange={(next) => setDistributionView(next as "status" | "template" | "exceptions")}
                  tabs={[
                    { key: "status", label: "Status" },
                    { key: "template", label: "Template" },
                    { key: "exceptions", label: analytics.mode === "secret-branch" ? "Anomalies" : "Return rate" },
                  ]}
                />
              </div>
              {distributionView === "status" || distributionView === "template" ? (
                <EChartsDonut
                  data={(distributionItems as DashboardDistributionItem[]).map((d) => ({
                    key: d.filterValue ?? d.key ?? d.label,
                    label: d.label,
                    value: d.value,
                    filterValue: d.filterValue,
                  }))}
                  selectedKey={distributionView === "status" ? filters.status : filters.templateFamily}
                  onSelect={(key) => updateFilter(distributionView === "status" ? "status" : "templateFamily", key ?? "")}
                  height={240}
                />
              ) : (
                <div className="rounded-2xl border border-[var(--fia-gray-200)] bg-[var(--card)] p-4 shadow-sm">
                  <MetricList
                    entries={distributionItems as Array<{ id?: string; label: string; value: number; meta?: string }>}
                    emptyTitle="No exception data"
                    emptyDescription="No units stand out for this exception view under the current filters."
                    formatter={(value) => analytics.mode === "secret-branch" ? `${value}` : `${value}%`}
                    selectedId={analytics.mode === "secret-branch" ? filters.officeId : filters.wingId}
                    onSelect={(value) => updateFilter(analytics.mode === "secret-branch" ? "officeId" : "wingId", value ?? "")}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Comparison + Turnaround / Source flow */}
          <div className="grid gap-4 xl:grid-cols-2">
            {/* Left: ECharts horizontal bar comparison */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-[var(--fia-gray-900)]">
                    {comparisonView === "wing"
                      ? analytics.mode === "secret-branch" ? "Wing contribution" : "Wing performance"
                      : comparisonView === "region"
                        ? analytics.mode === "secret-branch" ? "Region contribution" : "Region performance"
                        : comparisonView === "zone"
                          ? analytics.mode === "secret-branch" ? "Zone contribution" : "Zone performance"
                          : analytics.mode === "secret-branch" ? "Top contributing units" : "Office backlog"}
                  </h3>
                  <p className="mt-0.5 text-[11px] text-[var(--fia-gray-500)]">
                    {comparisonView === "offices"
                      ? analytics.mode === "secret-branch"
                        ? "Offices contributing the highest final archive volume."
                        : "Offices carrying the heaviest backlog and exception load."
                      : "Click a bar to narrow the dashboard to that organisation unit."}
                  </p>
                </div>
                <SegmentedTabs
                  value={comparisonView}
                  onChange={(next) => setComparisonView(next as "wing" | "region" | "zone" | "offices")}
                  tabs={[
                    { key: "wing",    label: "Wing" },
                    { key: "region",  label: "Region" },
                    { key: "zone",    label: "Zone" },
                    { key: "offices", label: analytics.mode === "secret-branch" ? "Top units" : "Offices" },
                  ]}
                />
              </div>
              <EChartsHorizontalBar
                data={comparisonEntries.map((e) => ({
                  id: e.id,
                  label: e.label,
                  pending: e.pending ?? 0,
                  completed: e.completed ?? 0,
                  overdue: e.overdue ?? 0,
                  archived: e.archived ?? 0,
                  anomalies: e.anomalies ?? 0,
                }))}
                metrics={analytics.mode === "secret-branch"
                  ? [
                      { key: "archived",  label: "Archived",       color: "#14B8A6" },
                      { key: "anomalies", label: "Pending receipt", color: "#F43F5E" },
                    ]
                  : [
                      { key: "completed", label: "Completed", color: "#0D9488" },
                      { key: "pending",   label: "Pending",   color: "#4F46E5" },
                      { key: "overdue",   label: "Overdue",   color: "#E11D48" },
                    ]}
                selectedId={comparisonView === "wing" ? filters.wingId : comparisonView === "region" ? filters.regionId : comparisonView === "zone" ? filters.zoneId : filters.officeId}
                onSelect={(id) => updateFilter(comparisonView === "wing" ? "wingId" : comparisonView === "region" ? "regionId" : comparisonView === "zone" ? "zoneId" : "officeId", id ?? "")}
                compact
              />
            </div>

            {/* Right: source flow donut OR turnaround metric list */}
            <div className="flex flex-col gap-3">
              <div>
                <h3 className="text-sm font-bold text-[var(--fia-gray-900)]">
                  {analytics.mode === "secret-branch" ? "Source flow" : "Avg turnaround by stage"}
                </h3>
                <p className="mt-0.5 text-[11px] text-[var(--fia-gray-500)]">
                  {analytics.mode === "secret-branch"
                    ? "Final packets grouped by reporting route into Secret Branch."
                    : "Approximate elapsed time from stage hand-off to completion."}
                </p>
              </div>
              {analytics.mode === "secret-branch" ? (
                <EChartsDonut
                  data={(analytics.distributions.sourceFlow ?? []).map((d) => ({
                    key: d.filterValue ?? d.key ?? d.label,
                    label: d.label,
                    value: d.value,
                    filterValue: d.filterValue,
                  }))}
                  height={240}
                />
              ) : (
                <div className="rounded-2xl border border-[var(--fia-gray-200)] bg-[var(--card)] p-4 shadow-sm">
                  <MetricList
                    entries={turnaroundItems}
                    emptyTitle="No turnaround data"
                    emptyDescription="Completed records are required before turnaround metrics can be shown."
                    formatter={(value) => `${value}d`}
                  />
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ══════════════════════════ BY REGION TAB ══════════════════════════ */}
      {mainTab === "region" && (
        <>
          {/* Live Leaflet map with city heatmap — overdue intensity */}
          <FIAOperationsMap
            title="FIA Operations Map — Overdue Intensity by Station City"
            heatPoints={heatmapQuery.data}
            height={360}
          />

          {/* Region + Zone ECharts horizontal bars */}
          <div className="grid gap-4 xl:grid-cols-2">
            <EChartsHorizontalBar
              title="Region Performance"
              subtitle="Completed vs Pending vs Overdue by Region"
              data={analytics.performance.region.map((r) => ({
                id: r.id,
                label: r.label,
                completed: r.completed ?? 0,
                pending: r.pending ?? 0,
                overdue: r.overdue ?? 0,
              }))}
              metrics={[
                { key: "completed", label: "Completed", color: "#0D9488" },
                { key: "pending",   label: "Pending",   color: "#4F46E5" },
                { key: "overdue",   label: "Overdue",   color: "#E11D48" },
              ]}
              selectedId={filters.regionId}
              onSelect={(id) => updateFilter("regionId", id ?? "")}
              compact
            />
            <EChartsHorizontalBar
              title="Zone Performance"
              subtitle="Completed vs Pending vs Overdue by Zone"
              data={analytics.performance.zone.slice(0, 12).map((z) => ({
                id: z.id,
                label: z.label,
                completed: z.completed ?? 0,
                pending: z.pending ?? 0,
                overdue: z.overdue ?? 0,
              }))}
              metrics={[
                { key: "completed", label: "Completed", color: "#0D9488" },
                { key: "pending",   label: "Pending",   color: "#4F46E5" },
                { key: "overdue",   label: "Overdue",   color: "#E11D48" },
              ]}
              selectedId={filters.zoneId}
              onSelect={(id) => updateFilter("zoneId", id ?? "")}
              compact
            />
          </div>

          {/* Heatmap when in region tab */}
          {analytics.heatmap ? (
            <PortalSurface title={analytics.heatmap.title} subtitle={analytics.heatmap.subtitle}>
              <HeatmapMatrix
                heatmap={analytics.heatmap}
                selectedId={filters.wingId}
                onSelect={(id) => updateFilter("wingId", id ?? "")}
              />
            </PortalSurface>
          ) : null}
        </>
      )}

      {/* ══════════════════════════ FOCUS TAB ══════════════════════════ */}
      {mainTab === "focus" && (
        <LeadershipFocusTable
          title={analytics.focus.title}
          subtitle={analytics.focus.subtitle}
          items={analytics.focus.items}
          mode={analytics.mode}
        />
      )}
    </div>
  );
}
