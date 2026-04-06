"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState, useTransition } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Archive,
  BarChart3,
  ClipboardCheck,
  Clock3,
  FileArchive,
  Filter,
  Gauge,
  Landmark,
  Layers3,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { getDashboardAnalytics } from "@/api/client";
import { PortalPageHeader, PortalSurface, EmptyState, SegmentedTabs } from "@/components/portal/PortalPrimitives";
import { OverdueBadge, PriorityBadge, StatCard, StatusChip } from "@/components/ui";
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
  UserSession,
} from "@/types/contracts";
import { getCurrentOwnerLabel, getCurrentStageLabel } from "@/utils/acr";

type LeadershipDashboardProps = {
  session: UserSession;
};

type DashboardFilterState = {
  datePreset: DashboardDatePreset;
  wingId: string;
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

function buildInitialFilters(session: UserSession): DashboardFilterState {
  return {
    datePreset: "180d",
    wingId: session.scope.wingId ?? "",
    zoneId: session.scope.zoneId ?? "",
    officeId: session.scope.officeId ?? "",
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
    return filters.wingId
      ? analytics.filterOptions.zones.filter((zone) => zone.wingId === filters.wingId)
      : analytics.filterOptions.zones;
  }, [analytics.filterOptions.zones, filters.wingId]);

  const offices = useMemo(() => {
    return analytics.filterOptions.offices.filter((office) => {
      if (filters.zoneId) {
        return office.zoneId === filters.zoneId;
      }
      if (filters.wingId) {
        return office.wingId === filters.wingId;
      }
      return true;
    });
  }, [analytics.filterOptions.offices, filters.zoneId, filters.wingId]);

  const selectClassName = "w-full rounded-[18px] border border-[var(--fia-gray-200)] bg-[var(--fia-gray-50)] px-3.5 py-2.5 text-sm text-[var(--fia-gray-800)] outline-none transition focus:border-[var(--fia-cyan)] focus:bg-white focus:ring-4 focus:ring-[rgba(0,149,217,0.10)]";

  return (
    <PortalSurface
      title="Dashboard filters"
      subtitle={`Applied window: ${analytics.appliedFilters.dateLabel}`}
      action={(
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-2 rounded-full border border-[var(--fia-gray-200)] px-3.5 py-2 text-sm font-semibold text-[var(--fia-gray-700)] transition hover:bg-[var(--fia-gray-50)]"
        >
          <RefreshCw size={14} className={pending ? "animate-spin" : ""} />
          Reset filters
        </button>
      )}
    >
      <div className="grid gap-3 xl:grid-cols-[160px_repeat(5,minmax(0,1fr))]">
        <label className="space-y-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--fia-gray-400)]">Date range</span>
          <select value={filters.datePreset} onChange={(event) => onChange("datePreset", event.target.value)} className={selectClassName}>
            {analytics.filterOptions.datePresets.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="space-y-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--fia-gray-400)]">Wing</span>
          <select value={filters.wingId} onChange={(event) => onChange("wingId", event.target.value)} className={selectClassName}>
            <option value="">All wings</option>
            {analytics.filterOptions.wings.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="space-y-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--fia-gray-400)]">Zone</span>
          <select value={filters.zoneId} onChange={(event) => onChange("zoneId", event.target.value)} className={selectClassName}>
            <option value="">All zones</option>
            {zones.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="space-y-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--fia-gray-400)]">Office</span>
          <select value={filters.officeId} onChange={(event) => onChange("officeId", event.target.value)} className={selectClassName}>
            <option value="">All offices</option>
            {offices.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="space-y-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--fia-gray-400)]">Status</span>
          <select value={filters.status} onChange={(event) => onChange("status", event.target.value)} className={selectClassName}>
            <option value="">All statuses</option>
            {analytics.filterOptions.statuses.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="space-y-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--fia-gray-400)]">Template</span>
          <select value={filters.templateFamily} onChange={(event) => onChange("templateFamily", event.target.value)} className={selectClassName}>
            <option value="">All templates</option>
            {analytics.filterOptions.templateFamilies.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      </div>
    </PortalSurface>
  );
}

function LeadershipKpiGrid({ kpis }: { kpis: DashboardKpi[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {kpis.map((kpi) => {
        const Icon = kpiIcons[kpi.key] ?? BarChart3;
        return (
          <StatCard
            key={kpi.key}
            title={kpi.label}
            value={formatNumber(kpi.value)}
            subtitle={kpi.helper}
            icon={<Icon size={18} />}
            accent={metricTone(kpi.key)}
          />
        );
      })}
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
                  : "border-[var(--fia-gray-200)] bg-white text-[var(--fia-gray-700)]"
              }`}
              style={active ? { background: chartLegendColor(series.color) } : undefined}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: chartLegendColor(series.color) }} />
              {series.label}
            </button>
          );
        })}
      </div>

      <div className="rounded-[22px] border border-[var(--fia-gray-100)] bg-[linear-gradient(180deg,#FFFFFF_0%,#FBFCFE_100%)] p-4">
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
          <div className="mt-3 flex flex-wrap items-start justify-between gap-3 rounded-[18px] border border-[var(--fia-gray-100)] bg-white px-4 py-3">
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
        <div className="absolute flex h-20 w-20 flex-col items-center justify-center rounded-full bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
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
                  : "border-[var(--fia-gray-200)] bg-white hover:bg-[var(--fia-gray-50)]"
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
            <div key={entry.id} className={`rounded-[18px] border px-4 py-3 transition ${active ? "border-transparent bg-[var(--fia-navy-50)]" : "border-[var(--fia-gray-200)] bg-white"}`}>
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
                : "border-[var(--fia-gray-200)] bg-white hover:bg-[var(--fia-gray-50)]"
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
                    : "border-[var(--fia-gray-200)] bg-white hover:bg-[var(--fia-gray-50)]"
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
  if (!items.length) {
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
              <th className="px-3.5 py-3">Record</th>
              <th className="px-3.5 py-3">Employee</th>
              <th className="px-3.5 py-3">Current Stage</th>
              <th className="px-3.5 py-3">Status</th>
              <th className="px-3.5 py-3">Due Date</th>
              <th className="px-3.5 py-3">Current Owner</th>
              <th className="px-3.5 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-[var(--fia-gray-100)] last:border-b-0">
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
                  <div className="flex flex-wrap gap-2">
                    <StatusChip status={item.status} />
                    {item.isPriority ? <PriorityBadge priority /> : null}
                    {item.isOverdue ? <OverdueBadge days={item.overdueDays} /> : null}
                  </div>
                </td>
                <td className={`px-3.5 py-3.5 ${item.isOverdue ? "font-semibold text-[var(--fia-danger)]" : "text-[var(--fia-gray-700)]"}`}>
                  {item.dueDate}
                </td>
                <td className="px-3.5 py-3.5 text-[var(--fia-gray-700)]">{getCurrentOwnerLabel(item)}</td>
                <td className="px-3.5 py-3.5 text-right">
                  <Link
                    href={`/acr/${item.id}`}
                    className="inline-flex items-center gap-2 rounded-full bg-[var(--fia-cyan-100)] px-3.5 py-1.5 font-semibold text-[var(--fia-cyan)] transition-colors hover:bg-[#D7EFFB]"
                  >
                    {mode === "secret-branch" ? "Open archive file" : "View brief"}
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
  const [trendView, setTrendView] = useState<"workload" | "archive">("workload");
  const [distributionView, setDistributionView] = useState<"status" | "template" | "exceptions">("status");
  const [comparisonView, setComparisonView] = useState<"wing" | "zone" | "offices">("wing");
  const deferredFilters = useDeferredValue(filters);

  useEffect(() => {
    setFilters(buildInitialFilters(session));
  }, [session]);

  const analyticsQuery = useQuery({
    queryKey: ["dashboard-analytics", session.activeRoleCode, deferredFilters],
    queryFn: () => getDashboardAnalytics({
      datePreset: deferredFilters.datePreset,
      wingId: deferredFilters.wingId || undefined,
      zoneId: deferredFilters.zoneId || undefined,
      officeId: deferredFilters.officeId || undefined,
      status: deferredFilters.status || undefined,
      templateFamily: deferredFilters.templateFamily || undefined,
    }),
    placeholderData: (previous) => previous,
  });

  const analytics = analyticsQuery.data;

  function updateFilter(key: keyof DashboardFilterState, value: string) {
    startTransition(() => {
      setFilters((current) => {
        if (key === "wingId") {
          return { ...current, wingId: value, zoneId: "", officeId: "" };
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

  if (analyticsQuery.isLoading && !analytics) {
    return <div className="p-6 text-sm text-[var(--fia-gray-500)]">Loading dashboard analytics...</div>;
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
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--fia-gray-200)] bg-white px-3.5 py-2 text-sm text-[var(--fia-gray-600)]">
              <Filter size={15} />
              {analytics.appliedFilters.dateLabel}
            </span>
            <Link href="/archive" className="fia-btn-primary">
              <Archive size={16} />
              {analytics.mode === "secret-branch" ? "Open archive register" : "Review archive"}
            </Link>
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

      <LeadershipKpiGrid kpis={analytics.kpis} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(340px,0.95fr)]">
        <PortalSurface
          title={trendCard.title}
          subtitle={trendCard.subtitle}
          action={(
            <SegmentedTabs
              value={trendView}
              onChange={(next) => setTrendView(next as "workload" | "archive")}
              tabs={[
                { key: "workload", label: analytics.mode === "secret-branch" ? "Inflow" : "Workload" },
                { key: "archive", label: analytics.mode === "secret-branch" ? "Activity" : "Archive" },
              ]}
            />
          )}
        >
          <TrendExplorer card={trendCard} />
        </PortalSurface>

        <PortalSurface
          title={distributionView === "status" ? "Status distribution" : distributionView === "template" ? "Template distribution" : analytics.mode === "secret-branch" ? "Receipt anomalies" : "Return-rate distribution"}
          subtitle={distributionView === "status"
            ? "Use the legend to filter the dashboard by the selected status."
            : distributionView === "template"
              ? "Template family mix across the current filter scope."
              : analytics.mode === "secret-branch"
                ? "Units with pending receipt anomalies after filtering."
                : "Wings with the heaviest correction burden."}
          action={(
            <SegmentedTabs
              value={distributionView}
              onChange={(next) => setDistributionView(next as "status" | "template" | "exceptions")}
              tabs={[
                { key: "status", label: "Status" },
                { key: "template", label: "Template" },
                { key: "exceptions", label: analytics.mode === "secret-branch" ? "Anomalies" : "Return rate" },
              ]}
            />
          )}
        >
          {distributionView === "status" || distributionView === "template" ? (
            <InteractiveDonut
              items={distributionItems as DashboardDistributionItem[]}
              activeValue={distributionView === "status" ? filters.status : filters.templateFamily}
              onSelect={(value) => updateFilter(distributionView === "status" ? "status" : "templateFamily", value ?? "")}
            />
          ) : (
            <MetricList
              entries={distributionItems as Array<{ id?: string; label: string; value: number; meta?: string }>}
              emptyTitle="No exception data"
              emptyDescription="No units stand out for this exception view under the current filters."
              formatter={(value) => analytics.mode === "secret-branch" ? `${value}` : `${value}%`}
              selectedId={analytics.mode === "secret-branch" ? filters.officeId : filters.wingId}
              onSelect={(value) => updateFilter(analytics.mode === "secret-branch" ? "officeId" : "wingId", value ?? "")}
            />
          )}
        </PortalSurface>
      </div>

      <div className={`grid gap-4 ${analytics.mode === "executive" ? "xl:grid-cols-[minmax(0,1.55fr)_minmax(340px,0.95fr)]" : "xl:grid-cols-[minmax(0,1.55fr)_minmax(340px,0.95fr)]"}`}>
        <PortalSurface
          title={comparisonView === "wing" ? `${analytics.mode === "secret-branch" ? "Wing contribution" : "Wing performance"}` : comparisonView === "zone" ? `${analytics.mode === "secret-branch" ? "Zone contribution" : "Zone performance"}` : analytics.mode === "secret-branch" ? "Top contributing units" : "Office backlog"}
          subtitle={comparisonView === "offices"
            ? analytics.mode === "secret-branch"
              ? "Offices contributing the highest final archive volume."
              : "Offices carrying the heaviest backlog and exception load."
            : "Click a row label to narrow the dashboard to that organization unit."}
          action={(
            <SegmentedTabs
              value={comparisonView}
              onChange={(next) => setComparisonView(next as "wing" | "zone" | "offices")}
              tabs={[
                { key: "wing", label: "Wing" },
                { key: "zone", label: "Zone" },
                { key: "offices", label: analytics.mode === "secret-branch" ? "Top units" : "Offices" },
              ]}
            />
          )}
        >
          <ComparisonBars
            entries={comparisonEntries}
            metrics={analytics.mode === "secret-branch"
              ? [
                  { key: "archived", label: "Archived", color: "green" },
                  { key: "anomalies", label: "Pending receipt", color: "red" },
                ]
              : [
                  { key: "pending", label: "Pending", color: "cyan" },
                  { key: "completed", label: "Completed", color: "green" },
                  { key: "overdue", label: "Overdue", color: "red" },
                ]}
            selectedId={comparisonView === "wing" ? filters.wingId : comparisonView === "zone" ? filters.zoneId : filters.officeId}
            onSelect={(id) => updateFilter(comparisonView === "wing" ? "wingId" : comparisonView === "zone" ? "zoneId" : "officeId", id ?? "")}
            valueFormatter={(entry) => analytics.mode === "secret-branch"
              ? `${entry.archived ?? 0} archived · ${entry.anomalies ?? 0} pending receipt`
              : `${entry.completionRate ?? 0}% completion · ${entry.avgTurnaroundDays ?? 0}d turnaround`}
          />
        </PortalSurface>

        <PortalSurface
          title={analytics.mode === "secret-branch" ? "Source flow" : "Average turnaround by stage"}
          subtitle={analytics.mode === "secret-branch"
            ? "Final packets grouped by reporting route into Secret Branch."
            : "Approximate elapsed time from stage hand-off to completion."}
        >
          {analytics.mode === "secret-branch" ? (
            <InteractiveDonut items={analytics.distributions.sourceFlow ?? []} />
          ) : (
            <MetricList
              entries={turnaroundItems}
              emptyTitle="No turnaround data"
              emptyDescription="Completed records are required before turnaround metrics can be shown."
              formatter={(value) => `${value}d`}
            />
          )}
        </PortalSurface>
      </div>

      {analytics.heatmap ? (
        <PortalSurface title={analytics.heatmap.title} subtitle={analytics.heatmap.subtitle}>
          <HeatmapMatrix heatmap={analytics.heatmap} selectedId={filters.wingId} onSelect={(id) => updateFilter("wingId", id ?? "")} />
        </PortalSurface>
      ) : null}

      <LeadershipFocusTable
        title={analytics.focus.title}
        subtitle={analytics.focus.subtitle}
        items={analytics.focus.items}
        mode={analytics.mode}
      />
    </div>
  );
}
