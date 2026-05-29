'use client';

/* ===== Reusable Skeleton Patterns for Admin Panel ===== */

/** Dashboard overview skeleton */
export function AdminOverviewSkeleton() {
  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Live Event skeleton */}
      <div className="rounded-lg border border-red-500/10 bg-red-500/[0.02] overflow-hidden animate-pulse">
        <div className="flex items-center gap-2 px-4 py-3">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/20" />
          <div className="h-4 w-24 rounded bg-red-500/10" />
          <div className="h-4 w-6 rounded bg-red-500/10 ml-1" />
        </div>
        <div className="px-4 pb-3 space-y-2">
          <div className="h-12 rounded-lg bg-muted/15" />
        </div>
      </div>

      {/* Quick Action cards skeleton */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border/20 p-3 flex flex-col items-center gap-1.5 animate-pulse">
            <div className="w-8 h-8 rounded-lg bg-muted/20" />
            <div className="h-3 w-14 rounded bg-muted/20" />
            <div className="h-2 w-20 rounded bg-muted/10" />
          </div>
        ))}
      </div>

      {/* Season Progress skeleton */}
      <div className="rounded-lg border border-border/20 overflow-hidden animate-pulse">
        <div className="flex items-center gap-2 px-4 py-2.5">
          <div className="w-4 h-4 rounded bg-muted/20" />
          <div className="h-4 w-28 rounded bg-muted/20" />
        </div>
        <div className="px-4 pb-3 space-y-2">
          <div className="flex items-center gap-4">
            <div className="flex-1 h-2 rounded-full bg-muted/15" />
            <div className="h-3 w-16 rounded bg-muted/15" />
          </div>
          <div className="flex gap-1">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="w-3 h-1.5 rounded-full bg-muted/15" />
            ))}
          </div>
        </div>
      </div>

      {/* Two column skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Perlu Perhatian skeleton */}
        <div className="rounded-lg border border-border/20 overflow-hidden animate-pulse">
          <div className="flex items-center gap-2 px-4 py-2.5">
            <div className="w-4 h-4 rounded bg-muted/20" />
            <div className="h-4 w-28 rounded bg-muted/20" />
          </div>
          <div className="px-4 pb-3 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/10">
                <div className="w-8 h-8 rounded-md bg-muted/15" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-24 rounded bg-muted/15" />
                  <div className="h-2 w-20 rounded bg-muted/10" />
                </div>
                <div className="h-5 w-8 rounded bg-muted/15" />
              </div>
            ))}
          </div>
        </div>

        {/* Log Aktivitas skeleton */}
        <div className="rounded-lg border border-border/20 overflow-hidden animate-pulse">
          <div className="flex items-center gap-2 px-4 py-2.5">
            <div className="w-4 h-4 rounded bg-muted/20" />
            <div className="h-4 w-24 rounded bg-muted/20" />
          </div>
          <div className="px-4 pb-3 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-start gap-2.5 p-3 rounded-lg bg-muted/10">
                <div className="w-8 h-8 rounded-full bg-muted/15" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-32 rounded bg-muted/15" />
                  <div className="h-2 w-48 rounded bg-muted/10" />
                  <div className="h-2 w-20 rounded bg-muted/8" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Tournament list card skeleton */
export function TournamentCardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-lg border border-border/30 overflow-hidden animate-pulse">
          <div className="h-1 bg-muted/20" />
          <div className="p-4 sm:p-6 space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-2 flex-1">
                <div className="h-4 w-48 rounded bg-muted/20" />
                <div className="flex gap-2">
                  <div className="h-5 w-16 rounded bg-muted/15" />
                  <div className="h-5 w-24 rounded bg-muted/15" />
                  <div className="h-5 w-12 rounded bg-muted/15" />
                </div>
              </div>
              <div className="h-8 w-24 rounded bg-muted/15" />
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1 rounded-full bg-muted/15" />
              <div className="h-3 w-8 rounded bg-muted/10" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Generic content skeleton for simple panels */
export function ContentSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-5 w-32 rounded bg-muted/20" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-10 rounded-lg bg-muted/10" />
      ))}
    </div>
  );
}
