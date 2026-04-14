"use client";

import { EmployeeProfilePage } from "@/components/employees/EmployeeProfilePage";
import { UserSettingsPage } from "@/components/settings/UserSettingsPage";
import { useShell } from "@/hooks/useShell";

export default function ProfilePage() {
  const { user } = useShell();

  if (user?.activeRoleCode === "EMPLOYEE") {
    return <EmployeeProfilePage />;
  }

  return <UserSettingsPage initialTab="profile" />;
}
