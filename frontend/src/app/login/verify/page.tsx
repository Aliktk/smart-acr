"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, RefreshCw, Smartphone } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { resendAuthChallenge, verifyAuthChallenge } from "@/api/client";
import { AuthShell } from "@/components/auth/AuthShell";
import { useShell } from "@/hooks/useShell";
import { getDefaultPortalRoute } from "@/utils/portal-access";

type StoredChallenge = {
  status?: "challenge_required";
  challengeId: string;
  expiresInSeconds: number;
  expiresAt?: string;
  maskedDestination: string;
  demoCode?: string;
  username?: string;
  keepSignedIn?: boolean;
  requestedAt?: number;
};

const DIGIT_LENGTH = 6;
const DEFAULT_EXPIRY_SECONDS = 105;

function readStoredChallenge() {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.sessionStorage.getItem("acr-auth-challenge");
  return raw ? (JSON.parse(raw) as StoredChallenge) : null;
}

function resolveExpiryTimestamp(challenge: StoredChallenge | null) {
  if (!challenge) {
    return Date.now() + DEFAULT_EXPIRY_SECONDS * 1000;
  }

  if (challenge.expiresAt) {
    const parsed = Date.parse(challenge.expiresAt);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  const requestedAt = challenge.requestedAt ?? Date.now();
  return requestedAt + challenge.expiresInSeconds * 1000;
}

function secondsUntilExpiry(expiresAt: number) {
  return Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
}

function VerifyPageContent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const { setUser, setActiveRole } = useShell();
  const challengeId = searchParams.get("challenge");
  const [storedChallenge, setStoredChallenge] = useState<StoredChallenge | null>(null);
  const [digits, setDigits] = useState(Array.from({ length: DIGIT_LENGTH }, () => ""));
  const [remainingSeconds, setRemainingSeconds] = useState(DEFAULT_EXPIRY_SECONDS);

  useEffect(() => {
    const nextChallenge = readStoredChallenge();
    setStoredChallenge(nextChallenge);

    if (!challengeId || !nextChallenge || nextChallenge.challengeId !== challengeId) {
      router.replace("/login");
      return;
    }

    setRemainingSeconds(secondsUntilExpiry(resolveExpiryTimestamp(nextChallenge)));
  }, [challengeId, router]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setRemainingSeconds(secondsUntilExpiry(resolveExpiryTimestamp(readStoredChallenge())));
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const code = useMemo(() => digits.join(""), [digits]);

  const verifyMutation = useMutation({
    mutationFn: () => verifyAuthChallenge(challengeId ?? "", code),
    onSuccess: (session) => {
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem("acr-auth-challenge");
      }
      queryClient.setQueryData(["session"], session);
      setUser(session);
      setActiveRole(session.activeRole);
      router.push(
        session.availableRoleCodes.length > 1 ? "/login/role" : getDefaultPortalRoute(session.activeRoleCode),
      );
    },
  });

  const resendMutation = useMutation({
    mutationFn: () => resendAuthChallenge(challengeId ?? ""),
    onSuccess: (challenge) => {
      const nextChallenge = {
        ...storedChallenge,
        ...challenge,
        requestedAt: Date.now(),
      };
      setStoredChallenge(nextChallenge);
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem("acr-auth-challenge", JSON.stringify(nextChallenge));
      }
      setDigits(Array.from({ length: DIGIT_LENGTH }, () => ""));
      setRemainingSeconds(secondsUntilExpiry(resolveExpiryTimestamp(nextChallenge)));
    },
  });

  function updateDigit(index: number, value: string) {
    const sanitized = value.replace(/\D/g, "").slice(-1);
    setDigits((current) => {
      const next = [...current];
      next[index] = sanitized;
      return next;
    });
  }

  return (
    <AuthShell
      title="FIA Smart ACR/PER"
      subtitle="Annual Confidential Report Management"
      footer={<span>Restricted government system — unauthorized access is prohibited</span>}
    >
      <div className="mx-auto max-w-[360px] text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[20px] bg-[#EEF6FC] text-[#0095D9]">
          <Smartphone size={26} />
        </div>
        <h1 className="mt-4 text-[1.65rem] font-semibold text-[#111827]">Two-Factor Verification</h1>
        <p className="mt-1.5 text-sm leading-6 text-[#6B7280]">
          A 6-digit code was sent to your registered mobile <br />
          <span className="font-semibold text-[#111827]">{storedChallenge?.maskedDestination ?? "ending in **23"}</span>
        </p>

        <div className="mt-6 flex justify-center gap-2">
          {digits.map((digit, index) => (
            <input
              key={`otp-${index}`}
              value={digit}
              onChange={(event) => updateDigit(index, event.target.value)}
              inputMode="numeric"
              maxLength={1}
              className="h-12 w-11 rounded-2xl border border-[#1A1C6E] bg-[#F8FAFC] text-center text-xl font-semibold text-[#111827] outline-none transition-all focus:border-[#0095D9] focus:ring-4 focus:ring-[#0095D9]/10"
            />
          ))}
        </div>

        <div className="mt-5 h-[3px] w-full rounded-full bg-[#D9EEF9]">
          <div
            className="h-[3px] rounded-full bg-[#0095D9] transition-all"
            style={{ width: `${(code.length / DIGIT_LENGTH) * 100}%` }}
          />
        </div>
        <p className="mt-2 text-sm text-[#9CA3AF]">{code.length}/6 digits entered</p>
        <p className="mt-3 text-sm text-[#6B7280]">
          Code expires in{" "}
          <span className="font-semibold text-[#1A1C6E]">
            {String(Math.floor(remainingSeconds / 60)).padStart(2, "0")}:{String(remainingSeconds % 60).padStart(2, "0")}
          </span>
        </p>
        {storedChallenge?.demoCode ? (
          <p className="mt-2 text-xs text-[#9CA3AF]">Development code: {storedChallenge.demoCode}</p>
        ) : null}

        {verifyMutation.error ? (
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-3.5 text-left text-sm text-red-700">
            <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
            {(verifyMutation.error as Error).message}
          </div>
        ) : null}

        <button
          onClick={() => verifyMutation.mutate()}
          disabled={code.length !== DIGIT_LENGTH || remainingSeconds <= 0 || verifyMutation.isPending}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#1A1C6E] py-3 text-[15px] font-semibold text-white transition-colors hover:bg-[#2D308F] disabled:cursor-not-allowed disabled:bg-[#A5AEC0]"
        >
          {verifyMutation.isPending ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : null}
          Verify & Continue
        </button>

        <div className="mt-4 flex items-center justify-center gap-4 text-sm">
          <button
            onClick={() => resendMutation.mutate()}
            disabled={remainingSeconds > 0 || resendMutation.isPending}
            className="inline-flex items-center gap-2 text-[#9CA3AF] transition-colors enabled:hover:text-[#0095D9] disabled:cursor-not-allowed"
          >
            <RefreshCw size={14} />
            Resend Code
          </button>
          <span className="text-[#D1D5DB]">|</span>
          <Link href="/login" className="inline-flex items-center gap-2 text-[#6B7280] transition-colors hover:text-[#1A1C6E]">
            <ArrowLeft size={14} />
            Back to Login
          </Link>
        </div>
      </div>
    </AuthShell>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={null}>
      <VerifyPageContent />
    </Suspense>
  );
}
