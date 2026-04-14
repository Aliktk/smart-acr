"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Eye, EyeOff, Lock, ShieldCheck, User } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { requestAuthChallenge } from "@/api/client";
import { AuthShell } from "@/components/auth/AuthShell";
import { useShell } from "@/hooks/useShell";
import { getDefaultPortalRoute } from "@/utils/portal-access";
import { loginSchema } from "@/validators/login.validator";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectAfterLogin = searchParams.get("redirect");
  const queryClient = useQueryClient();
  const { setUser, setActiveRole } = useShell();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [validationError, setValidationError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => requestAuthChallenge(username, password),
    onSuccess: (result) => {
      setValidationError(null);
      if (result.status === "authenticated") {
        queryClient.setQueryData(["session"], result.session);
        setUser(result.session);
        setActiveRole(result.session.activeRole);
        if (result.session.mustChangePassword) {
          router.push("/settings?tab=security&forcePassword=1");
          return;
        }
        if (result.session.availableRoleCodes.length > 1) {
          const roleUrl = redirectAfterLogin
            ? `/login/role?redirect=${encodeURIComponent(redirectAfterLogin)}`
            : "/login/role";
          router.push(roleUrl);
          return;
        }
        router.push(redirectAfterLogin ?? getDefaultPortalRoute(result.session.activeRoleCode));
        return;
      }

      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(
          "acr-auth-challenge",
          JSON.stringify({
            ...result,
            username,
            keepSignedIn,
            requestedAt: Date.now(),
          }),
        );
      }
      const verifyUrl = redirectAfterLogin
        ? `/login/verify?challenge=${encodeURIComponent(result.challengeId)}&redirect=${encodeURIComponent(redirectAfterLogin)}`
        : `/login/verify?challenge=${encodeURIComponent(result.challengeId)}`;
      router.push(verifyUrl);
    },
  });

  return (
    <AuthShell
      title="FIA Smart ACR/PER"
      subtitle="Annual Confidential Report Management"
      footer={<span>Restricted government system — unauthorized access is prohibited</span>}
    >
      <div className="mb-5 text-center">
        <h1 className="text-[1.8rem] font-semibold text-[#111827] dark:text-slate-100">Sign In</h1>
        <p className="mt-1.5 text-sm text-[#6B7280] dark:text-slate-400">Use your FIA email, username, or badge number.</p>
      </div>

      {validationError || mutation.error ? (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400">
          <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
          {validationError ?? (mutation.error as Error).message}
        </div>
      ) : null}

      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          const parsed = loginSchema.safeParse({ username, password });
          if (!parsed.success) {
            setValidationError(parsed.error.issues[0]?.message ?? "Please review your credentials.");
            return;
          }

          setValidationError(null);
          mutation.mutate();
        }}
      >
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6B7280] dark:text-slate-400">
            Email / Username / Badge Number
          </label>
          <div className="relative">
            <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF] dark:text-slate-500" />
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="zahid.ullah@fia.gov.pk"
              autoComplete="username"
              className="w-full rounded-2xl border border-[#D8DEE8] bg-[#EEF2F7] py-3 pl-11 pr-4 text-[15px] text-[#111827] outline-none transition-all focus:border-[#0095D9] focus:bg-white focus:ring-4 focus:ring-[#0095D9]/10 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:border-[#0095D9] dark:focus:bg-slate-800"
            />
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6B7280] dark:text-slate-400">Password</label>
          </div>
          <div className="relative">
            <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF] dark:text-slate-500" />
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              className="w-full rounded-2xl border border-[#D8DEE8] bg-[#EEF2F7] py-3 pl-11 pr-12 text-[15px] text-[#111827] outline-none transition-all focus:border-[#0095D9] focus:bg-white focus:ring-4 focus:ring-[#0095D9]/10 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:border-[#0095D9] dark:focus:bg-slate-800"
            />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9CA3AF] transition-colors hover:text-[#6B7280] dark:text-slate-500 dark:hover:text-slate-300"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <label className="flex items-center gap-3 text-sm text-[#4B5563] dark:text-slate-300">
          <input
            type="checkbox"
            checked={keepSignedIn}
            onChange={(event) => setKeepSignedIn(event.target.checked)}
            className="h-4 w-4 rounded border border-[#CBD5E1] text-[#1A1C6E] focus:ring-[#1A1C6E] dark:border-slate-600"
          />
          Keep me signed in
        </label>

        <button
          type="submit"
          disabled={mutation.isPending}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#1A1C6E] py-3 text-[15px] font-semibold text-white transition-colors hover:bg-[#2D308F] disabled:cursor-not-allowed disabled:bg-[#A5AEC0] dark:bg-[#2D308F] dark:hover:bg-[#3B3FA8] dark:disabled:bg-slate-700"
        >
          {mutation.isPending ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <ShieldCheck size={18} />}
          {mutation.isPending ? "Signing you in..." : "Secure Sign In"}
        </button>

        <div className="flex justify-center">
          <Link href="/forgot-password" className="text-sm font-medium text-[#64748B] transition-colors hover:text-[#1A1C6E] dark:text-slate-400 dark:hover:text-slate-200">
            Forgot password?
          </Link>
        </div>
      </form>
    </AuthShell>
  );
}
