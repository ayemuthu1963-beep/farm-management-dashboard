export const PIPELINE_EQUIPMENT_TYPES = [
  "Unclassified",
  "Motor",
  "Main valve",
  "Valve",
  "Sub-valve",
  "Flush valve",
  "Bend",
  "Junction",
  "Reducer",
  "Other",
] as const
export const PIPELINE_ZONES = ["P1W", "P1E", "P2W", "P2E", "JF", "NM"] as const
export const PIPELINE_STATUSES = ["Imported", "Needs review", "Corrected", "Verified", "Ignored"] as const
export const PIPELINE_LINE_CLASSES = ["Mainline", "Sub-main", "Subline"] as const
export const PIPELINE_CONFIDENCE = ["High", "Medium", "Low", "Needs manual review"] as const

export type PipelineEquipmentType = (typeof PIPELINE_EQUIPMENT_TYPES)[number]
export type PipelineZone = (typeof PIPELINE_ZONES)[number]
export type PipelineStatus = (typeof PIPELINE_STATUSES)[number]
export type PipelineLineClass = (typeof PIPELINE_LINE_CLASSES)[number]
export type PipelineConfidence = (typeof PIPELINE_CONFIDENCE)[number]
export type VerificationStatus = "Draft" | "Needs review" | "Verified"

export type PipelineCapabilities = {
  username: string
  role: "admin" | "manager" | "viewer"
  environment: string
  canView: boolean
  canEdit: boolean
  editingScope: string
}

export type PipelineNode = {
  nodeId: string
  surveyIndex: number | null
  koboRecordId: string | null
  koboUuid: string | null
  sourceIdentifier: string
  originalLatitude: number | null
  originalLongitude: number | null
  currentLatitude: number
  currentLongitude: number
  gpsAccuracyMetres: number | null
  surveyDatetime: string | null
  equipmentType: PipelineEquipmentType
  secondaryEquipmentTags: string[]
  displayLabel: string
  motorName: string | null
  nearbyTreeNumbers: string[]
  irrigationZoneCodes: PipelineZone[]
  photoFilenames: string[]
  voiceFilename: string | null
  localSummary: string | null
  remarks: string | null
  confidenceLevel: PipelineConfidence
  status: PipelineStatus
  ignoreReason: string | null
  terminationApproved: boolean
  terminationReason: string | null
  movedDistanceMetres: number | null
  revision: number
}

export type PipelineSegment = {
  segmentId: string
  segmentCode: string
  startNodeId: string
  endNodeId: string
  geometry: { type: "LineString"; coordinates: [number, number][] }
  lineClass: PipelineLineClass | null
  pipeSizeValue: number | null
  pipeSizeUnit: "inch" | "millimetre" | null
  pipeMaterial: string | null
  sublineId: string | null
  irrigationZoneCodes: PipelineZone[]
  remarks: string | null
  verificationStatus: VerificationStatus
  revision: number
}

export type PipelineSubline = {
  sublineId: string
  sublineCode: string
  sublineName: string
  sourceNodeId: string | null
  irrigationZoneCodes: PipelineZone[]
  defaultPipeSizeValue: number | null
  defaultPipeSizeUnit: "inch" | "millimetre" | null
  nearbyTreeRangeStart: string | null
  nearbyTreeRangeEnd: string | null
  remarks: string | null
  verificationStatus: VerificationStatus
  segmentIds: string[]
  revision: number
}

export type PipelineValidation = {
  valid: boolean
  generatedAt: string
  summary: {
    nodeCount: number
    segmentCount: number
    sublineCount: number
    issueCount: number
    byCategory: Record<string, number>
    bySeverity: Record<string, number>
  }
  issues: Array<{
    category: string
    severity: "warning" | "error"
    entityType: "node" | "segment" | "subline" | null
    entityId: string | null
    message: string
  }>
}

export type PipelineTreeOption = {
  treeNo: string
  plot: string
  latitude: number
  longitude: number
}
