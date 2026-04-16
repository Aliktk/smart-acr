// Dashboard semantic color tokens — never hardcode hex values in chart components
export const DT = {
  // Sapphire — primary metrics, active states
  sapphire: {
    50:  "#EEF2FF", 100: "#E0E7FF", 200: "#C7D2FE",
    300: "#A5B4FC", 400: "#818CF8", 500: "#6366F1",
    600: "#4F46E5", 700: "#4338CA", 800: "#3730A3", 900: "#312E81",
  },
  // Teal — completion, success, archived
  teal: {
    50:  "#F0FDFA", 100: "#CCFBF1", 200: "#99F6E4",
    300: "#5EEAD4", 400: "#2DD4BF", 500: "#14B8A6",
    600: "#0D9488", 700: "#0F766E", 800: "#115E59", 900: "#134E4A",
  },
  // Amber — pending, in-progress
  amber: {
    50:  "#FFFBEB", 100: "#FEF3C7", 200: "#FDE68A",
    300: "#FCD34D", 400: "#FBBF24", 500: "#F59E0B",
    600: "#D97706", 700: "#B45309", 800: "#92400E", 900: "#78350F",
  },
  // Crimson — overdue, exceptions, returned
  crimson: {
    50:  "#FFF1F2", 100: "#FFE4E6", 200: "#FECDD3",
    300: "#FDA4AF", 400: "#FB7185", 500: "#F43F5E",
    600: "#E11D48", 700: "#BE123C", 800: "#9F1239", 900: "#881337",
  },
  // Violet — Secret Branch operations
  violet: {
    50:  "#F5F3FF", 100: "#EDE9FE", 200: "#DDD6FE",
    300: "#C4B5FD", 400: "#A78BFA", 500: "#8B5CF6",
    600: "#7C3AED", 700: "#6D28D9", 800: "#5B21B6", 900: "#4C1D95",
  },
  // Slate — neutral structural
  slate: {
    50:  "#F8FAFC", 100: "#F1F5F9", 200: "#E2E8F0",
    300: "#CBD5E1", 400: "#94A3B8", 500: "#64748B",
    600: "#475569", 700: "#334155", 800: "#1E293B", 900: "#0F172A",
  },
} as const;

// 8-color categorical palette — vivid, harmonious and distinct
export const CHART_PALETTE = [
  "#4F46E5",  // indigo-600 — strong primary
  "#0D9488",  // teal-600 — vivid success
  "#F59E0B",  // amber-500 — warm pending
  "#E11D48",  // rose-600 — strong overdue
  "#7C3AED",  // violet-600 — secret branch
  "#0EA5E9",  // sky-500 — medium blue
  "#10B981",  // emerald-500 — fresh green
  "#F97316",  // orange-500 — warm accent
] as const;

export function getAreaGradient(color: string, opacity = 0.4): [string, string] {
  return [color + Math.round(opacity * 255).toString(16).padStart(2, "0"), color + "00"];
}
