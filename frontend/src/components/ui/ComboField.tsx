"use client";

import { useEffect, useRef, useState } from "react";

interface ComboFieldProps {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  invalid?: boolean;
  maxLength?: number;
  muted?: boolean;
}

export function ComboField({
  label,
  value,
  options,
  onChange,
  placeholder = "Type or select",
  required = false,
  invalid = false,
  maxLength = 100,
  muted = false,
}: ComboFieldProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const trimmed = value.trim().toLowerCase();
  const filtered = trimmed
    ? options.filter((opt) => opt.toLowerCase().includes(trimmed))
    : options;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const fieldClass = `mt-2 w-full rounded-2xl border px-4 py-3 pr-10 outline-none transition-all ${
    muted ? "bg-[#F8FAFC] dark:bg-slate-800" : "bg-white"
  } ${
    invalid
      ? "border-[#DC2626] focus:border-[#DC2626] focus:ring-4 focus:ring-[#DC2626]/10"
      : "border-[#D8DEE8] dark:border-slate-700 focus:border-[#0095D9] focus:ring-4 focus:ring-[#0095D9]/10"
  }`;

  return (
    <div className="relative text-sm text-[#475569]" ref={ref}>
      <label>
        <span>
          {label}
          {required ? <span className="ml-1 text-[#DC2626]">*</span> : null}
        </span>
        <div className="relative">
          <input
            value={value}
            onChange={(e) => { onChange(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            maxLength={maxLength}
            placeholder={placeholder}
            aria-label={label}
            aria-invalid={invalid}
            className={fieldClass}
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setOpen((c) => !c)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#64748B]"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points={open ? "18 15 12 9 6 15" : "6 9 12 15 18 9"} />
            </svg>
          </button>
        </div>
      </label>
      {open && filtered.length > 0 ? (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-2xl border border-[var(--fia-border,#D8DEE8)] bg-[var(--fia-gray-50,#F8FAFC)] shadow-xl">
          <div className="max-h-48 overflow-y-auto overscroll-contain">
            {filtered.map((opt) => {
              const isSelected = value === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => { onChange(opt); setOpen(false); }}
                  className={`block w-full px-4 py-2.5 text-left text-sm transition ${
                    isSelected
                      ? "bg-[var(--fia-cyan-bg,#EEF8FF)] font-semibold text-[var(--fia-cyan,#0095D9)]"
                      : "text-[var(--fia-gray-800,#1f2937)] hover:bg-[var(--fia-gray-100,#F3F4F6)]"
                  }`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
