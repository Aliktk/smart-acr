"use client";

import { CheckCircle2, AlertTriangle, Info, XCircle } from "lucide-react";

type FloatingToastTone = "success" | "info" | "warning" | "danger";

type FloatingToastProps = {
  title: string;
  message?: string;
  tone?: FloatingToastTone;
  visible: boolean;
};

const toneStyles: Record<FloatingToastTone, { icon: typeof CheckCircle2; shell: string; iconColor: string }> = {
  success: {
    icon: CheckCircle2,
    shell: "border-[#BBF7D0] bg-white/95 text-[#166534]",
    iconColor: "text-[#16A34A]",
  },
  info: {
    icon: Info,
    shell: "border-[#BAE6FD] bg-white/95 text-[#075985]",
    iconColor: "text-[#0284C7]",
  },
  warning: {
    icon: AlertTriangle,
    shell: "border-[#FDE68A] bg-white/95 text-[#92400E]",
    iconColor: "text-[#D97706]",
  },
  danger: {
    icon: XCircle,
    shell: "border-[#FECACA] bg-white/95 text-[#991B1B]",
    iconColor: "text-[#DC2626]",
  },
};

export function FloatingToast({ title, message, tone = "success", visible }: FloatingToastProps) {
  const visuals = toneStyles[tone];
  const Icon = visuals.icon;

  return (
    <div
      className={`pointer-events-none fixed right-5 top-24 z-50 transition-all duration-300 ${
        visible ? "translate-x-0 opacity-100" : "translate-x-6 opacity-0"
      }`}
      aria-hidden={!visible}
    >
      <div className={`max-w-[360px] rounded-[22px] border px-4 py-3 shadow-[0_18px_48px_rgba(15,23,42,0.14)] backdrop-blur ${visuals.shell}`}>
        <div className="flex items-start gap-3">
          <Icon size={18} className={`mt-0.5 shrink-0 ${visuals.iconColor}`} />
          <div>
            <p className="text-sm font-semibold">{title}</p>
            {message ? <p className="mt-1 text-sm leading-5 opacity-90">{message}</p> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
