"use client";

import { createContext, useContext, useMemo, useState } from "react";
import type { UserRole, UserSession } from "@/types/contracts";

interface ShellContextValue {
  activeRole: UserRole | null;
  setActiveRole: (role: UserRole) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (value: boolean) => void;
  notificationPanelOpen: boolean;
  setNotificationPanelOpen: (value: boolean) => void;
  user: UserSession | null;
  setUser: (value: UserSession | null) => void;
}

const ShellContext = createContext<ShellContextValue | undefined>(undefined);

export function AppShellProvider({ children }: { children: React.ReactNode }) {
  const [activeRole, setActiveRole] = useState<UserRole | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [notificationPanelOpen, setNotificationPanelOpen] = useState(false);
  const [user, setUser] = useState<UserSession | null>(null);

  const value = useMemo(
    () => ({
      activeRole,
      setActiveRole,
      sidebarCollapsed,
      setSidebarCollapsed,
      notificationPanelOpen,
      setNotificationPanelOpen,
      user,
      setUser,
    }),
    [activeRole, notificationPanelOpen, sidebarCollapsed, user],
  );

  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}

export function useShell() {
  const context = useContext(ShellContext);

  if (!context) {
    throw new Error("useShell must be used within AppShellProvider");
  }

  return context;
}
