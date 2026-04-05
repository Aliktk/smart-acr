import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, LucideIcon } from "lucide-react";

export type ChartDatum = {
  label: string;
  value: number;
  color?: string;
};

export function PortalPageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div className="space-y-1.5">
        {eyebrow ? (
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-[var(--fia-gray-400)]">
            {eyebrow}
          </p>
        ) : null}
        <div className="space-y-1">
          <h1 className="text-[1.75rem] font-semibold leading-tight text-[var(--fia-gray-950)]">{title}</h1>
          {description ? <p className="max-w-3xl text-[0.95rem] leading-6 text-[var(--fia-gray-500)]">{description}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2.5">{actions}</div> : null}
    </div>
  );
}

export function PortalSurface({
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-[24px] border border-[var(--fia-gray-200)] bg-white shadow-[0_8px_22px_rgba(15,23,42,0.05)] ${className}`}
    >
      {title || subtitle || action ? (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--fia-gray-100)] px-5 py-4">
          <div className="space-y-0.5">
            {title ? <h2 className="text-[1.02rem] font-semibold text-[var(--fia-gray-950)]">{title}</h2> : null}
            {subtitle ? <p className="text-sm leading-5 text-[var(--fia-gray-500)]">{subtitle}</p> : null}
          </div>
          {action ? <div className="flex items-center gap-2.5">{action}</div> : null}
        </div>
      ) : null}
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

export function PortalBanner({
  tone = "neutral",
  title,
  children,
}: {
  tone?: "neutral" | "attention" | "success";
  title: string;
  children: ReactNode;
}) {
  const tones = {
    neutral: {
      shell: "border-[var(--fia-gray-200)] bg-[linear-gradient(135deg,#FFFFFF_0%,#F8FAFC_100%)]",
      title: "text-[var(--fia-gray-900)]",
      body: "text-[var(--fia-gray-600)]",
    },
    attention: {
      shell: "border-[#FED7AA] bg-[linear-gradient(135deg,#FFF7ED_0%,#FFFFFF_100%)]",
      title: "text-[#9A3412]",
      body: "text-[#B45309]",
    },
    success: {
      shell: "border-[#BBF7D0] bg-[linear-gradient(135deg,#F0FDF4_0%,#FFFFFF_100%)]",
      title: "text-[#166534]",
      body: "text-[#15803D]",
    },
  } as const;

  const palette = tones[tone];

  return (
    <div className={`rounded-[20px] border px-4 py-3 ${palette.shell}`}>
      <p className={`text-sm font-semibold ${palette.title}`}>{title}</p>
      <div className={`mt-1 text-sm leading-5 ${palette.body}`}>{children}</div>
    </div>
  );
}

export function QuickLinkCard({
  href,
  icon: Icon,
  title,
  description,
  tone = "navy",
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
  tone?: "navy" | "cyan" | "amber" | "green" | "red";
}) {
  const toneMap = {
    navy: { badge: "bg-[var(--fia-navy-100)] text-[var(--fia-navy)]" },
    cyan: { badge: "bg-[var(--fia-cyan-100)] text-[var(--fia-cyan)]" },
    amber: { badge: "bg-[var(--fia-warning-bg)] text-[var(--fia-warning)]" },
    green: { badge: "bg-[var(--fia-success-bg)] text-[var(--fia-success)]" },
    red: { badge: "bg-[#FFF1F2] text-[#E11D48]" },
  } as const;

  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-[18px] border border-[var(--fia-gray-200)] bg-white px-3.5 py-3 transition-all hover:-translate-y-[1px] hover:border-[var(--fia-gray-300)] hover:shadow-[0_8px_18px_rgba(15,23,42,0.06)]"
    >
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] ${toneMap[tone].badge}`}>
        <Icon size={17} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[var(--fia-gray-950)]">{title}</p>
        <p className="mt-0.5 text-xs leading-5 text-[var(--fia-gray-500)]">{description}</p>
      </div>
      <ArrowRight size={15} className="shrink-0 text-[var(--fia-gray-300)] transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

export function QuietBarChart({ data }: { data: ChartDatum[] }) {
  const maxValue = Math.max(1, ...data.map((entry) => entry.value));

  return (
    <div className="space-y-2.5">
      {data.map((entry) => (
        <div key={entry.label} className="grid grid-cols-[96px_minmax(0,1fr)_32px] items-center gap-2.5">
          <span className="text-sm text-[var(--fia-gray-600)]">{entry.label}</span>
          <div className="h-2.5 rounded-full bg-[var(--fia-gray-100)]">
            <div
              className="h-2.5 rounded-full"
              style={{
                width: entry.value === 0 ? "0%" : `${Math.max(8, (entry.value / maxValue) * 100)}%`,
                background: entry.color ?? "var(--fia-navy)",
              }}
            />
          </div>
          <span className="text-right text-sm font-semibold text-[var(--fia-gray-700)]">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

export function QuietDonutChart({ data }: { data: ChartDatum[] }) {
  const total = Math.max(1, data.reduce((sum, entry) => sum + entry.value, 0));
  const radius = 72;
  const circumference = 2 * Math.PI * radius;
  let cursor = 0;

  return (
    <div className="flex flex-col items-center gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="relative flex items-center justify-center">
        <svg viewBox="0 0 200 200" className="h-40 w-40 -rotate-90">
          <circle cx="100" cy="100" r={radius} fill="none" stroke="#EEF2F7" strokeWidth="20" />
          {data.map((entry) => {
            if (entry.value <= 0) {
              return null;
            }

            const segment = (entry.value / total) * circumference;
            const dasharray = `${segment} ${circumference - segment}`;
            const dashoffset = -cursor;
            cursor += segment;

            return (
              <circle
                key={entry.label}
                cx="100"
                cy="100"
                r={radius}
                fill="none"
                stroke={entry.color ?? "var(--fia-cyan)"}
                strokeWidth="20"
                strokeDasharray={dasharray}
                strokeDashoffset={dashoffset}
                strokeLinecap="round"
              />
            );
          })}
        </svg>
        <div className="absolute flex h-20 w-20 flex-col items-center justify-center rounded-full bg-white">
          <span className="text-[1.2rem] font-semibold text-[var(--fia-gray-950)]">{total}</span>
          <span className="text-xs uppercase tracking-[0.18em] text-[var(--fia-gray-400)]">records</span>
        </div>
      </div>
      <div className="w-full space-y-2.5 lg:max-w-[220px]">
        {data.map((entry) => (
          <div key={entry.label} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: entry.color ?? "var(--fia-cyan)" }}
              />
              <span className="text-sm text-[var(--fia-gray-600)]">{entry.label}</span>
            </div>
            <span className="text-sm font-semibold text-[var(--fia-gray-800)]">{entry.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SegmentedTabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: Array<{ key: T; label: string; count?: number }>;
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {tabs.map((tab) => {
        const active = tab.key === value;

        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
              active
                ? "bg-[var(--fia-navy)] text-white"
                : "bg-[var(--fia-gray-50)] text-[var(--fia-gray-600)] hover:bg-[var(--fia-gray-100)]"
            }`}
          >
            {tab.label}
            {typeof tab.count === "number" ? (
                <span className={`rounded-full px-1.5 py-0.5 text-[11px] ${active ? "bg-white/15" : "bg-white text-[var(--fia-gray-500)]"}`}>
                  {tab.count}
                </span>
              ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-[20px] border border-dashed border-[var(--fia-gray-300)] bg-[linear-gradient(180deg,#FCFCFD_0%,#F8FAFC_100%)] px-5 py-8 text-center">
      <p className="text-lg font-semibold text-[var(--fia-gray-900)]">{title}</p>
      <p className="mx-auto mt-1.5 max-w-xl text-sm leading-6 text-[var(--fia-gray-500)]">{description}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
