const JACKFRUIT_SEARCH_PATTERN = /^(?:J|JF)\s*:\s*([1-9]\d*)$/i

export function formatJackfruitTreeNo(treeNo: string) {
  return `J:${treeNo}`
}

export function parseJackfruitTreeSearch(value: string): string | null {
  return value.trim().match(JACKFRUIT_SEARCH_PATTERN)?.[1] ?? null
}
