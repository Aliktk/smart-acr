"use client";

import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { AlertCircle, ArrowLeft, KeyRound, MailCheck } from "lucide-react";
import { useState } from "react";
import { requestPasswordReset } from "@/api/client";
import { AuthShell } from "@/components/auth/AuthShell";

export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState("");
  const [demoToken, setDemoToken] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: () => requestPasswordReset(identifier),
    onSuccess: (result) => {
      setDemoToken(result.demoResetToken ?? null);
    },
  });

  return (
    <AuthShell
      title="FIA Smart ACR/PER"
      subtitle="Account Recovery"
      footer={<span>Use self-service reset only when it is enabled for your deployment.</span>}
    >
      <div className="mx-auto max-w-[420px]">
        <div className="mb-5 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[18px] bg-[#EEF6FC] text-[#0095D9]">
            <KeyRound size={24} />
          </div>
          <h1 className="mt-4 text-[1.8rem] font-semibold text-[#111827]">Forgot Password</h1>
          <p className="mt-1.5 text-sm leading-6 text-[#6B7280]">
            Enter your FIA email, username, or badge number. If self-service recovery is enabled, reset instructions will be issued.
          </p>
        </div>

        {mutation.error ? (
          <div className="mb-4 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700">
            <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
            {(mutation.error as Error).message}
          </div>
        ) : null}

        <div className="space-y-4">
          <label className="block space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#64748B]">Email / Username / Badge Number</span>
            <input
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              className="w-full rounded-2xl border border-[#D8DEE8] bg-[#EEF2F7] px-4 py-3 text-sm text-[#111827] outline-none transition focus:border-[#0095D9] focus:bg-white focus:ring-4 focus:ring-[#0095D9]/10"
            />
          </label>

          <button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || identifier.trim().length < 3}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#1A1C6E] py-3 text-[15px] font-semibold text-white transition-colors hover:bg-[#2D308F] disabled:cursor-not-allowed disabled:bg-[#A5AEC0]"
          >
            {mutation.isPending ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <MailCheck size={18} />}
            {mutation.isPending ? "Submitting..." : "Request Password Reset"}
          </button>

          {mutation.data ? (
            <div className="rounded-2xl border border-[#C7D2FE] bg-[#EEF2FF] px-4 py-3 text-sm text-[#3730A3]">
              <p>{mutation.data.message}</p>
              {demoToken ? (
                <p className="mt-2">
                  Development reset link:
                  {" "}
                  <Link href={`/reset-password?token=${encodeURIComponent(demoToken)}`} className="font-semibold underline">
                    Open reset page
                  </Link>
                </p>
              ) : null}
            </div>
          ) : null}

          <Link href="/login" className="inline-flex items-center gap-2 text-sm font-medium text-[#64748B] transition-colors hover:text-[#1A1C6E]">
            <ArrowLeft size={14} />
            Back to Login
          </Link>
        </div>
      </div>
    </AuthShell>
  );
}
