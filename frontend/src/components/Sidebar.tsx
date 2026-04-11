"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Archive,
  Bell,
  ChevronLeft,
  ChevronRight,
  FilePlus,
  FileText,
  InboxIcon,
  LayoutDashboard,
  LogOut,
  Network,
  ScrollText,
  Search,
  Settings,
  Star,
  Users,
  UserCircle,
} from "lucide-react";
import { FIALogo, UserAvatar } from "@/components/ui";
import { useShell } from "@/hooks/useShell";
import { getCurrentUserAvatarUrl, logout } from "@/api/client";
import type { UserRoleCode } from "@/types/contracts";
import { canManageUserAccounts } from "@/utils/portal-access";

type NavItem = {
  path: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles?: UserRoleCode[];
};

const leadershipRoles: UserRoleCode[] = ["SUPER_ADMIN", "IT_OPS", "SECRET_BRANCH", "DG", "EXECUTIVE_VIEWER", "WING_OVERSIGHT", "ZONAL_OVERSIGHT"];
const adminAuditRoles: UserRoleCode[] = ["SUPER_ADMIN", "IT_OPS", "SECRET_BRANCH", "WING_OVERSIGHT", "ZONAL_OVERSIGHT"];

const navGroups: Array<{ label?: string; items: NavItem[] }> = [
  {
    items: [
      {
        path: "/dashboard",
        label: "Dashboard",
        icon: LayoutDashboard,
        roles: [
          "REPORTING_OFFICER",
          "COUNTERSIGNING_OFFICER",
          "SECRET_BRANCH",
          "SUPER_ADMIN",
          "IT_OPS",
          "DG",
          "EXECUTIVE_VIEWER",
          "WING_OVERSIGHT",
          "ZONAL_OVERSIGHT",
          "EMPLOYEE",
        ],
      },
    ],
  },
  {
    label: "ACR Management",
    items: [
      { path: "/acr/new", label: "Initiate ACR", icon: FilePlus, roles: ["CLERK", "SUPER_ADMIN", "IT_OPS", "SECRET_BRANCH"] },
      { path: "/queue", label: "My Queue", icon: InboxIcon, roles: ["CLERK", "REPORTING_OFFICER", "COUNTERSIGNING_OFFICER", "SECRET_BRANCH", "SUPER_ADMIN", "IT_OPS", "DG", "EXECUTIVE_VIEWER", "WING_OVERSIGHT", "ZONAL_OVERSIGHT", "EMPLOYEE"] },
      { path: "/priority", label: "Priority", icon: Star, roles: ["SUPER_ADMIN", "IT_OPS", "DG", "EXECUTIVE_VIEWER", "WING_OVERSIGHT", "ZONAL_OVERSIGHT", "REPORTING_OFFICER", "COUNTERSIGNING_OFFICER", "SECRET_BRANCH"] },
      { path: "/overdue", label: "Overdue", icon: AlertTriangle, roles: ["SUPER_ADMIN", "IT_OPS", "DG", "EXECUTIVE_VIEWER", "WING_OVERSIGHT", "ZONAL_OVERSIGHT", "REPORTING_OFFICER", "COUNTERSIGNING_OFFICER", "SECRET_BRANCH"] },
    ],
  },
  {
    label: "Records",
    items: [
      { path: "/archive", label: "Archive", icon: Archive, roles: leadershipRoles },
      { path: "/search", label: "Search Records", icon: Search, roles: leadershipRoles.concat(["REPORTING_OFFICER", "COUNTERSIGNING_OFFICER"]) },
      { path: "/form-templates", label: "Form Templates", icon: FileText },
    ],
  },
  {
    label: "Administration",
    items: [
      { path: "/notifications", label: "Notifications", icon: Bell },
      { path: "/user-management", label: "User Management", icon: Users, roles: ["SUPER_ADMIN", "SECRET_BRANCH"] },
      { path: "/audit-logs", label: "Audit Logs", icon: ScrollText, roles: adminAuditRoles },
      { path: "/organization", label: "Organization", icon: Network, roles: leadershipRoles },
      { path: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { sidebarCollapsed, setSidebarCollapsed, user, setUser } = useShell();
  const avatarSrc = user?.hasAvatar ? getCurrentUserAvatarUrl(user.avatarVersion) : null;
  const activeRoleCode = user?.activeRoleCode ?? "CLERK";

  const baseGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (item.path === "/user-management") {
          if (!user) {
            return false;
          }

          return canManageUserAccounts(user);
        }

        return !item.roles || item.roles.includes(activeRoleCode);
      }),
    }))
    .filter((group) => group.items.length > 0);
  const visibleGroups =
    activeRoleCode === "DG"
      ? baseGroups
          .map((group) => ({
            ...group,
            items: group.items.filter((item) => ["/dashboard", "/search", "/archive", "/notifications", "/settings"].includes(item.path)),
          }))
          .filter((group) => group.items.length > 0)
      : baseGroups;
  const normalizedGroups =
    activeRoleCode === "EMPLOYEE"
      ? visibleGroups.map((group) => ({
          ...group,
          items: group.items
            .map((item) => {
              if (item.path === "/queue") {
                return { ...item, label: "My ACR History" };
              }
              if (item.path === "/archive") {
                return { ...item, label: "Archive History" };
              }
              return item;
            })
            .filter((item) => item.path !== "/form-templates"),
        }))
      : visibleGroups;

  async function handleLogout() {
    try {
      await logout();
    } finally {
      setUser(null);
      await queryClient.cancelQueries();
      queryClient.clear();
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem("acr-auth-challenge");
        window.location.replace("/login");
      }
    }
  }

  return (
    <aside
      className="relative flex h-full min-h-0 flex-shrink-0 flex-col overflow-visible transition-all duration-300"
      style={{
        width: sidebarCollapsed ? "var(--sidebar-collapsed-width)" : "var(--sidebar-width)",
        background: "linear-gradient(180deg, var(--fia-navy) 0%, var(--fia-navy-500) 100%)",
        borderRight: "1px solid var(--sidebar-border)",
      }}
    >
      <div
        className="flex h-14 shrink-0 items-center border-b px-3"
        style={{ borderColor: "rgba(255,255,255,0.08)", justifyContent: sidebarCollapsed ? "center" : "flex-start" }}
      >
        {sidebarCollapsed ? (
          <FIALogo variant="icon" size="sm" theme="dark" />
        ) : (
          <FIALogo variant="horizontal" size="sm" theme="dark" className="max-w-full" />
        )}
      </div>

      <button
        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        className="absolute -right-3 top-[66px] z-20 flex h-6 w-6 items-center justify-center rounded-full border border-[var(--fia-gray-200)] bg-[var(--card)] shadow-sm transition-colors hover:bg-[var(--fia-gray-50)]"
        title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {sidebarCollapsed ? <ChevronRight size={12} className="text-[var(--fia-gray-500)]" /> : <ChevronLeft size={12} className="text-[var(--fia-gray-500)]" />}
      </button>

      <nav className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-2 py-3">
        {normalizedGroups.map((group, index) => (
          <div key={index}>
            {group.label && !sidebarCollapsed ? (
              <p className="mb-1 px-3 text-[9px] font-semibold uppercase tracking-[0.18em] text-white/32">{group.label}</p>
            ) : null}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = pathname === item.path || (item.path !== "/dashboard" && pathname.startsWith(item.path));
                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    className={`group flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-all [&_svg]:shrink-0 [&_svg]:stroke-[2] ${
                      active
                        ? "bg-white/[0.14] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                        : "text-white/80 hover:bg-white/[0.08] hover:text-white"
                    }`}
                    style={{ color: active ? "#FFFFFF" : "rgba(255,255,255,0.84)" }}
                    title={sidebarCollapsed ? item.label : undefined}
                  >
                    <item.icon
                      size={17}
                      className={active ? "text-white" : "text-white group-hover:text-white"}
                      style={{ color: active ? "#FFFFFF" : "rgba(255,255,255,0.88)" }}
                    />
                    {!sidebarCollapsed ? <span className="truncate">{item.label}</span> : null}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t p-2.5" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
        {!sidebarCollapsed ? (
          <div className="rounded-xl p-2.5" style={{ background: "rgba(255,255,255,0.08)" }}>
            <div className="flex items-center gap-2.5">
              <UserAvatar
                name={user?.name ?? "FIA User"}
                src={avatarSrc}
                sizeClassName="h-8 w-8"
                textClassName="text-sm"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-white">{user?.name ?? "FIA User"}</p>
                <p className="truncate text-xs text-white/50">{user?.activeRole ?? "Clerk"}</p>
              </div>
            </div>
            <div className="mt-2.5 flex gap-2">
              <Link href="/profile" className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-white/10 py-1.5 text-xs text-white transition-colors hover:bg-white/15">
                <UserCircle size={13} />
                Profile
              </Link>
              <button onClick={handleLogout} className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-white/10 py-1.5 text-xs text-white transition-colors hover:bg-red-600/20 hover:text-red-100">
                <LogOut size={13} />
                Logout
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
