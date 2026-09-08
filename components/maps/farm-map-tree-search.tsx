"use client"

import { useId, useMemo, useRef, useState } from "react"
import { compareTreeNumbers } from "@/lib/tree-number-options"
import type { FarmMapTree } from "@/lib/farm-map-trees"

export function FarmMapTreeSearch({ trees, loading, onSelect, onInvalidCommit }: {
  trees: FarmMapTree[]
  loading: boolean
  onSelect: (tree: FarmMapTree) => void
  onInvalidCommit: () => void
}) {
  const listId = useId()
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])
  const suggestions = useMemo(() => {
    const value = query.trim()
    return trees.filter((tree) => tree.treeNo.startsWith(value))
      .sort((left, right) => {
        const exact = Number(right.treeNo === value) - Number(left.treeNo === value)
        return exact || compareTreeNumbers(left.treeNo, right.treeNo) || left.crop.localeCompare(right.crop)
      }).slice(0, 25)
  }, [query, trees])

  function choose(tree: FarmMapTree) {
    setQuery(tree.treeNo)
    setOpen(false)
    setActiveIndex(-1)
    onSelect(tree)
  }

  return (
    <div className="relative grid gap-1.5">
      <label htmlFor="farm-map-tree-search" className="text-sm font-medium text-foreground">Tree Number</label>
      <input
        id="farm-map-tree-search"
        role="combobox"
        type="text"
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
        value={query}
        placeholder="Search all crops, e.g. 551.1"
        className="h-11 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 100)}
        onChange={(event) => { setQuery(event.target.value); setActiveIndex(-1); setOpen(true) }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault()
            if (!suggestions.length) return
            const next = event.key === "ArrowDown" ? Math.min(activeIndex + 1, suggestions.length - 1) : activeIndex <= 0 ? suggestions.length - 1 : activeIndex - 1
            setOpen(true)
            setActiveIndex(next)
            optionRefs.current[next]?.scrollIntoView({ block: "nearest" })
          } else if (event.key === "Enter") {
            event.preventDefault()
            const exact = trees.filter((tree) => tree.treeNo === query.trim())
            if (open && activeIndex >= 0 && suggestions[activeIndex]) choose(suggestions[activeIndex])
            else if (exact.length === 1) choose(exact[0])
            else if (exact.length > 1) { setOpen(true); setActiveIndex(0) }
            else { setOpen(false); onInvalidCommit() }
          } else if (event.key === "Escape" || event.key === "Tab") {
            setOpen(false)
            setActiveIndex(-1)
          }
        }}
      />
      {open ? (
        <div id={listId} role="listbox" aria-label="Matching trees by crop" className="absolute top-full z-[1000] mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-border bg-card p-1 shadow-xl">
          {loading ? <p className="p-3 text-sm">Loading tree numbers…</p> : suggestions.length ? suggestions.map((tree, index) => (
            <button
              key={tree.key}
              id={`${listId}-${index}`}
              ref={(element) => { optionRefs.current[index] = element }}
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => choose(tree)}
              className={`flex min-h-11 w-full items-center justify-between gap-2 rounded px-3 py-2 text-left text-sm ${index === activeIndex ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}
            >
              <span className="font-semibold">{tree.treeNo}</span>
              <span className="text-xs text-muted-foreground">{tree.crop}{tree.plot ? ` · ${tree.plot}` : ""}</span>
            </button>
          )) : <p className="p-3 text-sm">No valid Tree Number found.</p>}
        </div>
      ) : null}
    </div>
  )
}
