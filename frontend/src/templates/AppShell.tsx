"use client";

import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { getSession } from "@/api/client";
import { NotificationPanel } from "@/components/NotificationPanel";
import { Sidebar } from "@/components/Sidebar";
import { TopHeader } from "@/components/TopHeader";
import { useShell } from "@/hooks/useShell";
import { canAccessPortalPath, getDefaultPortalRoute } from "@/utils/portal-access";

function ShellGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { setUser, setActiveRole } = useShell();
  const sessionQuery = useQuery({
    queryKey: ["session"],
    queryFn: getSession,
    retry: false,
  });

  useEffect(() => {
    if (!sessionQuery.data) {
      return;
    }

    setUser(sessionQuery.data);
    setActiveRole(sessionQuery.data.activeRole);

    if (sessionQuery.data.mustChangePassword && pathname !== "/settings") {
      router.replace("/settings?tab=security&forcePassword=1");
      return;
    }

    if (!canAccessPortalPath(sessionQuery.data.activeRoleCode, pathname)) {
      router.replace(getDefaultPortalRoute(sessionQuery.data.activeRoleCode));
    }
  }, [pathname, router, sessionQuery.data, setActiveRole, setUser]);

  useEffect(() => {
    if (!sessionQuery.isError && (sessionQuery.isPending || sessionQuery.data)) {
      return;
    }

    setUser(null);
    router.replace("/login");
  }, [router, sessionQuery.data, sessionQuery.isError, sessionQuery.isPending, setUser]);

  if (sessionQuery.isPending) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,#E8EEF9_0%,#F4F6FB_45%,#EFF3F9_100%)] px-6">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(26,28,110,0.04),transparent_42%,rgba(0,149,217,0.06))]" />
        <div className="relative w-full max-w-lg overflow-hidden rounded-[30px] border border-white/70 bg-white/92 px-8 py-9 text-center shadow-[0_24px_60px_rgba(15,23,42,0.12)] backdrop-blur">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-[#DCE6F5] bg-[#F8FBFF] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#5B6B8B]">
            FIA Smart ACR / PER
          </div>
          <div className="mx-auto mt-6 flex h-14 w-14 items-center justify-center rounded-[20px] bg-[linear-gradient(135deg,#1A1C6E_0%,#0095D9_100%)] shadow-[0_14px_30px_rgba(26,28,110,0.28)]">
            <div className="h-7 w-7 animate-spin rounded-full border-[2.5px] border-white/30 border-t-white" />
          </div>
          <h1 className="mt-6 text-[1.45rem] font-semibold tracking-[-0.02em] text-[var(--fia-gray-950)]">Opening FIA Workspace</h1>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[var(--fia-gray-500)]">
            Checking your secure session and preparing the portal.
          </p>
        </div>
      </div>
    );
  }

  if (!sessionQuery.data) {
    return null;
  }

  if (!canAccessPortalPath(sessionQuery.data.activeRoleCode, pathname)) {
    return null;
  }

  return <>{children}</>;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { sidebarCollapsed } = useShell();

  return (
    <ShellGate>
      <div
        className="relative isolate grid h-screen w-full grid-cols-[auto_minmax(0,1fr)] overflow-hidden"
        style={{
          background: "#F4F6FB",
          ["--active-sidebar-width" as string]: sidebarCollapsed ? "var(--sidebar-collapsed-width)" : "var(--sidebar-width)",
        }}
      >
        <Sidebar />
        <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
          <TopHeader />
          <main className="flex-1 overflow-x-hidden overflow-y-auto">{children}</main>
          <NotificationPanel />
        </div>
      </div>
    </ShellGate>
  );
}
