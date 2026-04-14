"use client";

import type { ReactNode } from "react";
import { FIALogo } from "@/components/ui";
import { useTheme } from "@/providers/ThemeProvider";

export function AuthShell({
  title: _title,
  subtitle: _subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const { theme } = useTheme();
  return (
    <main className="flex min-h-dvh items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,#F9FBFF_0%,#F4F6FB_48%,#EFF3F9_100%)] dark:bg-[radial-gradient(circle_at_top,#161830_0%,#0F1117_48%,#12141E_100%)] px-4 py-4">
      <div className="w-full max-w-[456px]">
        <div className="mb-4 flex flex-col items-center text-center">
          <div className="rounded-[24px] border border-white/80 bg-white/88 px-6 py-4 shadow-[0_14px_32px_rgba(15,23,42,0.08)] backdrop-blur dark:border-white/10 dark:bg-[var(--card)]/90 dark:shadow-[0_14px_32px_rgba(0,0,0,0.3)]">
            <FIALogo variant="full" size="md" theme={theme === "dark" ? "dark" : "light"} />
          </div>
        </div>

        <div className="overflow-hidden rounded-[24px] border border-[var(--fia-gray-200)] bg-white shadow-[0_20px_48px_rgba(15,23,42,0.08)] dark:bg-[var(--card)] dark:shadow-[0_20px_48px_rgba(0,0,0,0.3)]">
          <div className="h-[2px] bg-[linear-gradient(90deg,#1A1C6E_0%,#0095D9_100%)]" />
          <div className="p-6 sm:p-7">{children}</div>
        </div>

        {footer ? <div className="mt-3 text-center text-[11px] text-[var(--fia-gray-400)]">{footer}</div> : null}
      </div>
    </main>
  );
}
