import type { UserRoleCode } from "@/types/contracts";

export const roleMetadata: Record<UserRoleCode, { label: string; description: string }> = {
  SUPER_ADMIN: {
    label: "Super Admin",
    description: "System configuration, role governance, and operational administration.",
  },
  IT_OPS: {
    label: "IT Ops",
    description: "Infrastructure oversight, platform health, and technical administration without delegated user provisioning.",
  },
  CLERK: {
    label: "Clerk",
    description: "Initiate and manage ACRs for wing employees.",
  },
  REPORTING_OFFICER: {
    label: "Reporting Officer",
    description: "Review, evaluate and forward ACRs for countersigning.",
  },
  COUNTERSIGNING_OFFICER: {
    label: "Countersigning Officer",
    description: "Final review and approval before archival.",
  },
  SECRET_BRANCH: {
    label: "Secret Branch",
    description: "Central archive management, verification, and delegated user administration when enabled on the Secret Branch profile.",
  },
  WING_OVERSIGHT: {
    label: "Wing Oversight",
    description: "Wing-level visibility across workload, returns, and completion trends.",
  },
  ZONAL_OVERSIGHT: {
    label: "Zonal Oversight",
    description: "Zone-wide monitoring for pendency, due dates, and completion.",
  },
  DG: {
    label: "DG / Executive",
    description: "Executive analytics, leadership dashboards and reports.",
  },
  EXECUTIVE_VIEWER: {
    label: "DG Viewer",
    description: "Read-only leadership visibility into ACR progress and archive trends.",
  },
  EMPLOYEE: {
    label: "Employee",
    description: "Limited employee-facing visibility into ACR status when enabled.",
  },
};

export function getRoleLabel(roleCode: UserRoleCode) {
  return roleMetadata[roleCode]?.label ?? roleCode;
}
