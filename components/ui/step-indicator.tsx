'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

interface StepIndicatorProps {
  steps: string[]
  currentStep: number
}

function StepIndicator({ steps, currentStep }: StepIndicatorProps) {
  return (
    <div data-slot="step-indicator" className="flex w-full items-center">
      {steps.map((step, index) => {
        const isCompleted = index < currentStep
        const isActive = index === currentStep
        const isFuture = index > currentStep
        const isLast = index === steps.length - 1

        return (
          <React.Fragment key={index}>
            {/* Step circle + label */}
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors',
                  isCompleted &&
                    'border-primary bg-primary text-primary-foreground',
                  isActive &&
                    'border-primary bg-primary text-primary-foreground',
                  isFuture &&
                    'border-muted-foreground/30 bg-muted text-muted-foreground/50',
                )}
              >
                {isCompleted ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 16 16"
                    fill="currentColor"
                    className="h-3.5 w-3.5"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  <span>{index + 1}</span>
                )}
              </div>
              <span
                className={cn(
                  'max-w-[72px] text-center text-[10px] leading-tight font-medium',
                  isCompleted && 'text-primary',
                  isActive && 'text-primary font-semibold',
                  isFuture && 'text-muted-foreground/50',
                )}
              >
                {step}
              </span>
            </div>

            {/* Connector line */}
            {!isLast && (
              <div
                className={cn(
                  'mx-1 mb-5 h-0.5 flex-1 rounded-full transition-colors',
                  index < currentStep ? 'bg-primary' : 'bg-muted-foreground/20',
                )}
              />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}

export { StepIndicator }
export type { StepIndicatorProps }
