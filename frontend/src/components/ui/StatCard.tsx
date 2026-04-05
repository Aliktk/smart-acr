import React, { ReactNode } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: ReactNode;
  trend?: { value: number; label: string; up: boolean };
  accent?: "navy" | "cyan" | "green" | "amber" | "red" | "purple" | "slate";
  onClick?: () => void;
}

const accentConfig = {
  navy:   { iconBg: "var(--fia-navy-100)", iconColor: "var(--fia-navy)", topBar: "var(--fia-navy)" },
  cyan:   { iconBg: "var(--fia-cyan-100)", iconColor: "var(--fia-cyan)", topBar: "var(--fia-cyan)" },
  green:  { iconBg: "var(--fia-success-bg)", iconColor: "var(--fia-success)", topBar: "var(--fia-success)" },
  amber:  { iconBg: "var(--fia-warning-bg)", iconColor: "var(--fia-warning)", topBar: "var(--fia-warning)" },
  red:    { iconBg: "var(--fia-danger-bg)", iconColor: "var(--fia-danger)", topBar: "var(--fia-danger)" },
  purple: { iconBg: "#F5F3FF", iconColor: "#7C3AED", topBar: "#7C3AED" },
  slate:  { iconBg: "#F8FAFC", iconColor: "#475569", topBar: "#475569" },
};

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  accent = "navy",
  onClick,
}: StatCardProps) {
  const cfg = accentConfig[accent];

  return (
    <div
      className="overflow-hidden rounded-[24px] bg-white transition-all duration-150"
      style={{
        border: "1px solid var(--fia-gray-200)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
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

      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          {/* Values */}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.05em]" style={{ color: "var(--fia-gray-400)" }}>
              {title}
            </p>
            <p className="mt-1 font-bold leading-none" style={{ fontSize: "1.55rem", color: "var(--fia-gray-900)" }}>
              {value}
            </p>
            {subtitle && (
              <p className="mt-0.5 text-xs" style={{ color: "var(--fia-gray-500)" }}>
                {subtitle}
              </p>
            )}
            {trend && (
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

          {/* Icon */}
          <div
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[16px]"
            style={{ background: cfg.iconBg, color: cfg.iconColor }}
          >
            {icon}
          </div>
        </div>
      </div>
    </div>
  );
}
