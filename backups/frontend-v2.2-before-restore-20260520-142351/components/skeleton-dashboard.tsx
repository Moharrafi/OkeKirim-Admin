"use client"

export function SkeletonDashboard() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="h-3 w-24 rounded bg-muted" />
        <div className="mt-3 h-7 w-40 rounded bg-muted" />
        <div className="mt-3 h-3 w-52 rounded bg-muted" />
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="h-20 rounded-xl bg-muted/70" />
          <div className="h-20 rounded-xl bg-muted/70" />
        </div>
      </div>
      <div className="h-48 rounded-xl border border-border bg-card p-3">
        <div className="h-full w-full rounded-lg bg-muted" />
      </div>
    </div>
  )
}
