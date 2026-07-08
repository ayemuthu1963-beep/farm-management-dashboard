// Mock data for the Pipeline Layout & Inspection dashboard. No backend — static.
// Tracks irrigation network segments, inspection status and issues.

export interface PipelineSummary {
  label: string
  value: string
  unit: string
  icon: "pipe" | "ok" | "leak" | "length"
}

export const pipelineSummary: PipelineSummary[] = [
  { label: "Total Segments", value: "24", unit: "in network", icon: "pipe" },
  { label: "Healthy", value: "19", unit: "no issues", icon: "ok" },
  { label: "Issues Found", value: "5", unit: "need repair", icon: "leak" },
  { label: "Network Length", value: "3.8", unit: "km total", icon: "length" },
]

export type SegmentStatus = "Healthy" | "Monitor" | "Leak"

export interface PipelineSegment {
  segmentId: string
  route: string
  material: string
  lengthM: number
  lastInspected: string
  status: SegmentStatus
}

export const pipelineSegments: PipelineSegment[] = [
  { segmentId: "P-01", route: "Well 1 → Plot 1", material: "PVC 90mm", lengthM: 320, lastInspected: "03-07-2026", status: "Healthy" },
  { segmentId: "P-02", route: "Plot 1 East line", material: "PVC 63mm", lengthM: 210, lastInspected: "03-07-2026", status: "Monitor" },
  { segmentId: "P-03", route: "Plot 1 West line", material: "PVC 63mm", lengthM: 190, lastInspected: "02-07-2026", status: "Leak" },
  { segmentId: "P-04", route: "Well 2 → Plot 2", material: "PVC 90mm", lengthM: 360, lastInspected: "04-07-2026", status: "Healthy" },
  { segmentId: "P-05", route: "Plot 2 East line", material: "PVC 63mm", lengthM: 230, lastInspected: "01-07-2026", status: "Leak" },
  { segmentId: "P-06", route: "Nutmeg feeder", material: "PVC 50mm", lengthM: 150, lastInspected: "05-07-2026", status: "Healthy" },
  { segmentId: "P-07", route: "Jackfruit feeder", material: "PVC 50mm", lengthM: 140, lastInspected: "05-07-2026", status: "Monitor" },
]

export type IssueSeverity = "Low" | "Medium" | "High"

export interface PipelineIssue {
  segmentId: string
  location: string
  issue: string
  reported: string
  severity: IssueSeverity
}

export const pipelineIssues: PipelineIssue[] = [
  { segmentId: "P-03", location: "Plot 1 West", issue: "Joint leak near valve 4", reported: "02-07-2026", severity: "High" },
  { segmentId: "P-05", location: "Plot 2 East", issue: "Cracked pipe section", reported: "01-07-2026", severity: "High" },
  { segmentId: "P-02", location: "Plot 1 East", issue: "Low pressure reported", reported: "03-07-2026", severity: "Medium" },
  { segmentId: "P-07", location: "Jackfruit feeder", issue: "Minor seepage at coupling", reported: "05-07-2026", severity: "Low" },
]
