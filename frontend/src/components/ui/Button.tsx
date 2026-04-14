import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "accent" | "info" | "danger" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  children: ReactNode;
}

const base =
  "group inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 [&_svg]:transition-transform hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(15,23,42,0.08)] hover:[&_svg]:scale-110 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none";

const variants: Record<ButtonVariant, string> = {
  primary: `${base} bg-[var(--fia-navy,#1A1C6E)] text-white hover:bg-[var(--fia-navy-hover,#2D308F)]`,
  secondary: `${base} border border-[var(--fia-border,#D8DEE8)] bg-[var(--card)] text-[var(--fia-text-secondary,#475569)]`,
  accent: `${base} bg-[var(--fia-cyan,#0095D9)] text-white hover:bg-[var(--fia-cyan-hover,#0077B6)]`,
  info: `${base} border border-[var(--fia-cyan,#0095D9)] bg-[var(--fia-cyan-bg,#EEF8FF)] text-[var(--fia-info-text,#0369A1)]`,
  danger: `${base} border border-[#FECACA] bg-[var(--fia-danger-bg)] text-[#BE123C] dark:text-[#F87171] dark:border-[rgba(220,38,38,0.3)]`,
  ghost: `${base} text-[var(--fia-text-secondary,#475569)] hover:bg-[var(--fia-gray-50)]`,
};

export function Button({ variant = "primary", className, children, ...props }: ButtonProps) {
  return (
    <button type="button" className={`${variants[variant]}${className ? ` ${className}` : ""}`} {...props}>
      {children}
    </button>
  );
}
