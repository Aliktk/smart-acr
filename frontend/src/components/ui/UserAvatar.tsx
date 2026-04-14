"use client";

import { useEffect, useState } from "react";

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
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const initial = name.trim().charAt(0).toUpperCase() || "F";
  const shellClassName = sizeClassName ?? "h-10 w-10";
  const labelClassName = textClassName ?? "text-sm";

  useEffect(() => {
    if (!src) {
      setBlobUrl(null);
      return;
    }

    let cancelled = false;
    fetch(src, { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error("Avatar fetch failed");
        return res.blob();
      })
      .then((blob) => {
        if (!cancelled) setBlobUrl(URL.createObjectURL(blob));
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  const showImage = Boolean(blobUrl) && !failed;

  return (
    <div
      className={`relative overflow-hidden rounded-full bg-[linear-gradient(135deg,var(--fia-navy)_0%,var(--fia-cyan)_100%)] text-white ${shellClassName} ${className}`}
    >
      {showImage ? (
        <img
          src={blobUrl ?? undefined}
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
