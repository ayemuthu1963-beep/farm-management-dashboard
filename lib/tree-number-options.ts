export type TreePlot = "Plot 1" | "Plot 2"

export interface TreeNumberOption {
  key: string
  treeNo: string
  plot?: TreePlot
  status?: string
}

const treeNumberCollator = new Intl.Collator("en", {
  numeric: true,
  sensitivity: "base",
})

export function treeNumberOptionKey(treeNo: string, plot?: TreePlot) {
  return `${plot ?? ""}\u0000${treeNo}`
}

export function compareTreeNumbers(left: string, right: string) {
  return treeNumberCollator.compare(left, right)
}

export function rankTreeNumberOptions(
  options: readonly TreeNumberOption[],
  query: string,
  limit = 25,
) {
  const cleanQuery = query.trim().toLocaleLowerCase()
  const unique = new Map<string, TreeNumberOption>()

  for (const option of options) {
    if (!unique.has(option.key)) unique.set(option.key, option)
  }

  return [...unique.values()]
    .map((option) => {
      const candidate = option.treeNo.toLocaleLowerCase()
      const rank = !cleanQuery ? 1 : candidate === cleanQuery ? 0 : candidate.startsWith(cleanQuery) ? 1 : 2
      return { option, rank, matches: !cleanQuery || rank < 2 }
    })
    .filter((entry) => entry.matches)
    .sort((left, right) => {
      const rankCompare = left.rank - right.rank
      if (rankCompare !== 0) return rankCompare

      const treeCompare = compareTreeNumbers(left.option.treeNo, right.option.treeNo)
      if (treeCompare !== 0) return treeCompare

      return (left.option.plot ?? "").localeCompare(right.option.plot ?? "")
    })
    .slice(0, limit)
    .map((entry) => entry.option)
}

export function treeNumberSuggestionsUrl(query: string, limit = 25) {
  const params = new URLSearchParams({
    q: query.trim(),
    limit: String(limit),
  })
  return `/api/coconut-harvest/trees?${params.toString()}`
}
