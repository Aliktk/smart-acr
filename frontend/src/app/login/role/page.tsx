"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, BarChart3, ClipboardCheck, FileText, Lock, Shield, UserCog } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getSession, switchRole } from "@/api/client";
import { AuthShell } from "@/components/auth/AuthShell";
import { useShell } from "@/hooks/useShell";
import type { UserRoleCode } from "@/types/contracts";
import { getDefaultPortalRoute } from "@/utils/portal-access";
import { getRoleLabel, roleMetadata } from "@/utils/roles";

const roleIcons: Record<UserRoleCode, typeof FileText> = {
  SUPER_ADMIN: Shield,
  IT_OPS: UserCog,
  CLERK: FileText,
  REPORTING_OFFICER: ClipboardCheck,
  COUNTERSIGNING_OFFICER: ClipboardCheck,
  SECRET_BRANCH: Archive,
  WING_OVERSIGHT: BarChart3,
  ZONAL_OVERSIGHT: BarChart3,
  DG: BarChart3,
  EXECUTIVE_VIEWER: BarChart3,
  EMPLOYEE: Lock,
};

export default function RoleSelectionPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { setUser, setActiveRole } = useShell();
  const { data: session } = useQuery({
    queryKey: ["session"],
    queryFn: getSession,
  });
  const [selectedRole, setSelectedRole] = useState<UserRoleCode | null>(null);

  const roleCodes = useMemo(() => session?.availableRoleCodes ?? [], [session?.availableRoleCodes]);

  const mutation = useMutation({
    mutationFn: (roleCode: UserRoleCode) => switchRole(roleCode),
    onSuccess: (nextSession) => {
      queryClient.setQueryData(["session"], nextSession);
      setUser(nextSession);
      setActiveRole(nextSession.activeRole);
      router.push(getDefaultPortalRoute(nextSession.activeRoleCode));
    },
  });

  useEffect(() => {
    if (session && roleCodes.length <= 1) {
      router.replace(getDefaultPortalRoute(session.activeRoleCode));
    }
  }, [roleCodes.length, router, session]);

  return (
    <AuthShell title="FIA Smart ACR/PER" subtitle="Annual Confidential Report Management">
      <div>
        <h1 className="text-[1.55rem] font-semibold text-[#111827]">Select Your Role</h1>
        <p className="mt-1.5 text-sm text-[#6B7280]">
          Choose the session context to continue.
        </p>

        <div className="mt-5 space-y-2.5">
          {roleCodes.map((roleCode) => {
            const Icon = roleIcons[roleCode] ?? FileText;
            const selected = selectedRole === roleCode;
            return (
              <button
                key={roleCode}
                type="button"
                onClick={() => setSelectedRole(roleCode)}
                className={`flex w-full items-start gap-3 rounded-2xl border px-4 py-3.5 text-left transition-all ${
                  selected
                    ? "border-[#0095D9] bg-[#EEF6FC] shadow-[0_12px_24px_rgba(0,149,217,0.08)]"
                    : "border-[#E5E7EB] bg-white hover:border-[#CBD5E1]"
                }`}
              >
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#F4F6FB] text-[#9CA3AF]">
                    <Icon size={18} />
                  </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-[#111827]">{getRoleLabel(roleCode)}</p>
                      <p className="mt-0.5 text-sm leading-5 text-[#6B7280]">{roleMetadata[roleCode]?.description}</p>
                    </div>
                    <span
                      className={`mt-1 h-5 w-5 rounded-full border transition-all ${
                        selected ? "border-[#0095D9] bg-[#0095D9]" : "border-[#E5E7EB] bg-[#F8FAFC]"
                      }`}
                    />
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <button
          disabled={!selectedRole || mutation.isPending}
          onClick={() => selectedRole && mutation.mutate(selectedRole)}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#D0D5E1] py-3 text-[15px] font-semibold text-white transition-colors enabled:bg-[#1A1C6E] enabled:hover:bg-[#2D308F] disabled:cursor-not-allowed"
        >
          Continue
        </button>
      </div>
    </AuthShell>
  );
}
