"use client"

import { useEffect, useId, useMemo, useRef, useState } from "react"

import {
  rankTreeNumberOptions,
  type TreeNumberOption,
} from "@/lib/tree-number-options"

interface TreeNumberAutocompleteProps {
  id: string
  value: string
  options: readonly TreeNumberOption[]
  loading?: boolean
  loadError?: boolean
  disabled?: boolean
  placeholder?: string
  maxSuggestions?: number
  showPlot?: boolean
  onValueChange: (value: string) => void
  onSelect: (option: TreeNumberOption) => void
  onInvalidCommit: (value: string) => void
  onRetry?: () => void
}

export function TreeNumberAutocomplete({
  id,
  value,
  options,
  loading = false,
  loadError = false,
  disabled = false,
  placeholder = "Type or select a Tree Number",
  maxSuggestions = 25,
  showPlot = false,
  onValueChange,
  onSelect,
  onInvalidCommit,
  onRetry,
}: TreeNumberAutocompleteProps) {
  const instanceId = useId().replaceAll(":", "")
  const listboxId = `${id}-${instanceId}-listbox`
  const inputRef = useRef<HTMLInputElement | null>(null)
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  const suggestions = useMemo(
    () => rankTreeNumberOptions(options, value, maxSuggestions),
    [maxSuggestions, options, value],
  )

  useEffect(() => {
    setActiveIndex(-1)
  }, [options, value])

  useEffect(() => {
    if (activeIndex >= 0) optionRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" })
  }, [activeIndex])

  function choose(option: TreeNumberOption) {
    onValueChange(option.treeNo)
    onSelect(option)
    setOpen(false)
    setActiveIndex(-1)
  }

  function commitCurrentValue() {
    const cleanValue = value.trim()
    const exactOptions = options.filter((option) => option.treeNo === cleanValue)

    if (activeIndex >= 0 && suggestions[activeIndex]) {
      choose(suggestions[activeIndex])
      return
    }
    if (exactOptions.length === 1) {
      choose(exactOptions[0])
      return
    }
    if (exactOptions.length > 1) {
      setOpen(true)
      setActiveIndex(0)
      return
    }

    onInvalidCommit(cleanValue)
    setOpen(false)
  }

  const activeOption = activeIndex >= 0 ? suggestions[activeIndex] : undefined
  const activeOptionId = activeOption ? `${listboxId}-option-${activeIndex}` : undefined

  return (
    <div className="relative">
      <input
        ref={inputRef}
        id={id}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={activeOptionId}
        autoComplete="off"
        disabled={disabled}
        value={value}
        onFocus={() => {
          if (!disabled) setOpen(true)
        }}
        onBlur={() => window.setTimeout(() => setOpen(false), 100)}
        onChange={(event) => {
          onValueChange(event.target.value)
          setOpen(true)
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault()
            if (suggestions.length === 0) return
            setOpen(true)
            setActiveIndex((current) => Math.min(current + 1, suggestions.length - 1))
          } else if (event.key === "ArrowUp") {
            event.preventDefault()
            if (suggestions.length === 0) return
            setOpen(true)
            setActiveIndex((current) =>
              current <= 0 ? Math.max(suggestions.length - 1, 0) : current - 1,
            )
          } else if (event.key === "Enter") {
            event.preventDefault()
            commitCurrentValue()
          } else if (event.key === "Escape") {
            event.preventDefault()
            setOpen(false)
            setActiveIndex(-1)
          } else if (event.key === "Tab") {
            setOpen(false)
          }
        }}
        placeholder={placeholder}
        className="h-11 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
      />

      <div className="mt-1 min-h-4 text-xs text-muted-foreground" aria-live="polite">
        {loading ? <span>Loading tree numbers…</span> : null}
        {loadError ? (
          <button
            type="button"
            onClick={onRetry}
            className="font-semibold text-destructive underline underline-offset-2"
          >
            Unable to load Tree Numbers. Retry.
          </button>
        ) : null}
      </div>

      {open && !loading && !loadError ? (
        <div
          id={listboxId}
          role="listbox"
          className="absolute z-[1000] mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-border bg-card p-1 shadow-xl"
        >
          {suggestions.length > 0 ? (
            suggestions.map((option, index) => (
              <button
                ref={(element) => {
                  optionRefs.current[index] = element
                }}
                id={`${listboxId}-option-${index}`}
                key={option.key}
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => choose(option)}
                className={`flex min-h-11 w-full items-center justify-between gap-3 rounded px-3 py-2 text-left text-sm ${
                  index === activeIndex ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"
                }`}
              >
                <span className="font-semibold">{option.treeNo}</span>
                {showPlot && option.plot ? (
                  <span className="text-xs text-muted-foreground">{option.plot}</span>
                ) : null}
              </button>
            ))
          ) : (
            <p className="px-3 py-3 text-sm text-muted-foreground">No valid Tree Number found.</p>
          )}
        </div>
      ) : null}
    </div>
  )
}
