"use client";

import { useState } from "react";

export function UserAvatar({
  name,
  src,
  sizeClassName,
  textClassName,
  className = "",
}: {
  name: string;
  src?: string | null;
  sizeClassName?: string;
  textClassName?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const initial = name.trim().charAt(0).toUpperCase() || "F";
  const shellClassName = sizeClassName ?? "h-10 w-10";
  const labelClassName = textClassName ?? "text-sm";
  const showImage = Boolean(src) && !failed;

  return (
    <div
      className={`relative overflow-hidden rounded-full bg-[linear-gradient(135deg,var(--fia-navy)_0%,var(--fia-cyan)_100%)] text-white ${shellClassName} ${className}`}
    >
      {showImage ? (
        <img
          src={src ?? undefined}
          alt={`${name} profile`}
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className={`flex h-full w-full items-center justify-center font-bold ${labelClassName}`}>{initial}</div>
      )}
    </div>
  );
}
