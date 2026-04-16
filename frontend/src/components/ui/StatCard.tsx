import React, { ReactNode } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: ReactNode;
  trend?: { value: number; label: string; up: boolean };
  accent?: "navy" | "cyan" | "green" | "amber" | "red" | "purple" | "slate";
  sparkline?: number[];
  size?: "default" | "compact";
  onClick?: () => void;
}

function InlineSparkline({ data, color, height = 28 }: { data: number[]; color: string; height?: number }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const w = 64;
  const h = height;
  const pad = 2;
  const iw = w - pad * 2;
  const ih = h - pad * 2;
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * iw;
    const y = pad + ih - ((v - min) / range) * ih;
    return `${x},${y}`;
  });
  const linePath = `M${pts.join("L")}`;
  const fillPath = `${linePath}L${pad + iw},${pad + ih}L${pad},${pad + ih}Z`;
  const gradId = `sg-${color.replace(/[^a-z0-9]/gi, "")}`;

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="block shrink-0 opacity-75">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.22} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={fillPath} fill={`url(#${gradId})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const accentConfig = {
  navy:   { iconBg: "var(--fia-navy-100)", iconColor: "var(--fia-navy)", topBar: "var(--fia-navy)" },
  cyan:   { iconBg: "var(--fia-cyan-100)", iconColor: "var(--fia-cyan)", topBar: "var(--fia-cyan)" },
  green:  { iconBg: "var(--fia-success-bg)", iconColor: "var(--fia-success)", topBar: "var(--fia-success)" },
  amber:  { iconBg: "var(--fia-warning-bg)", iconColor: "var(--fia-warning)", topBar: "var(--fia-warning)" },
  red:    { iconBg: "var(--fia-danger-bg)", iconColor: "var(--fia-danger)", topBar: "var(--fia-danger)" },
  purple: { iconBg: "var(--fia-navy-100)", iconColor: "#7C3AED", topBar: "#7C3AED" },
  slate:  { iconBg: "var(--fia-gray-100)", iconColor: "var(--fia-gray-500)", topBar: "var(--fia-gray-500)" },
};

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  accent = "navy",
  sparkline,
  size = "default",
  onClick,
}: StatCardProps) {
  const cfg = accentConfig[accent];
  const isCompact = size === "compact";

  return (
    <div
      data-testid="stat-card"
      className="overflow-hidden rounded-2xl bg-[var(--card)] transition-all duration-150"
      style={{
        border: "1px solid var(--fia-gray-200)",
        boxShadow: "var(--shadow-xs)",
        cursor: onClick ? "pointer" : "default",
      }}
      onClick={onClick}
      onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => {
        if (onClick) {
          (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)";
          (e.currentTarget as HTMLDivElement).style.transform = "translateY(-1px)";
        }
      }}
      onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => {
        if (onClick) {
          (e.currentTarget as HTMLDivElement).style.boxShadow = "0 1px 3px rgba(0,0,0,0.06)";
          (e.currentTarget as HTMLDivElement).style.transform = "none";
        }
      }}
    >
      {/* Top accent bar */}
      <div style={{ height: "2px", background: cfg.topBar, opacity: 0.72 }} />

      <div className={isCompact ? "px-3 py-2.5" : "p-4"}>
        <div className="flex items-start justify-between gap-2">
          {/* Values */}
          <div className="flex-1 min-w-0">
            <p
              className="font-semibold uppercase tracking-[0.05em] truncate"
              style={{ fontSize: isCompact ? "9px" : "11px", color: "var(--fia-gray-400)" }}
            >
              {title}
            </p>
            <p
              className="mt-0.5 font-bold leading-none"
              style={{ fontSize: isCompact ? "1.25rem" : "1.55rem", color: "var(--fia-gray-900)" }}
            >
              {value}
            </p>
            {subtitle && (
              <p
                className="mt-0.5 leading-tight"
                style={{ fontSize: isCompact ? "9px" : "11px", color: "var(--fia-gray-500)" }}
              >
                {subtitle}
              </p>
            )}
            {trend && !isCompact && (
              <div className="mt-1.5 flex items-center gap-1">
                {trend.up ? (
                  <TrendingUp size={12} style={{ color: "var(--fia-success)" }} />
                ) : (
                  <TrendingDown size={12} style={{ color: "var(--fia-danger)" }} />
                )}
                <span
                  className="text-xs font-semibold"
                  style={{ color: trend.up ? "var(--fia-success)" : "var(--fia-danger)" }}
                >
                  {trend.up ? "+" : "-"}{Math.abs(trend.value)}%
                </span>
                <span className="text-xs" style={{ color: "var(--fia-gray-400)" }}>
                  {trend.label}
                </span>
              </div>
            )}
          </div>

          {/* Right side: icon + optional sparkline */}
          <div className="flex flex-col items-end gap-1 shrink-0">
            <div
              className="flex items-center justify-center rounded-xl flex-shrink-0"
              style={{
                width: isCompact ? "28px" : "40px",
                height: isCompact ? "28px" : "40px",
                borderRadius: isCompact ? "10px" : "16px",
                background: cfg.iconBg,
                color: cfg.iconColor,
              }}
            >
              {React.isValidElement(icon)
                ? React.cloneElement(icon as React.ReactElement<{ size?: number }>, { size: isCompact ? 13 : 18 })
                : icon}
            </div>
            {sparkline && sparkline.length >= 2 ? (
              <InlineSparkline data={sparkline} color={cfg.topBar} height={isCompact ? 20 : 28} />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
