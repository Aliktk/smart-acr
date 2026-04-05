"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronDown, Search, X } from "lucide-react";

export interface SearchableSelectOption {
  id: string;
  label: string;
  description?: string;
  meta?: string;
}

type SearchableSelectProps = {
  label: ReactNode;
  value: string;
  options: SearchableSelectOption[];
  onChange: (value: string) => void;
  placeholder: string;
  emptyMessage: string;
  disabled?: boolean;
  invalid?: boolean;
};

export function SearchableSelect({
  label,
  value,
  options,
  onChange,
  placeholder,
  emptyMessage,
  disabled = false,
  invalid = false,
}: SearchableSelectProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selectedOption = useMemo(() => options.find((option) => option.id === value) ?? null, [options, value]);

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return options;
    }

    return options.filter((option) =>
      [option.label, option.description ?? "", option.meta ?? ""].some((valuePart) =>
        valuePart.toLowerCase().includes(normalizedQuery),
      ),
    );
  }, [options, query]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
        setQuery("");
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative text-sm text-[#475569]">
      <span className="block">{label}</span>
      <div
        className={`mt-2 rounded-2xl border border-[#D8DEE8] bg-white transition-all ${
          disabled
            ? "cursor-not-allowed opacity-60"
            : invalid
              ? "border-[#DC2626] ring-4 ring-[#DC2626]/10"
              : isOpen
                ? "border-[#0095D9] ring-4 ring-[#0095D9]/10"
                : ""
        }`}
      >
        <div className="flex items-center gap-2 px-4 py-3">
          <Search size={16} className="shrink-0 text-[#94A3B8]" />
          <input
            value={isOpen ? query : selectedOption?.label ?? ""}
            onChange={(event) => {
              setQuery(event.target.value);
              if (!isOpen) {
                setIsOpen(true);
              }
            }}
            onFocus={() => {
              if (!disabled) {
                setIsOpen(true);
              }
            }}
            placeholder={placeholder}
            disabled={disabled}
            className="min-w-0 flex-1 bg-transparent text-[#111827] outline-none placeholder:text-[#94A3B8]"
          />
          {value ? (
            <button
              type="button"
              onClick={() => {
                onChange("");
                setQuery("");
              }}
              disabled={disabled}
              className="rounded-full p-1 text-[#94A3B8] transition-colors hover:bg-[#F1F5F9] hover:text-[#475569]"
            >
              <X size={14} />
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              if (!disabled) {
                setIsOpen((current) => !current);
                if (isOpen) {
                  setQuery("");
                }
              }
            }}
            disabled={disabled}
            className="rounded-full p-1 text-[#94A3B8] transition-colors hover:bg-[#F1F5F9] hover:text-[#475569]"
          >
            <ChevronDown size={16} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
          </button>
        </div>

        {isOpen ? (
          <div className="border-t border-[#EEF2F7] px-2 py-2">
            <div className="max-h-64 overflow-y-auto">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((option) => {
                  const selected = option.id === value;

                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => {
                        onChange(option.id);
                        setQuery("");
                        setIsOpen(false);
                      }}
                      className={`w-full rounded-2xl px-3 py-3 text-left transition-colors ${
                        selected ? "bg-[#EEF8FF]" : "hover:bg-[#F8FAFC]"
                      }`}
                    >
                      <p className="font-semibold text-[#111827]">{option.label}</p>
                      {option.description ? <p className="mt-1 text-xs text-[#64748B]">{option.description}</p> : null}
                      {option.meta ? <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-[#94A3B8]">{option.meta}</p> : null}
                    </button>
                  );
                })
              ) : (
                <div className="px-3 py-6 text-center text-sm text-[#94A3B8]">{emptyMessage}</div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
