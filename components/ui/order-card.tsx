'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { formatCurrency } from '@/lib/utils/currency'
import type { Order } from '@/lib/utils/orders'

interface OrderCardProps {
  order: Order
  index: number
  isOverdue: boolean
  isSelected?: boolean
  onSelect?: () => void
  onClick?: () => void
}

/**
 * Maximum number of cards that receive the stagger animation delay.
 * Cards beyond this index render without animation delay.
 */
const MAX_ANIMATED_CARDS = 20

function OrderCard({
  order,
  index,
  isOverdue,
  isSelected = false,
  onSelect,
  onClick,
}: OrderCardProps) {
  const shouldAnimate = index < MAX_ANIMATED_CARDS
  const animationDelay = shouldAnimate ? `${index * 50}ms` : '0ms'

  return (
    <Card
      data-slot="order-card"
      data-testid="order-card"
      role="button"
      tabIndex={0}
      aria-selected={isSelected}
      aria-label={`Order ${order.id} - ${order.driver}`}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick?.()
        }
      }}
      className={cn(
        'cursor-pointer transition-transform duration-100 ease-out',
        'active:scale-[0.98]',
        shouldAnimate && 'animate-stagger-fade-in',
        isOverdue && 'border-red-500 border-2',
        isSelected && 'ring-2 ring-primary bg-primary/5',
      )}
      style={shouldAnimate ? { animationDelay } : undefined}
    >
      <CardContent className="p-4">
        {/* Header: Order ID, type badge, and date */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {onSelect && (
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => onSelect()}
                onClick={(e) => e.stopPropagation()}
                aria-label={`Select order ${order.id}`}
              />
            )}
            <span className="text-xs text-muted-foreground font-mono">
              #{order.id}
            </span>
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-[10px] font-medium',
                order.type === 'online'
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                  : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
              )}
            >
              {order.type}
            </span>
          </div>
          <span className="text-xs text-muted-foreground">{order.date}</span>
        </div>

        {/* Driver info */}
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-sm font-semibold text-muted-foreground">
            {order.driver.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-medium leading-tight">{order.driver}</p>
            <p className="text-xs text-muted-foreground">{order.vehicle}</p>
          </div>
        </div>

        {/* Route: lokasi muat → lokasi bongkar */}
        <div className="flex items-center gap-1.5 mb-3 text-xs text-muted-foreground">
          <span className="h-2.5 w-2.5 rounded-full bg-green-500 flex-shrink-0" />
          <span className="truncate max-w-[100px]">{order.lokasiMuat}</span>
          <span className="text-muted-foreground/50">→</span>
          <span className="h-2.5 w-2.5 rounded-full bg-red-500 flex-shrink-0" />
          <span className="truncate max-w-[100px]">{order.lokasiBongkar}</span>
        </div>

        {/* Amount info */}
        <div className="flex items-center justify-between pt-3 border-t border-border">
          <div>
            <p className="text-[10px] text-muted-foreground">Sisa setoran</p>
            <p className="text-sm font-semibold">
              Rp {formatCurrency(order.sisa)}
            </p>
          </div>
          {isOverdue && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">
              Terlambat
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export { OrderCard }
export type { OrderCardProps }
