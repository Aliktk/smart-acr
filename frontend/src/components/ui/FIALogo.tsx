const fiaLogoImg = "/api/assets/fia-logo?v=20260405";

/**
 * FIALogo — Official-style emblem for Federal Investigation Agency, Pakistan
 * Variants: "full" (icon + text), "icon" (emblem only), "horizontal" (icon + inline text)
 */

interface FIALogoProps {
  variant?: "full" | "icon" | "horizontal";
  size?: "sm" | "md" | "lg" | "xl";
  theme?: "dark" | "light" | "color";
  className?: string;
}

const sizes = {
  sm: { icon: 28, title: "text-[15px]", subtitle: "text-[11px]" },
  md: { icon: 40, title: "text-base", subtitle: "text-xs" },
  lg: { icon: 46, title: "text-lg", subtitle: "text-sm" },
  xl: { icon: 60, title: "text-xl", subtitle: "text-base" },
};

function FIAShield({ size = 40, theme = "color" }: { size?: number; theme?: "dark" | "light" | "color" }) {
  const shellClass =
    theme === "dark"
      ? "bg-white/10 ring-white/10"
      : "bg-[#F8FBFF] ring-[#DCE6F5] dark:bg-white/10 dark:ring-white/10";

  return (
    <div
      className={`flex items-center justify-center rounded-full ring-1 ${shellClass}`}
      style={{ width: size + 14, height: size + 14 }}
    >
      <img
        src={fiaLogoImg}
        alt="FIA Emblem"
        width={size}
        height={size}
        style={{ width: size, height: size, objectFit: "contain" }}
        loading="eager"
      />
    </div>
  );
}

export function FIALogo({ variant = "full", size = "md", theme = "dark", className = "" }: FIALogoProps) {
  const cfg = sizes[size];
  const titleColor = theme === "dark" ? "#FFFFFF" : "#1A1C6E";
  const subtitleColor = theme === "dark" ? "#4CC3F1" : "#0095D9";
  const metaColor = theme === "dark" ? "rgba(255,255,255,0.62)" : "#6B7280";

  if (variant === "icon") {
    return (
      <div className={className}>
        <FIAShield size={cfg.icon} theme={theme} />
      </div>
    );
  }

  if (variant === "horizontal") {
    return (
      <div className={`flex items-center gap-2.5 ${className}`}>
        <FIAShield size={cfg.icon} theme={theme} />
        <div className="min-w-0 text-center">
          <p
            className={`truncate font-semibold leading-none tracking-[0.01em] ${cfg.title}`}
            style={{ color: titleColor }}
          >
            FIA
          </p>
          <p
            className={`truncate font-medium leading-none tracking-[0.08em] ${cfg.subtitle}`}
            style={{ color: subtitleColor }}
          >
            Smart ACR / PER System
          </p>
        </div>
      </div>
    );
  }

  // full — stacked, centered
  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      <FIAShield size={cfg.icon} theme={theme} />
      <div className="text-center">
        <p
          className="font-bold tracking-[0.02em]"
          style={{
            color: titleColor,
            fontSize: size === "xl" ? "1.5rem" : size === "lg" ? "1.25rem" : "1.125rem",
          }}
        >
          FIA
        </p>
        <p
          className="mt-0.5 text-[10px] font-medium tracking-[0.04em]"
          style={{ color: metaColor }}
        >
          Federal Investigation Agency
        </p>
        <p
          className="mt-1 text-sm font-semibold tracking-[0.12em]"
          style={{ color: subtitleColor }}
        >
          Smart ACR / PER System
        </p>
      </div>
    </div>
  );
}
