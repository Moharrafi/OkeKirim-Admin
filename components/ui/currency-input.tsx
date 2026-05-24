'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'
import { formatCurrency, parseCurrency } from '@/lib/utils/currency'

interface CurrencyInputProps {
  value: number | string
  onChange: (value: number) => void
  min?: number
  max?: number
  error?: string
  placeholder?: string
}

/**
 * CurrencyInput component with auto-formatting for Indonesian Rupiah.
 * Displays "Rp" prefix, formats with thousand separators (dots),
 * accepts only numeric digits, and uses numeric keyboard on mobile.
 */
function CurrencyInput({
  value,
  onChange,
  min = 0,
  max = 99999999,
  error,
  placeholder = '0',
}: CurrencyInputProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)

  // Derive the display value from the numeric value
  const displayValue = React.useMemo(() => {
    const numericValue = typeof value === 'string' ? parseCurrency(value) : value
    if (numericValue === 0) return ''
    return formatCurrency(numericValue)
  }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawInput = e.target.value

    // Strip all non-digit characters
    const digitsOnly = rawInput.replace(/\D/g, '')

    // If empty, set to 0
    if (digitsOnly === '') {
      onChange(0)
      return
    }

    // Parse the numeric value
    const numericValue = parseInt(digitsOnly, 10)

    // Enforce max value
    if (numericValue > max) {
      onChange(max)
      return
    }

    onChange(numericValue)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Allow: backspace, delete, tab, escape, enter, arrows
    const allowedKeys = [
      'Backspace',
      'Delete',
      'Tab',
      'Escape',
      'Enter',
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'ArrowDown',
      'Home',
      'End',
    ]

    if (allowedKeys.includes(e.key)) return

    // Allow Ctrl/Cmd + A, C, V, X
    if ((e.ctrlKey || e.metaKey) && ['a', 'c', 'v', 'x'].includes(e.key.toLowerCase())) {
      return
    }

    // Block non-numeric keys
    if (!/^\d$/.test(e.key)) {
      e.preventDefault()
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div
        className={cn(
          'border-input dark:bg-input/30 relative flex w-full items-center rounded-md border shadow-xs transition-[color,box-shadow] outline-none',
          'h-9',
          'focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]',
          error && 'ring-destructive/20 dark:ring-destructive/40 border-destructive',
        )}
      >
        <span
          className="text-muted-foreground flex items-center justify-center pl-3 text-sm font-medium select-none"
          onClick={() => inputRef.current?.focus()}
        >
          Rp
        </span>
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          value={displayValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          aria-invalid={!!error}
          className={cn(
            'placeholder:text-muted-foreground flex-1 bg-transparent px-2 py-1 text-base outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
          )}
        />
      </div>
      {error && (
        <p className="text-destructive text-xs">{error}</p>
      )}
    </div>
  )
}

export { CurrencyInput }
export type { CurrencyInputProps }
