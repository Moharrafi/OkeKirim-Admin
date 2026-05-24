'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/label'

interface FormFieldProps {
  label: string
  error?: string
  touched?: boolean
  children: React.ReactNode
  className?: string
}

function FormField({ label, error, touched, children, className }: FormFieldProps) {
  const showError = touched && !!error

  return (
    <div className={cn('flex w-full flex-col gap-1.5', className)}>
      <Label className="text-sm font-medium">{label}</Label>
      {children}
      {showError && (
        <p
          role="alert"
          className="text-destructive animate-in fade-in duration-200 text-sm"
        >
          {error}
        </p>
      )}
    </div>
  )
}

export { FormField }
export type { FormFieldProps }
