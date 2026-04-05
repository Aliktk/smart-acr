"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, ChevronDown, ChevronRight, CircleHelp, LogOut, Menu, Search, Settings, User } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getCurrentUserAvatarUrl, getNotifications, logout } from "@/api/client";
import { useShell } from "@/hooks/useShell";
import { useMemo, useState } from "react";
import { UserAvatar } from "@/components/ui";
import { canUseGlobalSearch } from "@/utils/portal-access";

const routeLabels: Record<string, string> = {
  dashboard: "Dashboard",
  acr: "ACR",
  queue: "My Queue",
  analytics: "Reports & Analytics",
  priority: "Priority ACRs",
  overdue: "Overdue ACRs",
  archive: "Archive",
  search: "Search",
  notifications: "Notifications",
  "audit-logs": "Audit Logs",
  organization: "Organization",
  settings: "Settings",
  profile: "My Profile",
  "help-support": "Help & Support",
  "form-templates": "Form Templates",
  login: "Login",
  new: "New ACR",
};

export function TopHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [profileOpen, setProfileOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { setSidebarCollapsed, sidebarCollapsed, setNotificationPanelOpen, notificationPanelOpen, user, setUser } = useShell();

  const { data: notificationData } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => getNotifications(),
  });

  const unreadCount = notificationData?.items.filter((item) => !item.read).length ?? 0;
  const crumbs = useMemo(() => pathname.split("/").filter(Boolean).map((segment, index, array) => ({
    label: routeLabels[segment] ?? segment,
    path: index < array.length - 1 ? `/${array.slice(0, index + 1).join("/")}` : undefined,
  })), [pathname]);
  const avatarSrc = user?.hasAvatar ? getCurrentUserAvatarUrl(user.avatarVersion) : null;
  const searchEnabled = canUseGlobalSearch(user?.activeRoleCode ?? "CLERK");

  async function handleLogout() {
    try {
      await logout();
    } finally {
      setUser(null);
      setNotificationPanelOpen(false);
      await queryClient.cancelQueries();
      queryClient.clear();
      setProfileOpen(false);
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem("acr-auth-challenge");
        window.location.replace("/login");
      }
    }
  }

  return (
    <header className="relative z-20 flex h-14 items-center gap-2.5 border-b bg-white px-4 shadow-sm">
      <button className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 lg:hidden" onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>
        <Menu size={18} />
      </button>

      <nav className="flex min-w-0 flex-1 items-center gap-1" aria-label="Breadcrumb">
        {crumbs.map((crumb, index) => (
          <div key={`${crumb.label}-${index}`} className="flex items-center gap-1.5">
            {index > 0 ? <ChevronRight size={13} className="text-gray-300" /> : null}
            {crumb.path ? (
              <Link href={crumb.path} className="text-[13px] text-gray-400 transition-colors hover:text-[#1A1C6E]">
                {crumb.label}
              </Link>
            ) : (
              <span className="text-[13px] font-semibold text-[#111827]">{crumb.label}</span>
            )}
          </div>
        ))}
      </nav>

      {searchEnabled ? (
        <form
          className="hidden items-center rounded-lg border border-gray-200 bg-[#F9FAFB] px-3 py-1.5 md:flex"
          onSubmit={(event) => {
            event.preventDefault();
            router.push(`/search?query=${encodeURIComponent(query)}`);
          }}
        >
          <Search size={14} className="text-gray-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search ACR, employee, ID..."
            className="ml-2 w-52 bg-transparent text-sm outline-none"
          />
        </form>
      ) : null}

      {user?.activeRole ? (
        <span className="hidden rounded-full bg-[#EEF6FC] px-3 py-1 text-xs font-semibold text-[#1A1C6E] lg:inline-flex">
          {user.activeRole}
        </span>
      ) : null}

      <button
        onClick={() => setNotificationPanelOpen(!notificationPanelOpen)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100"
      >
        <Bell size={17} />
        {unreadCount > 0 ? (
          <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[9px] font-bold text-white">
            {unreadCount}
          </span>
        ) : null}
      </button>

      <div className="h-5 w-px bg-gray-200" />

      <div className="relative">
        <button
          className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 transition-colors hover:bg-gray-100"
          onClick={() => setProfileOpen((current) => !current)}
        >
          <UserAvatar
            name={user?.name ?? "FIA User"}
            src={avatarSrc}
            sizeClassName="h-7 w-7"
            textClassName="text-[11px]"
          />
          <span className="hidden max-w-[120px] truncate text-sm font-medium text-[#111827] sm:block">{user?.name.split(" ")[0] ?? "FIA"}</span>
          <ChevronDown size={13} className="hidden text-gray-400 sm:block" />
        </button>
        {profileOpen ? (
          <>
            <button className="fixed inset-0 cursor-default" onClick={() => setProfileOpen(false)} />
            <div className="absolute right-0 top-full mt-2 w-[220px] overflow-hidden rounded-[18px] border border-gray-200 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.12)]">
              <div className="border-b bg-[#F9FAFB] px-4 py-2.5">
                <p className="text-sm font-semibold text-[#111827]">{user?.name}</p>
                <p className="mt-0.5 text-xs text-gray-400">{user?.badgeNo}</p>
                <span className="mt-1.5 inline-flex rounded bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">{user?.activeRole}</span>
              </div>
              <div className="py-1">
                <Link
                  href="/profile"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50"
                >
                  <User size={14} className="text-gray-400" />
                  My Profile
                </Link>
                <Link
                  href="/settings"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50"
                >
                  <Settings size={14} className="text-gray-400" />
                  Settings
                </Link>
                <Link
                  href="/help-support"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50"
                >
                  <CircleHelp size={14} className="text-gray-400" />
                  Help &amp; Support
                </Link>
              </div>
              <div className="border-t border-gray-100 py-1">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 px-4 py-2 text-sm font-medium text-[#DC2626] transition-colors hover:bg-red-50"
                >
                  <LogOut size={14} />
                  Sign Out
                </button>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </header>
  );
}
