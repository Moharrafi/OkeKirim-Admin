"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Search, X } from "lucide-react"

interface SearchInputProps {
  placeholder?: string
  onSearch: (query: string) => void
  debounceMs?: number
  className?: string
}

/**
 * Isolated search input component that debounces internally.
 * Typing does NOT trigger parent re-renders until debounce fires.
 */
export function SearchInput({ placeholder = "Cari...", onSearch, debounceMs = 300, className }: SearchInputProps) {
  const [localValue, setLocalValue] = useState("")
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onSearchRef = useRef(onSearch)

  // Keep callback ref fresh without re-renders
  useEffect(() => {
    onSearchRef.current = onSearch
  }, [onSearch])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setLocalValue(val)

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      onSearchRef.current(val)
    }, debounceMs)
  }, [debounceMs])

  const handleClear = useCallback(() => {
    setLocalValue("")
    if (timerRef.current) clearTimeout(timerRef.current)
    onSearchRef.current("")
  }, [])

  return (
    <div className={`relative ${className || ""}`}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        type="text"
        placeholder={placeholder}
        value={localValue}
        onChange={handleChange}
        className="bg-secondary/50 border-border/50 pl-10 pr-10 h-10 rounded-xl text-sm"
      />
      {localValue && (
        <button
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted"
        >
          <X className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      )}
    </div>
  )
}
