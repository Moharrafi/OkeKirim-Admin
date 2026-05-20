"use client"

export function SkeletonDashboard() {
  return (
    <div className="space-y-5 animate-pulse">
      {/* Hero card skeleton */}
      <div className="rounded-2xl bg-muted/50 h-32 p-5">
        <div className="h-3 w-48 bg-muted rounded" />
        <div className="h-8 w-40 bg-muted rounded mt-3" />
        <div className="h-3 w-32 bg-muted rounded mt-3" />
      </div>

      {/* Quick actions skeleton */}
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-24 rounded-2xl bg-muted/50" />
        ))}
      </div>

      {/* Stats skeleton */}
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-28 rounded-2xl bg-muted/50 p-4">
            <div className="h-8 w-8 bg-muted rounded-xl" />
            <div className="h-5 w-24 bg-muted rounded mt-3" />
            <div className="h-3 w-20 bg-muted rounded mt-2" />
          </div>
        ))}
      </div>
    </div>
  )
}
