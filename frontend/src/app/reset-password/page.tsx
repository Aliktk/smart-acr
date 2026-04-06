"use client";

import { useMutation } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, KeyRound } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { resetPasswordWithToken } from "@/api/client";
import { AuthShell } from "@/components/auth/AuthShell";

function ResetPasswordPageContent() {
  const searchParams = useSearchParams();
  const [token, setToken] = useState(searchParams.get("token") ?? "");
  const [nextPassword, setNextPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const mutation = useMutation({
    mutationFn: () => resetPasswordWithToken(token, nextPassword),
  });

  const mismatch = nextPassword.length > 0 && confirmPassword.length > 0 && nextPassword !== confirmPassword;

  return (
    <AuthShell
      title="FIA Smart ACR/PER"
      subtitle="Reset Password"
      footer={<span>Password reset tokens are single-use and expire automatically.</span>}
    >
      <div className="mx-auto max-w-[420px]">
        <div className="mb-5 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[18px] bg-[#EEF6FC] text-[#0095D9]">
            <KeyRound size={24} />
          </div>
          <h1 className="mt-4 text-[1.8rem] font-semibold text-[#111827]">Set New Password</h1>
          <p className="mt-1.5 text-sm leading-6 text-[#6B7280]">Enter the reset token and a new password for your account.</p>
        </div>

        {mutation.error ? (
          <div className="mb-4 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700">
            <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
            {(mutation.error as Error).message}
          </div>
        ) : null}

        {mutation.isSuccess ? (
          <div className="rounded-2xl border border-[#BBF7D0] bg-[#F0FDF4] px-4 py-3 text-sm text-[#166534]">
            <div className="flex items-start gap-2">
              <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" />
              <div>
                <p>{mutation.data.message}</p>
                <Link href="/login" className="mt-2 inline-block font-semibold underline">
                  Return to login
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <label className="block space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#64748B]">Reset Token</span>
              <input value={token} onChange={(event) => setToken(event.target.value)} className="w-full rounded-2xl border border-[#D8DEE8] bg-[#EEF2F7] px-4 py-3 text-sm text-[#111827] outline-none transition focus:border-[#0095D9] focus:bg-white focus:ring-4 focus:ring-[#0095D9]/10" />
            </label>
            <label className="block space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#64748B]">New Password</span>
              <input type="password" value={nextPassword} onChange={(event) => setNextPassword(event.target.value)} className="w-full rounded-2xl border border-[#D8DEE8] bg-[#EEF2F7] px-4 py-3 text-sm text-[#111827] outline-none transition focus:border-[#0095D9] focus:bg-white focus:ring-4 focus:ring-[#0095D9]/10" />
            </label>
            <label className="block space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#64748B]">Confirm Password</span>
              <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="w-full rounded-2xl border border-[#D8DEE8] bg-[#EEF2F7] px-4 py-3 text-sm text-[#111827] outline-none transition focus:border-[#0095D9] focus:bg-white focus:ring-4 focus:ring-[#0095D9]/10" />
            </label>
            {mismatch ? <p className="text-sm text-[#DC2626]">The password and confirmation do not match.</p> : null}
            <button
              type="button"
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending || token.trim().length < 8 || nextPassword.length < 8 || mismatch}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#1A1C6E] py-3 text-[15px] font-semibold text-white transition-colors hover:bg-[#2D308F] disabled:cursor-not-allowed disabled:bg-[#A5AEC0]"
            >
              {mutation.isPending ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <KeyRound size={18} />}
              {mutation.isPending ? "Updating..." : "Update Password"}
            </button>
          </div>
        )}
      </div>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordPageContent />
    </Suspense>
  );
}
