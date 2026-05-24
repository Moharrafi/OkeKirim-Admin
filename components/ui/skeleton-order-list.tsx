"use client"

import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"

interface SkeletonOrderListProps {
  count?: number
}

export function SkeletonOrderList({ count = 3 }: SkeletonOrderListProps) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, index) => (
        <Card key={index} className="border-border bg-card">
          <CardContent className="p-4">
            {/* Header area: order ID, type badge, and date */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-8" />
                <Skeleton className="h-5 w-14 rounded-full" />
              </div>
              <Skeleton className="h-4 w-20" />
            </div>

            {/* Driver name and vehicle placeholder */}
            <div className="flex items-center gap-3 mb-3">
              <Skeleton className="h-9 w-9 rounded-xl" />
              <div>
                <Skeleton className="h-4 w-28 mb-1" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>

            {/* Location lines: lokasi muat → lokasi bongkar */}
            <div className="flex items-center gap-2 mb-3">
              <Skeleton className="h-3 w-3 rounded-full flex-shrink-0" />
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-3 flex-shrink-0" />
              <Skeleton className="h-3 w-3 rounded-full flex-shrink-0" />
              <Skeleton className="h-3 w-24" />
            </div>

            {/* Argo value area */}
            <div className="flex items-center justify-between pt-3 border-t border-border">
              <div>
                <Skeleton className="h-3 w-32 mb-1" />
                <Skeleton className="h-4 w-36" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
