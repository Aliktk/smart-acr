"use client";

import dynamic from "next/dynamic";

const FIAOperationsMapInner = dynamic(
  () =>
    import("./FIAOperationsMap").then((m) => ({
      default: m.FIAOperationsMap,
    })),
  {
    ssr: false,
    loading: () => (
      <div
        className="rounded-2xl border border-[var(--fia-gray-200)] bg-[var(--fia-gray-100)] animate-pulse"
        style={{ height: 340 }}
      />
    ),
  },
);

export { FIAOperationsMapInner as FIAOperationsMap };
