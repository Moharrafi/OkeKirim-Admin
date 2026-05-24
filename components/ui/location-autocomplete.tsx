'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import {
  getLocationSuggestions,
  type LocationHistory,
} from '@/lib/utils/location'

interface LocationAutocompleteProps {
  value: string
  onChange: (value: string) => void
  onSelect: (value: string) => void
  placeholder: string
  history: LocationHistory[]
  icon?: React.ReactNode
  error?: string
}

function LocationAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder,
  history,
  icon,
  error,
}: LocationAutocompleteProps) {
  const [showSuggestions, setShowSuggestions] = React.useState(false)
  const [activeIndex, setActiveIndex] = React.useState(-1)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const blurTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null
  )

  const suggestions = React.useMemo(
    () => getLocationSuggestions(value, history),
    [value, history]
  )

  const hasSuggestions = suggestions.length > 0 && value.length >= 2

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    onChange(newValue)
    setShowSuggestions(true)
    setActiveIndex(-1)
  }

  const handleSelect = (suggestion: string) => {
    onSelect(suggestion)
    setShowSuggestions(false)
    setActiveIndex(-1)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!hasSuggestions || !showSuggestions) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setActiveIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : 0
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setActiveIndex((prev) =>
          prev > 0 ? prev - 1 : suggestions.length - 1
        )
        break
      case 'Enter':
        e.preventDefault()
        if (activeIndex >= 0 && activeIndex < suggestions.length) {
          handleSelect(suggestions[activeIndex])
        }
        break
      case 'Escape':
        setShowSuggestions(false)
        setActiveIndex(-1)
        break
    }
  }

  const handleFocus = () => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current)
      blurTimeoutRef.current = null
    }
    setShowSuggestions(true)
  }

  const handleBlur = () => {
    // Small delay to allow click on suggestion to register
    blurTimeoutRef.current = setTimeout(() => {
      setShowSuggestions(false)
      setActiveIndex(-1)
    }, 150)
  }

  React.useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current)
      }
    }
  }, [])

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        {icon && (
          <span className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
            {icon}
          </span>
        )}
        <Input
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          className={cn(icon && 'pl-9', error && 'border-destructive')}
          aria-invalid={!!error}
          aria-autocomplete="list"
          aria-expanded={showSuggestions && hasSuggestions}
          aria-controls="location-suggestions"
          aria-activedescendant={
            activeIndex >= 0 ? `suggestion-${activeIndex}` : undefined
          }
          role="combobox"
        />
      </div>

      {error && (
        <p className="text-destructive mt-1 text-sm" role="alert">
          {error}
        </p>
      )}

      {showSuggestions && hasSuggestions && (
        <ul
          id="location-suggestions"
          role="listbox"
          className="bg-popover border-border absolute z-50 mt-1 w-full overflow-hidden rounded-md border shadow-md"
        >
          {suggestions.map((suggestion, index) => (
            <li
              key={suggestion}
              id={`suggestion-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              className={cn(
                'cursor-pointer px-3 py-2 text-sm transition-colors',
                index === activeIndex
                  ? 'bg-accent text-accent-foreground'
                  : 'hover:bg-accent/50'
              )}
              onMouseDown={(e) => {
                // Prevent blur from firing before click
                e.preventDefault()
              }}
              onClick={() => handleSelect(suggestion)}
            >
              {suggestion}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export { LocationAutocomplete }
export type { LocationAutocompleteProps }
