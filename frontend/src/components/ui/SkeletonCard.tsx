"use client";

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-2xl bg-[var(--fia-gray-100)] dark:bg-[var(--fia-gray-800,#1e293b)] ${className ?? ""}`}
    />
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 p-6">
      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <SkeletonCard key={i} className="h-[100px]" />
        ))}
      </div>
      {/* Pipeline + side panel */}
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <SkeletonCard className="h-[140px]" />
        <SkeletonCard className="h-[140px]" />
      </div>
      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-3">
        <SkeletonCard className="h-[260px]" />
        <SkeletonCard className="h-[260px]" />
        <SkeletonCard className="h-[260px]" />
      </div>
    </div>
  );
}
