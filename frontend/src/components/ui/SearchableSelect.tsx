"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronDown, Search, X } from "lucide-react";

export interface SearchableSelectOption {
  id: string;
  label: string;
  description?: string;
  meta?: string;
  departments?: Array<{
    id: string;
    name: string;
    code: string;
  }>;
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

  const labelText = typeof label === "string" ? label : undefined;

  return (
    <div ref={containerRef} className="relative text-sm text-[var(--fia-text-secondary)]" role="combobox" aria-expanded={isOpen} aria-haspopup="listbox">
      <span className="block" id={labelText ? `label-${labelText.replace(/\s+/g, "-").toLowerCase()}` : undefined}>{label}</span>
      <div
        className={`mt-2 rounded-2xl border border-[var(--fia-border,#D8DEE8)] bg-[var(--card)] transition-all ${
          disabled
            ? "cursor-not-allowed opacity-60"
            : invalid
              ? "border-[#DC2626] ring-4 ring-[#DC2626]/10"
              : isOpen
                ? "border-[var(--fia-cyan,#0095D9)] ring-4 ring-[var(--fia-cyan,#0095D9)]/10"
                : ""
        }`}
      >
        <div className="flex items-center gap-2 px-4 py-3">
          <Search size={16} className="shrink-0 text-[var(--fia-gray-400)]" aria-hidden="true" />
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
            aria-label={labelText ?? placeholder}
            placeholder={placeholder}
            disabled={disabled}
            className="min-w-0 flex-1 bg-transparent text-[var(--fia-gray-900)] outline-none placeholder:text-[var(--fia-gray-400)]"
          />
          {value ? (
            <button
              type="button"
              onClick={() => {
                onChange("");
                setQuery("");
              }}
              disabled={disabled}
              className="rounded-full p-1 text-[var(--fia-gray-400)] transition-colors hover:bg-[var(--fia-gray-100)] hover:text-[var(--fia-gray-600)]"
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
            className="rounded-full p-1 text-[var(--fia-gray-400)] transition-colors hover:bg-[var(--fia-gray-100)] hover:text-[var(--fia-gray-600)]"
          >
            <ChevronDown size={16} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
          </button>
        </div>

        {isOpen ? (
          <div className="border-t border-[var(--fia-gray-200)] px-2 py-2">
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
                        selected ? "bg-[var(--fia-cyan-50)]" : "hover:bg-[var(--fia-gray-50)]"
                      }`}
                    >
                      <p className="font-semibold text-[var(--fia-gray-900)]">{option.label}</p>
                      {option.description ? <p className="mt-1 text-xs text-[var(--fia-gray-600)]">{option.description}</p> : null}
                      {option.meta ? <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-[var(--fia-gray-400)]">{option.meta}</p> : null}
                    </button>
                  );
                })
              ) : (
                <div className="px-3 py-6 text-center text-sm text-[var(--fia-gray-400)]">{emptyMessage}</div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
