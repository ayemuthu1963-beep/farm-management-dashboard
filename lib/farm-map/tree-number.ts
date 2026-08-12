const TREE_NUMBER_PATTERN = /^\d+(?:\.\d+)?$/

export function canonicalTreeNo(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null

  const text = String(value).trim()
  if (!TREE_NUMBER_PATTERN.test(text)) return null

  const [rawWhole, rawFraction] = text.split(".")
  const whole = rawWhole.replace(/^0+(?=\d)/, "") || "0"
  const fraction = rawFraction?.replace(/0+$/, "")
  return fraction ? `${whole}.${fraction}` : whole
}
