import { useMemo } from "react";
import { useShell } from "./useShell";
import type { UserRoleCode } from "@/types/contracts";

const ADMIN_ROLES: UserRoleCode[] = ["SUPER_ADMIN", "IT_OPS"];
const OVERSIGHT_ROLES: UserRoleCode[] = ["DG", "EXECUTIVE_VIEWER", "WING_OVERSIGHT", "ZONAL_OVERSIGHT"];
const REVIEWER_ROLES: UserRoleCode[] = ["REPORTING_OFFICER", "COUNTERSIGNING_OFFICER"];

export function usePermissions() {
  const { user } = useShell();
  const role = user?.activeRoleCode ?? null;

  return useMemo(() => {
    const isAdmin = role ? ADMIN_ROLES.includes(role) : false;
    const isOversight = role ? OVERSIGHT_ROLES.includes(role) : false;
    const isReviewer = role ? REVIEWER_ROLES.includes(role) : false;

    return {
      role,
      isAdmin,
      isOversight,
      isReviewer,
      isClerk: role === "CLERK",
      isReportingOfficer: role === "REPORTING_OFFICER",
      isCountersigningOfficer: role === "COUNTERSIGNING_OFFICER",
      isSecretBranch: role === "SECRET_BRANCH",
      isEmployee: role === "EMPLOYEE",
      isDG: role === "DG",
      canInitiateAcr: role === "CLERK",
      canManageUsers: isAdmin,
      canViewAnalytics: isAdmin || role === "SECRET_BRANCH" || isOversight,
      canViewAuditLogs: isAdmin || role === "SECRET_BRANCH",
    };
  }, [role]);
}
