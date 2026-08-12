export const PERFORMANCE_CLASSIFICATIONS = [
  "Century Maker",
  "Match Winner",
  "Reliable Batter",
  "Tail Ender",
  "Bench Player",
  "Future Better",
] as const

export type PerformanceClassification = (typeof PERFORMANCE_CLASSIFICATIONS)[number]
export type ClassificationFilter = "All" | PerformanceClassification | "Unknown/unmatched"

export interface ClassificationStyle {
  fill: string
  border: string
  text: string
  selectedBorder: string
}

export const CLASSIFICATION_STYLES: Record<PerformanceClassification, ClassificationStyle> = {
  "Century Maker": {
    fill: "#166534",
    border: "#052e16",
    text: "#ffffff",
    selectedBorder: "#fef08a",
  },
  "Match Winner": {
    fill: "#15803d",
    border: "#14532d",
    text: "#ffffff",
    selectedBorder: "#fef08a",
  },
  "Reliable Batter": {
    fill: "#1d4ed8",
    border: "#1e3a8a",
    text: "#ffffff",
    selectedBorder: "#fef08a",
  },
  "Tail Ender": {
    fill: "#f59e0b",
    border: "#92400e",
    text: "#111827",
    selectedBorder: "#111827",
  },
  "Bench Player": {
    fill: "#b91c1c",
    border: "#7f1d1d",
    text: "#ffffff",
    selectedBorder: "#fef08a",
  },
  "Future Better": {
    fill: "#7e22ce",
    border: "#581c87",
    text: "#ffffff",
    selectedBorder: "#fef08a",
  },
}

export const UNKNOWN_CLASSIFICATION_STYLE: ClassificationStyle = {
  fill: "#64748b",
  border: "#0f172a",
  text: "#ffffff",
  selectedBorder: "#fef08a",
}

export function isPerformanceClassification(value: unknown): value is PerformanceClassification {
  return PERFORMANCE_CLASSIFICATIONS.includes(value as PerformanceClassification)
}

export function classificationStyle(value: string | null | undefined): ClassificationStyle {
  return isPerformanceClassification(value)
    ? CLASSIFICATION_STYLES[value]
    : UNKNOWN_CLASSIFICATION_STYLE
}

export function classificationFilterKey(
  value: string | null | undefined,
): PerformanceClassification | "Unknown/unmatched" {
  return isPerformanceClassification(value) ? value : "Unknown/unmatched"
}
