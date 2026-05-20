"use client"

export function SkeletonDashboard() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-32 rounded-xl border border-border bg-card p-4">
            <div className="h-9 w-9 rounded-lg bg-muted" />
            <div className="mt-8 h-3 w-20 rounded bg-muted" />
            <div className="mt-2 h-6 w-24 rounded bg-muted" />
          </div>
        ))}
      </div>
      <div className="h-48 rounded-xl border border-border bg-card p-3">
        <div className="h-full w-full rounded-lg bg-muted" />
      </div>
    </div>
  )
}
