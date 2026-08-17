"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { LeafletMouseEvent } from "leaflet"
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Download,
  GitBranch,
  MapPinPlus,
  Pencil,
  Redo2,
  RefreshCw,
  Route,
  Save,
  Scissors,
  Search,
  Undo2,
  X,
} from "lucide-react"

import { Panel } from "@/components/farm/panel"
import type { LeafletApi, LeafletLayerGroup, LeafletMap } from "@/components/maps/farm-orthomosaic-map"
import { Button } from "@/components/ui/button"
import { pipelineDownload, pipelineRequest } from "@/lib/irrigation-pipeline-api"
import { nearestPipelineTrees, pipelineDistanceMetres } from "@/lib/irrigation-pipeline-geometry"
import {
  PIPELINE_CONFIDENCE,
  PIPELINE_EQUIPMENT_TYPES,
  PIPELINE_LINE_CLASSES,
  PIPELINE_STATUSES,
  PIPELINE_ZONES,
  type PipelineCapabilities,
  type PipelineConfidence,
  type PipelineEquipmentType,
  type PipelineLineClass,
  type PipelineNode,
  type PipelineSegment,
  type PipelineStatus,
  type PipelineSubline,
  type PipelineTreeOption,
  type PipelineValidation,
  type PipelineZone,
} from "@/lib/irrigation-pipeline-types"

type EditorTool = "select" | "move" | "add-node" | "draw" | "edit-pipe" | "split"
type DisplayMode = "line-class" | "zone" | "pipe-size" | "verification"

type NodeForm = {
  equipmentType: PipelineEquipmentType
  secondaryEquipmentTags: string
  displayLabel: string
  motorName: string
  nearbyTreeNumbers: string
  irrigationZoneCodes: PipelineZone[]
  remarks: string
  confidenceLevel: PipelineConfidence
  terminationApproved: boolean
  terminationReason: string
}

type SegmentForm = {
  segmentCode: string
  lineClass: PipelineLineClass | ""
  pipeSizeValue: string
  pipeSizeUnit: "inch" | "millimetre"
  pipeMaterial: string
  sublineId: string
  irrigationZoneCodes: PipelineZone[]
  remarks: string
  verificationStatus: "Draft" | "Needs review" | "Verified"
}

type DrawState = {
  startNodeId: string | null
  endNodeId: string | null
  coordinates: [number, number][]
}

type DraftSnapshot = {
  move: { nodeId: string; latitude: number; longitude: number } | null
  draw: DrawState
  segmentGeometry: [number, number][] | null
}

export type IrrigationPipelineEditorProps = {
  map: LeafletMap | null
  leaflet: LeafletApi | null
  trees: PipelineTreeOption[]
}

const NODE_COLOURS: Record<PipelineEquipmentType, string> = {
  Unclassified: "#dc2626",
  Motor: "#2563eb",
  "Main valve": "#15803d",
  Valve: "#16a34a",
  "Sub-valve": "#f97316",
  "Flush valve": "#7e22ce",
  Bend: "#111827",
  Junction: "#0f766e",
  Reducer: "#be123c",
  Other: "#475569",
}
const LINE_CLASS_COLOURS: Record<PipelineLineClass, string> = {
  Mainline: "#1d4ed8",
  "Sub-main": "#0f766e",
  Subline: "#ea580c",
}
const ZONE_COLOURS: Record<PipelineZone, string> = {
  P1W: "#1d4ed8",
  P1E: "#0891b2",
  P2W: "#15803d",
  P2E: "#65a30d",
  JF: "#ca8a04",
  NM: "#9333ea",
}
const CLOSE_LABEL_ZOOM = 20
const PIPE_SIZE_SUGGESTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4, 6, 8]

function formForNode(node: PipelineNode): NodeForm {
  return {
    equipmentType: node.equipmentType,
    secondaryEquipmentTags: node.secondaryEquipmentTags.join(", "),
    displayLabel: node.displayLabel,
    motorName: node.motorName ?? "",
    nearbyTreeNumbers: node.nearbyTreeNumbers.join(", "),
    irrigationZoneCodes: node.irrigationZoneCodes,
    remarks: node.remarks ?? "",
    confidenceLevel: node.confidenceLevel,
    terminationApproved: node.terminationApproved,
    terminationReason: node.terminationReason ?? "",
  }
}

function formForSegment(segment: PipelineSegment): SegmentForm {
  return {
    segmentCode: segment.segmentCode,
    lineClass: segment.lineClass ?? "",
    pipeSizeValue: segment.pipeSizeValue?.toString() ?? "",
    pipeSizeUnit: segment.pipeSizeUnit ?? "inch",
    pipeMaterial: segment.pipeMaterial ?? "",
    sublineId: segment.sublineId ?? "",
    irrigationZoneCodes: segment.irrigationZoneCodes,
    remarks: segment.remarks ?? "",
    verificationStatus: segment.verificationStatus,
  }
}

function commaValues(value: string) {
  return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))]
}

function nodeShape(type: PipelineEquipmentType) {
  if (type === "Motor") return "border-radius:2px"
  if (["Main valve", "Valve", "Sub-valve"].includes(type)) return "border-radius:50%"
  if (type === "Flush valve") return "border-radius:8px 8px 2px 2px"
  if (type === "Bend") return "transform:rotate(45deg);border-radius:2px"
  if (type === "Junction") return "clip-path:polygon(35% 0,65% 0,65% 35%,100% 35%,100% 65%,65% 65%,65% 100%,35% 100%,35% 65%,0 65%,0 35%,35% 35%)"
  if (type === "Reducer") return "clip-path:polygon(50% 0,100% 100%,0 100%)"
  return "border-radius:50%"
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;")
}

function iconForNode(
  leaflet: LeafletApi,
  node: PipelineNode,
  selected: boolean,
  closeZoom: boolean,
) {
  const ignored = node.status === "Ignored"
  const colour = ignored ? "#64748b" : NODE_COLOURS[node.equipmentType]
  const label = closeZoom
    ? `<span style="position:absolute;left:25px;top:-2px;white-space:nowrap;background:#111827;color:white;border:2px solid #fff;border-radius:5px;padding:2px 5px;font:700 11px/1.2 system-ui;box-shadow:0 1px 4px #0008">${escapeHtml(node.displayLabel)} · ${escapeHtml(node.equipmentType)}</span>`
    : ""
  const cross = ignored
    ? '<span style="position:absolute;left:1px;top:-4px;color:#dc2626;font:900 28px/1 system-ui">×</span>'
    : ""
  return leaflet.divIcon({
    className: "",
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    html: `<span aria-label="${escapeHtml(node.displayLabel)} ${escapeHtml(node.equipmentType)}" style="position:relative;display:block;width:24px;height:24px"><span style="position:absolute;inset:2px;background:${colour};border:3px solid ${selected ? "#fde047" : "#fff"};${nodeShape(node.equipmentType)};box-shadow:${selected ? "0 0 0 5px #facc15,0 2px 8px #000" : "0 0 0 1px #111827,0 2px 5px #0008"}"></span>${cross}${label}</span>`,
  })
}

function segmentColour(segment: PipelineSegment, mode: DisplayMode) {
  if (mode === "verification") {
    return segment.verificationStatus === "Verified"
      ? "#16a34a"
      : segment.verificationStatus === "Needs review"
        ? "#dc2626"
        : "#64748b"
  }
  if (mode === "zone") return ZONE_COLOURS[segment.irrigationZoneCodes[0]] ?? "#64748b"
  return segment.lineClass ? LINE_CLASS_COLOURS[segment.lineClass] : "#dc2626"
}

function segmentWidth(segment: PipelineSegment, mode: DisplayMode) {
  if (mode !== "pipe-size" || !segment.pipeSizeValue) return segment.lineClass === "Mainline" ? 7 : 5
  const millimetres = segment.pipeSizeUnit === "inch" ? segment.pipeSizeValue * 25.4 : segment.pipeSizeValue
  return Math.max(3, Math.min(13, 2 + millimetres / 20))
}

function inputClass() {
  return "h-9 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground"
}

function ZoneChecks({ value, onChange, disabled = false }: { value: PipelineZone[]; onChange: (next: PipelineZone[]) => void; disabled?: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      {PIPELINE_ZONES.map((zone) => (
        <label key={zone} className="flex items-center gap-1 rounded border border-border px-2 py-1 text-xs font-semibold">
          <input
            type="checkbox"
            checked={value.includes(zone)}
            disabled={disabled}
            onChange={(event) => onChange(event.target.checked ? [...value, zone] : value.filter((item) => item !== zone))}
            className="accent-primary"
          />
          {zone}
        </label>
      ))}
    </div>
  )
}

export function IrrigationPipelineEditor({ map, leaflet, trees }: IrrigationPipelineEditorProps) {
  const pipelineLayers = useRef<LeafletLayerGroup | null>(null)
  const draftLayers = useRef<LeafletLayerGroup | null>(null)
  const treeHighlightLayers = useRef<LeafletLayerGroup | null>(null)
  const [capabilities, setCapabilities] = useState<PipelineCapabilities | null>(null)
  const [nodes, setNodes] = useState<PipelineNode[]>([])
  const [segments, setSegments] = useState<PipelineSegment[]>([])
  const [sublines, setSublines] = useState<PipelineSubline[]>([])
  const [validation, setValidation] = useState<PipelineValidation | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("Loading Irrigation Pipeline…")
  const [layerEnabled, setLayerEnabled] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [smallScreen, setSmallScreen] = useState(false)
  const [tool, setTool] = useState<EditorTool>("select")
  const [displayMode, setDisplayMode] = useState<DisplayMode>("line-class")
  const [zoom, setZoom] = useState(18)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null)
  const [nodeForm, setNodeForm] = useState<NodeForm | null>(null)
  const [segmentForm, setSegmentForm] = useState<SegmentForm | null>(null)
  const [pendingMove, setPendingMove] = useState<DraftSnapshot["move"]>(null)
  const [manualDraft, setManualDraft] = useState<{ latitude: number; longitude: number } | null>(null)
  const [draw, setDraw] = useState<DrawState>({ startNodeId: null, endNodeId: null, coordinates: [] })
  const [segmentGeometry, setSegmentGeometry] = useState<[number, number][] | null>(null)
  const [past, setPast] = useState<DraftSnapshot[]>([])
  const [future, setFuture] = useState<DraftSnapshot[]>([])
  const [statusFilter, setStatusFilter] = useState<PipelineStatus | "All">("All")
  const [equipmentFilter, setEquipmentFilter] = useState<PipelineEquipmentType | "All">("All")
  const [zoneFilter, setZoneFilter] = useState<PipelineZone | "All">("All")
  const [surveyFilter, setSurveyFilter] = useState("")
  const [treeSearch, setTreeSearch] = useState("")
  const [highlightedTree, setHighlightedTree] = useState<string | null>(null)

  const selectedNode = useMemo(
    () => nodes.find((node) => node.nodeId === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  )
  const selectedSegment = useMemo(
    () => segments.find((segment) => segment.segmentId === selectedSegmentId) ?? null,
    [segments, selectedSegmentId],
  )
  const canEdit = Boolean(capabilities?.canEdit && !smallScreen)

  const currentNode = useCallback(
    (node: PipelineNode) =>
      pendingMove?.nodeId === node.nodeId
        ? { ...node, currentLatitude: pendingMove.latitude, currentLongitude: pendingMove.longitude }
        : node,
    [pendingMove],
  )

  const visibleNodes = useMemo(() => {
    const surveyIndex = surveyFilter.trim() ? Number(surveyFilter) : null
    return nodes.filter((node) => {
      if (statusFilter !== "All" && node.status !== statusFilter) return false
      if (equipmentFilter !== "All" && node.equipmentType !== equipmentFilter) return false
      if (zoneFilter !== "All" && !node.irrigationZoneCodes.includes(zoneFilter)) return false
      return surveyIndex === null || node.surveyIndex === surveyIndex
    })
  }, [equipmentFilter, nodes, statusFilter, surveyFilter, zoneFilter])

  const nearestTrees = useMemo(() => {
    if (!selectedNode) return []
    const node = currentNode(selectedNode)
    return nearestPipelineTrees(node.currentLatitude, node.currentLongitude, trees)
  }, [currentNode, selectedNode, trees])

  const snapshot = useCallback(
    (): DraftSnapshot => ({ move: pendingMove, draw, segmentGeometry }),
    [draw, pendingMove, segmentGeometry],
  )
  const mutateDraft = useCallback(
    (change: () => void) => {
      setPast((items) => [...items.slice(-49), snapshot()])
      setFuture([])
      change()
    },
    [snapshot],
  )
  const restoreSnapshot = useCallback((value: DraftSnapshot) => {
    setPendingMove(value.move)
    setDraw(value.draw)
    setSegmentGeometry(value.segmentGeometry)
  }, [])

  const loadNetwork = useCallback(async () => {
    setLoading(true)
    try {
      const [capability, nodeResult, segmentResult, sublineResult] = await Promise.all([
        pipelineRequest<PipelineCapabilities>("/capabilities"),
        pipelineRequest<{ items: PipelineNode[] }>("/nodes"),
        pipelineRequest<{ items: PipelineSegment[] }>("/segments"),
        pipelineRequest<{ items: PipelineSubline[] }>("/sublines"),
      ])
      setCapabilities(capability)
      setNodes(nodeResult.items)
      setSegments(segmentResult.items)
      setSublines(sublineResult.items)
      setMessage(`${nodeResult.items.length} nodes · ${segmentResult.items.length} segments · ${capability.canEdit ? "Admin editing available" : "Read-only"}.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Pipeline network could not be loaded.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadNetwork(), 0)
    return () => window.clearTimeout(timeout)
  }, [loadNetwork])
  useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)")
    const update = () => setSmallScreen(query.matches)
    update()
    query.addEventListener("change", update)
    return () => query.removeEventListener("change", update)
  }, [])
  useEffect(() => {
    if (!map) return
    const update = () => setZoom(map.getZoom())
    update()
    map.on("zoomend", update)
    return () => { map.off("zoomend", update) }
  }, [map])

  const selectNode = useCallback((node: PipelineNode) => {
    setSelectedNodeId(node.nodeId)
    if (tool !== "split") setSelectedSegmentId(null)
    setNodeForm(formForNode(node))
    if (tool !== "split") setSegmentForm(null)
  }, [tool])

  const selectSegment = useCallback((segment: PipelineSegment) => {
    setSelectedSegmentId(segment.segmentId)
    if (tool !== "split") setSelectedNodeId(null)
    setSegmentForm(formForSegment(segment))
    if (tool !== "split") setNodeForm(null)
    setSegmentGeometry(segment.geometry.coordinates)
  }, [tool])

  const handleDrawNode = useCallback((node: PipelineNode) => {
    const exact: [number, number] = [node.currentLongitude, node.currentLatitude]
    if (!draw.startNodeId) {
      if (!["Motor", "Main valve", "Valve", "Sub-valve", "Bend", "Junction", "Reducer"].includes(node.equipmentType)) {
        setMessage("Choose a motor, valve, bend, junction or reducer as the start node.")
        return
      }
      mutateDraft(() => setDraw({ startNodeId: node.nodeId, endNodeId: null, coordinates: [exact] }))
      selectNode(node)
      setMessage(`Start snapped to ${node.displayLabel}. Click route vertices, then another node.`)
      return
    }
    if (draw.startNodeId === node.nodeId || draw.endNodeId) return
    mutateDraft(() => setDraw((current) => ({ ...current, endNodeId: node.nodeId, coordinates: [...current.coordinates, exact] })))
    setSegmentForm({
      segmentCode: `SEG-${String(segments.length + 1).padStart(3, "0")}`,
      lineClass: "",
      pipeSizeValue: "",
      pipeSizeUnit: "inch",
      pipeMaterial: "",
      sublineId: "",
      irrigationZoneCodes: [],
      remarks: "",
      verificationStatus: "Draft",
    })
    setMessage(`End snapped to ${node.displayLabel}. Complete pipe details and Save.`)
  }, [draw, mutateDraft, segments.length, selectNode])

  useEffect(() => {
    if (!map || !leaflet) return
    pipelineLayers.current?.remove()
    const layers = leaflet.layerGroup()
    pipelineLayers.current = layers
    const linePane = map.getPane("pipeline-lines") ?? map.createPane("pipeline-lines")
    const nodePane = map.getPane("pipeline-nodes") ?? map.createPane("pipeline-nodes")
    linePane.style.zIndex = "450"
    nodePane.style.zIndex = "650"

    if (layerEnabled) {
      for (const segment of segments) {
        const coordinates =
          selectedSegmentId === segment.segmentId && segmentGeometry
            ? segmentGeometry
            : segment.geometry.coordinates
        const latLngs = coordinates.map(([longitude, latitude]) => [latitude, longitude] as [number, number])
        const selected = selectedSegmentId === segment.segmentId
        if (selected) {
          leaflet.polyline(latLngs, { pane: "pipeline-lines", color: "#fde047", weight: segmentWidth(segment, displayMode) + 7, opacity: 1, interactive: false }).addTo(layers)
        }
        const line = leaflet.polyline(latLngs, {
          pane: "pipeline-lines",
          color: segmentColour(segment, displayMode),
          weight: segmentWidth(segment, displayMode),
          opacity: 0.95,
          interactive: true,
        })
        line.bindTooltip(`${escapeHtml(segment.segmentCode)} · ${segment.pipeSizeValue ?? "?"} ${segment.pipeSizeUnit ?? ""} · ${segment.lineClass ?? "Unclassified"}`)
        line.on("click", (event: LeafletMouseEvent) => {
          leaflet.DomEvent.stopPropagation(event.originalEvent)
          selectSegment(segment)
        })
        line.addTo(layers)
        if (zoom >= CLOSE_LABEL_ZOOM) {
          const midpoint = coordinates[Math.floor(coordinates.length / 2)]
          const subline = sublines.find((item) => item.sublineId === segment.sublineId)
          const text = [
            segment.segmentCode,
            segment.pipeSizeValue ? `${segment.pipeSizeValue} ${segment.pipeSizeUnit ?? ""}` : "size?",
            subline?.sublineCode,
            segment.irrigationZoneCodes.join("/"),
          ].filter(Boolean).join(" · ")
          leaflet.marker([midpoint[1], midpoint[0]], {
            pane: "pipeline-nodes",
            interactive: false,
            icon: leaflet.divIcon({
              className: "",
              iconAnchor: [0, 0],
              html: `<span style="white-space:nowrap;background:#111827;color:#fff;border:2px solid #fff;border-radius:4px;padding:2px 4px;font:700 10px/1.2 system-ui;box-shadow:0 1px 4px #0008">${escapeHtml(text)}</span>`,
            }),
          }).addTo(layers)
        }
      }

      for (const rawNode of visibleNodes) {
        const node = currentNode(rawNode)
        const selected = selectedNodeId === node.nodeId
        const marker = leaflet.marker([node.currentLatitude, node.currentLongitude], {
          pane: "pipeline-nodes",
          icon: iconForNode(leaflet, node, selected, zoom >= CLOSE_LABEL_ZOOM),
          draggable: Boolean(editMode && tool === "move" && selected && canEdit),
          keyboard: true,
          riseOnHover: true,
        })
        marker.on("click", (event: LeafletMouseEvent) => {
          leaflet.DomEvent.stopPropagation(event.originalEvent)
          if (editMode && tool === "draw") handleDrawNode(node)
          else selectNode(node)
        })
        marker.on("dragend", () => {
          const location = marker.getLatLng()
          mutateDraft(() => setPendingMove({ nodeId: node.nodeId, latitude: location.lat, longitude: location.lng }))
          setMessage(`${node.displayLabel} moved locally. Save to persist or Undo move.`)
        })
        marker.addTo(layers)
      }
      layers.addTo(map)
    }
    return () => {
      layers.remove()
      if (pipelineLayers.current === layers) pipelineLayers.current = null
    }
  }, [canEdit, currentNode, displayMode, editMode, handleDrawNode, layerEnabled, leaflet, map, mutateDraft, segments, segmentGeometry, selectNode, selectSegment, selectedNodeId, selectedSegmentId, sublines, tool, visibleNodes, zoom])

  useEffect(() => {
    if (!map || !leaflet) return
    draftLayers.current?.remove()
    const layers = leaflet.layerGroup().addTo(map)
    draftLayers.current = layers
    if (selectedNode) {
      const node = currentNode(selectedNode)
      if (selectedNode.originalLatitude !== null && selectedNode.originalLongitude !== null) {
        leaflet.circleMarker([selectedNode.originalLatitude, selectedNode.originalLongitude], {
          radius: 10,
          color: "#111827",
          weight: 4,
          fillColor: "#ffffff",
          fillOpacity: 0.85,
          dashArray: "3 2",
          interactive: false,
          pane: "pipeline-nodes",
        }).bindTooltip("Original surveyed position", { permanent: false }).addTo(layers)
        if (pipelineDistanceMetres(selectedNode.originalLatitude, selectedNode.originalLongitude, node.currentLatitude, node.currentLongitude) > 0.01) {
          leaflet.polyline(
            [[selectedNode.originalLatitude, selectedNode.originalLongitude], [node.currentLatitude, node.currentLongitude]],
            { color: "#111827", weight: 3, dashArray: "7 6", opacity: 1, interactive: false, pane: "pipeline-lines" },
          ).addTo(layers)
        }
      }
    }
    if (draw.coordinates.length) {
      const latLngs = draw.coordinates.map(([longitude, latitude]) => [latitude, longitude] as [number, number])
      leaflet.polyline(latLngs, { color: "#fde047", weight: 8, dashArray: "8 6", opacity: 1, pane: "pipeline-lines" }).addTo(layers)
      for (const [longitude, latitude] of draw.coordinates) {
        leaflet.circleMarker([latitude, longitude], { radius: 5, color: "#111827", weight: 2, fillColor: "#fde047", fillOpacity: 1, pane: "pipeline-nodes" }).addTo(layers)
      }
    }
    if (editMode && tool === "edit-pipe" && selectedSegment && segmentGeometry) {
      segmentGeometry.slice(1, -1).forEach(([longitude, latitude], relativeIndex) => {
        const vertex = leaflet.marker([latitude, longitude], {
          draggable: true,
          pane: "pipeline-nodes",
          icon: leaflet.divIcon({ className: "", iconSize: [14, 14], iconAnchor: [7, 7], html: '<span style="display:block;width:14px;height:14px;border-radius:50%;background:#fde047;border:3px solid #111827"></span>' }),
        })
        vertex.on("dragend", () => {
          const location = vertex.getLatLng()
          mutateDraft(() => setSegmentGeometry((current) => {
            if (!current) return current
            const next = [...current]
            next[relativeIndex + 1] = [location.lng, location.lat]
            return next
          }))
        })
        vertex.addTo(layers)
      })
    }
    return () => { layers.remove() }
  }, [currentNode, draw.coordinates, editMode, leaflet, map, mutateDraft, segmentGeometry, selectedNode, selectedSegment, tool])

  useEffect(() => {
    if (!map || !leaflet || !editMode) return
    const onMapClick = (event: LeafletMouseEvent) => {
      if (tool === "add-node") {
        setManualDraft({ latitude: event.latlng.lat, longitude: event.latlng.lng })
        setNodeForm({
          equipmentType: "Unclassified", secondaryEquipmentTags: "", displayLabel: "", motorName: "",
          nearbyTreeNumbers: "", irrigationZoneCodes: [], remarks: "", confidenceLevel: "Needs manual review",
          terminationApproved: false, terminationReason: "",
        })
        setMessage("Manual node positioned. Complete the point details and Save.")
      } else if (tool === "draw" && draw.startNodeId && !draw.endNodeId) {
        mutateDraft(() => setDraw((current) => ({ ...current, coordinates: [...current.coordinates, [event.latlng.lng, event.latlng.lat]] })))
      }
    }
    map.on("click", onMapClick)
    return () => { map.off("click", onMapClick) }
  }, [draw.endNodeId, draw.startNodeId, editMode, leaflet, map, mutateDraft, tool])

  useEffect(() => {
    if (!map || !leaflet) return
    treeHighlightLayers.current?.remove()
    const layers = leaflet.layerGroup().addTo(map)
    treeHighlightLayers.current = layers
    const exact = trees.find((tree) => tree.treeNo === highlightedTree)
    const candidates = exact && !nearestTrees.some((tree) => tree.treeNo === exact.treeNo && tree.plot === exact.plot)
      ? [{ ...exact, distance: selectedNode ? pipelineDistanceMetres(currentNode(selectedNode).currentLatitude, currentNode(selectedNode).currentLongitude, exact.latitude, exact.longitude) : 0 }, ...nearestTrees]
      : nearestTrees
    for (const tree of candidates) {
      const selected = tree.treeNo === highlightedTree
      leaflet.circleMarker([tree.latitude, tree.longitude], {
        radius: selected ? 11 : 7,
        color: selected ? "#111827" : "#0e7490",
        weight: selected ? 4 : 3,
        fillColor: selected ? "#fde047" : "#67e8f9",
        fillOpacity: 0.45,
        pane: "pipeline-nodes",
      }).bindTooltip(`Tree ${escapeHtml(tree.treeNo)} · ${tree.distance.toFixed(1)} m`, { permanent: selected, direction: "top" }).addTo(layers)
    }
    return () => { layers.remove() }
  }, [currentNode, highlightedTree, leaflet, map, nearestTrees, selectedNode, trees])

  function undo() {
    const previous = past.at(-1)
    if (!previous) return
    setFuture((items) => [snapshot(), ...items])
    setPast((items) => items.slice(0, -1))
    restoreSnapshot(previous)
  }

  function redo() {
    const next = future[0]
    if (!next) return
    setPast((items) => [...items, snapshot()])
    setFuture((items) => items.slice(1))
    restoreSnapshot(next)
  }

  function clearDrafts() {
    setPendingMove(null)
    setManualDraft(null)
    setDraw({ startNodeId: null, endNodeId: null, coordinates: [] })
    setSegmentGeometry(selectedSegment?.geometry.coordinates ?? null)
    setPast([])
    setFuture([])
    if (selectedNode) setNodeForm(formForNode(selectedNode))
    if (selectedSegment) setSegmentForm(formForSegment(selectedSegment))
    setMessage("Unsaved pipeline edits cancelled.")
  }

  async function saveNode() {
    if (!nodeForm || (!selectedNode && !manualDraft)) return
    setBusy(true)
    try {
      let saved: PipelineNode
      if (manualDraft) {
        saved = await pipelineRequest<PipelineNode>("/nodes", {
          method: "POST",
          body: JSON.stringify({
            currentLatitude: manualDraft.latitude,
            currentLongitude: manualDraft.longitude,
            equipmentType: nodeForm.equipmentType,
            secondaryEquipmentTags: commaValues(nodeForm.secondaryEquipmentTags),
            displayLabel: nodeForm.displayLabel || undefined,
            motorName: nodeForm.motorName || null,
            nearbyTreeNumbers: commaValues(nodeForm.nearbyTreeNumbers),
            irrigationZoneCodes: nodeForm.irrigationZoneCodes,
            remarks: nodeForm.remarks || null,
            confidenceLevel: nodeForm.confidenceLevel,
            terminationApproved: nodeForm.terminationApproved,
            terminationReason: nodeForm.terminationReason || null,
          }),
        })
        setManualDraft(null)
      } else {
        let revision = selectedNode!.revision
        const nextFields = {
          equipmentType: nodeForm.equipmentType,
          secondaryEquipmentTags: commaValues(nodeForm.secondaryEquipmentTags),
          displayLabel: nodeForm.displayLabel,
          motorName: nodeForm.motorName || null,
          nearbyTreeNumbers: commaValues(nodeForm.nearbyTreeNumbers),
          irrigationZoneCodes: nodeForm.irrigationZoneCodes,
          remarks: nodeForm.remarks || null,
          confidenceLevel: nodeForm.confidenceLevel,
          terminationApproved: nodeForm.terminationApproved,
          terminationReason: nodeForm.terminationReason || null,
        }
        const previousFields = {
          equipmentType: selectedNode!.equipmentType,
          secondaryEquipmentTags: selectedNode!.secondaryEquipmentTags,
          displayLabel: selectedNode!.displayLabel,
          motorName: selectedNode!.motorName,
          nearbyTreeNumbers: selectedNode!.nearbyTreeNumbers,
          irrigationZoneCodes: selectedNode!.irrigationZoneCodes,
          remarks: selectedNode!.remarks,
          confidenceLevel: selectedNode!.confidenceLevel,
          terminationApproved: selectedNode!.terminationApproved,
          terminationReason: selectedNode!.terminationReason,
        }
        saved = selectedNode!
        if (JSON.stringify(nextFields) !== JSON.stringify(previousFields)) {
          saved = await pipelineRequest<PipelineNode>(`/nodes/${selectedNode!.nodeId}`, {
            method: "PATCH",
            body: JSON.stringify({ expectedRevision: revision, ...nextFields, reason: "Farm Map pipeline editor save" }),
          })
          revision = saved.revision
        }
        if (pendingMove?.nodeId === selectedNode!.nodeId) {
          saved = await pipelineRequest<PipelineNode>(`/nodes/${selectedNode!.nodeId}/move`, {
            method: "POST",
            body: JSON.stringify({ expectedRevision: revision, latitude: pendingMove.latitude, longitude: pendingMove.longitude, reason: "Manual correction over orthomosaic" }),
          })
        }
      }
      setNodes((items) => [...items.filter((node) => node.nodeId !== saved.nodeId), saved].sort((a, b) => (a.surveyIndex ?? 9999) - (b.surveyIndex ?? 9999)))
      selectNode(saved)
      setPendingMove(null)
      setPast([])
      setFuture([])
      setMessage(`${saved.displayLabel} saved at revision ${saved.revision}.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Point save failed.")
    } finally {
      setBusy(false)
    }
  }

  async function saveSegment() {
    if (!segmentForm) return
    setBusy(true)
    try {
      const size = segmentForm.pipeSizeValue ? Number(segmentForm.pipeSizeValue) : null
      const fields = {
        segmentCode: segmentForm.segmentCode,
        lineClass: segmentForm.lineClass || null,
        pipeSizeValue: size,
        pipeSizeUnit: size ? segmentForm.pipeSizeUnit : null,
        pipeMaterial: segmentForm.pipeMaterial || null,
        sublineId: segmentForm.sublineId || null,
        irrigationZoneCodes: segmentForm.irrigationZoneCodes,
        remarks: segmentForm.remarks || null,
        verificationStatus: segmentForm.verificationStatus,
      }
      let saved: PipelineSegment
      if (draw.startNodeId && draw.endNodeId) {
        saved = await pipelineRequest<PipelineSegment>("/segments", {
          method: "POST",
          body: JSON.stringify({ ...fields, startNodeId: draw.startNodeId, endNodeId: draw.endNodeId, geometry: { type: "LineString", coordinates: draw.coordinates } }),
        })
      } else if (selectedSegment) {
        saved = await pipelineRequest<PipelineSegment>(`/segments/${selectedSegment.segmentId}`, {
          method: "PATCH",
          body: JSON.stringify({ ...fields, expectedRevision: selectedSegment.revision, geometry: { type: "LineString", coordinates: segmentGeometry ?? selectedSegment.geometry.coordinates }, reason: "Farm Map pipe edit" }),
        })
      } else return
      setSegments((items) => [...items.filter((segment) => segment.segmentId !== saved.segmentId), saved].sort((a, b) => a.segmentCode.localeCompare(b.segmentCode)))
      selectSegment(saved)
      setDraw({ startNodeId: null, endNodeId: null, coordinates: [] })
      setPast([])
      setFuture([])
      setMessage(`${saved.segmentCode} saved at revision ${saved.revision}.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Pipe save failed.")
    } finally {
      setBusy(false)
    }
  }

  async function resetNode() {
    if (!selectedNode || !window.confirm(`Reset ${selectedNode.displayLabel} to its surveyed position?`)) return
    setBusy(true)
    try {
      const saved = await pipelineRequest<PipelineNode>(`/nodes/${selectedNode.nodeId}/reset`, { method: "POST", body: JSON.stringify({ expectedRevision: selectedNode.revision, reason: "Administrator reset from Farm Map" }) })
      setNodes((items) => items.map((node) => node.nodeId === saved.nodeId ? saved : node))
      selectNode(saved)
      setPendingMove(null)
      setMessage(`${saved.displayLabel} restored to the original surveyed position.`)
    } catch (error) { setMessage(error instanceof Error ? error.message : "Reset failed.") } finally { setBusy(false) }
  }

  async function verifyNode() {
    if (!selectedNode || !window.confirm(`Confirm that ${selectedNode.displayLabel}'s classification and current position are verified?`)) return
    setBusy(true)
    try {
      const saved = await pipelineRequest<PipelineNode>(`/nodes/${selectedNode.nodeId}/verify`, { method: "POST", body: JSON.stringify({ expectedRevision: selectedNode.revision, confirmed: true, reason: "Administrator visual verification" }) })
      setNodes((items) => items.map((node) => node.nodeId === saved.nodeId ? saved : node))
      selectNode(saved)
      setMessage(`${saved.displayLabel} verified.`)
    } catch (error) { setMessage(error instanceof Error ? error.message : "Verification failed.") } finally { setBusy(false) }
  }

  async function ignoreNode() {
    if (!selectedNode) return
    const reason = window.prompt(`Reason for ignoring ${selectedNode.displayLabel}:`)?.trim()
    if (!reason) { setMessage("Ignoring a surveyed point requires a reason."); return }
    setBusy(true)
    try {
      const saved = await pipelineRequest<PipelineNode>(`/nodes/${selectedNode.nodeId}/ignore`, { method: "POST", body: JSON.stringify({ expectedRevision: selectedNode.revision, reason }) })
      setNodes((items) => items.map((node) => node.nodeId === saved.nodeId ? saved : node))
      selectNode(saved)
      setMessage(`${saved.displayLabel} ignored with an audit reason; it was not deleted.`)
    } catch (error) { setMessage(error instanceof Error ? error.message : "Ignore failed.") } finally { setBusy(false) }
  }

  async function splitSelectedPipe() {
    if (!selectedSegment || !selectedNode || !["Junction", "Reducer"].includes(selectedNode.equipmentType)) {
      setMessage("Select a pipe and a Junction or Reducer node on that pipe before splitting.")
      return
    }
    const code = window.prompt("New segment code for the second part:", `${selectedSegment.segmentCode}-B`)?.trim()
    if (!code) return
    setBusy(true)
    try {
      const result = await pipelineRequest<{ first: PipelineSegment; second: PipelineSegment }>(`/segments/${selectedSegment.segmentId}/split`, {
        method: "POST",
        body: JSON.stringify({ expectedRevision: selectedSegment.revision, splitNodeId: selectedNode.nodeId, newSegmentCode: code, reason: "Pipe split at fitting or pipe-size change" }),
      })
      setSegments((items) => [...items.filter((segment) => segment.segmentId !== selectedSegment.segmentId), result.first, result.second])
      selectSegment(result.first)
      setMessage(`${selectedSegment.segmentCode} split at ${selectedNode.displayLabel}.`)
    } catch (error) { setMessage(error instanceof Error ? error.message : "Pipe split failed.") } finally { setBusy(false) }
  }

  async function createSubline() {
    const code = window.prompt("Unique subline code:")?.trim()
    if (!code) return
    const name = window.prompt("Subline name:", code)?.trim()
    if (!name) return
    setBusy(true)
    try {
      const created = await pipelineRequest<PipelineSubline>("/sublines", {
        method: "POST",
        body: JSON.stringify({ sublineCode: code, sublineName: name, sourceNodeId: selectedNode?.nodeId ?? null, irrigationZoneCodes: segmentForm?.irrigationZoneCodes ?? [], verificationStatus: "Draft" }),
      })
      setSublines((items) => [...items, created].sort((a, b) => a.sublineCode.localeCompare(b.sublineCode)))
      setSegmentForm((current) => current ? { ...current, sublineId: created.sublineId } : current)
      setMessage(`${created.sublineCode} created and selected. Save the pipe to assign it.`)
    } catch (error) { setMessage(error instanceof Error ? error.message : "Subline creation failed.") } finally { setBusy(false) }
  }

  async function runValidation() {
    setBusy(true)
    try {
      const result = await pipelineRequest<PipelineValidation>("/validation")
      setValidation(result)
      setMessage(`Validation found ${result.summary.issueCount} warning/error items; no network data was modified.`)
    } catch (error) { setMessage(error instanceof Error ? error.message : "Validation failed.") } finally { setBusy(false) }
  }

  function navigateUnverified(direction: -1 | 1) {
    const candidates = nodes.filter((node) => node.status !== "Verified" && node.status !== "Ignored").sort((a, b) => (a.surveyIndex ?? 9999) - (b.surveyIndex ?? 9999))
    if (!candidates.length) return
    const current = candidates.findIndex((node) => node.nodeId === selectedNodeId)
    const index = current < 0 ? 0 : (current + direction + candidates.length) % candidates.length
    selectNode(candidates[index])
    map?.setView([candidates[index].currentLatitude, candidates[index].currentLongitude], Math.max(map.getZoom(), 20))
  }

  function findTree() {
    const exact = trees.find((tree) => tree.treeNo === treeSearch.trim())
    if (!exact) { setMessage("Tree number not found. Preserve decimal identifiers such as 35.1 exactly."); return }
    setHighlightedTree(exact.treeNo)
    map?.setView([exact.latitude, exact.longitude], Math.max(map.getZoom(), 21))
    setMessage(`Tree ${exact.treeNo} highlighted in ${exact.plot}.`)
  }

  function addNearbyTree(treeNo: string) {
    setNodeForm((current) => current ? { ...current, nearbyTreeNumbers: commaValues(`${current.nearbyTreeNumbers},${treeNo}`).join(", ") } : current)
    setTreeSearch(treeNo)
    setHighlightedTree(treeNo)
  }

  const toolbar = [
    ["select", "Select node", Pencil], ["move", "Move node", Route], ["add-node", "Add node", MapPinPlus],
    ["draw", "Draw pipe", GitBranch], ["edit-pipe", "Edit pipe", Pencil], ["split", "Split pipe", Scissors],
  ] as const

  return (
    <>
      <Panel title="Irrigation Pipeline" icon={Route}>
        <div className="grid gap-3">
          <label className="flex items-center justify-between rounded-lg border border-blue-300 bg-blue-50 px-3 py-2.5 text-sm font-semibold text-blue-950">
            <span>Pipeline layer</span>
            <input type="checkbox" checked={layerEnabled} onChange={(event) => setLayerEnabled(event.target.checked)} className="size-4 accent-blue-700" />
          </label>
          <div className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
            <div>
              <p className="text-sm font-semibold">{editMode ? "Edit mode" : "View mode"}</p>
              <p className="text-xs text-muted-foreground">{smallScreen ? "Small-screen editing is disabled; viewing remains available." : capabilities?.canEdit ? "Administrator access" : "Read-only user"}</p>
            </div>
            <Button type="button" variant={editMode ? "destructive" : "outline"} disabled={!canEdit} onClick={() => { setEditMode((value) => !value); setTool("select") }}>
              {editMode ? "Disable Edit" : "Enable Edit"}
            </Button>
          </div>
          <label className="grid gap-1 text-xs font-semibold">Display mode
            <select value={displayMode} onChange={(event) => setDisplayMode(event.target.value as DisplayMode)} className={inputClass()}>
              <option value="line-class">Colour by line class</option><option value="zone">Colour by irrigation zone</option><option value="pipe-size">Width by pipe size</option><option value="verification">Verification status</option>
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            {toolbar.map(([value, label, Icon]) => (
              <Button key={value} type="button" size="sm" variant={tool === value ? "default" : "outline"} disabled={!editMode} onClick={() => setTool(value)}>
                <Icon className="mr-1 size-3.5" />{label}
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-4 gap-2">
            <Button type="button" size="sm" variant="outline" disabled={!editMode || !past.length} onClick={undo}><Undo2 className="size-4" /><span className="sr-only">Undo</span></Button>
            <Button type="button" size="sm" variant="outline" disabled={!editMode || !future.length} onClick={redo}><Redo2 className="size-4" /><span className="sr-only">Redo</span></Button>
            <Button type="button" size="sm" disabled={!editMode || busy || (!nodeForm && !segmentForm)} onClick={() => void (nodeForm ? saveNode() : saveSegment())}><Save className="size-4" /><span className="sr-only">Save</span></Button>
            <Button type="button" size="sm" variant="outline" disabled={!editMode} onClick={clearDrafts}><X className="size-4" /><span className="sr-only">Cancel</span></Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" size="sm" variant="outline" disabled={!canEdit || busy} onClick={() => void runValidation()}><CheckCircle2 className="mr-1 size-4" />Validate</Button>
            <Button type="button" size="sm" variant="outline" disabled={loading} onClick={() => void loadNetwork()}><RefreshCw className="mr-1 size-4" />Reload</Button>
          </div>
          <p className="text-xs text-muted-foreground" aria-live="polite">{message}</p>
        </div>
      </Panel>

      <Panel title="Pipeline Filters" icon={Search}>
        <div className="grid grid-cols-2 gap-2">
          <select aria-label="Pipeline status filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as PipelineStatus | "All")} className={inputClass()}><option>All</option>{PIPELINE_STATUSES.map((status) => <option key={status}>{status}</option>)}</select>
          <select aria-label="Equipment type filter" value={equipmentFilter} onChange={(event) => setEquipmentFilter(event.target.value as PipelineEquipmentType | "All")} className={inputClass()}><option>All</option>{PIPELINE_EQUIPMENT_TYPES.map((type) => <option key={type}>{type}</option>)}</select>
          <select aria-label="Irrigation zone filter" value={zoneFilter} onChange={(event) => setZoneFilter(event.target.value as PipelineZone | "All")} className={inputClass()}><option>All</option>{PIPELINE_ZONES.map((zone) => <option key={zone}>{zone}</option>)}</select>
          <input aria-label="Survey index filter" type="number" min="1" max="89" value={surveyFilter} onChange={(event) => setSurveyFilter(event.target.value)} placeholder="Survey index" className={inputClass()} />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Showing {visibleNodes.length} of {nodes.length} points. Nearby points are never merged or auto-connected.</p>
      </Panel>

      {nodeForm ? (
        <Panel title={manualDraft ? "New Manual Pipeline Node" : `Point ${selectedNode?.displayLabel ?? ""}`} icon={MapPinPlus}>
          <div className="grid gap-3 text-sm">
            {selectedNode ? <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/60 p-2 text-xs"><span>Survey: {selectedNode.surveyIndex ? `PS-${String(selectedNode.surveyIndex).padStart(3, "0")}` : "Manual"}</span><span>Status: {selectedNode.status}</span><span>Original: {selectedNode.originalLatitude?.toFixed(7) ?? "—"}, {selectedNode.originalLongitude?.toFixed(7) ?? "—"}</span><span>Current: {currentNode(selectedNode).currentLatitude.toFixed(7)}, {currentNode(selectedNode).currentLongitude.toFixed(7)}</span><span>Accuracy: {selectedNode.gpsAccuracyMetres?.toFixed(2) ?? "—"} m</span><span>Moved: {(pendingMove?.nodeId === selectedNode.nodeId ? pipelineDistanceMetres(selectedNode.originalLatitude ?? pendingMove.latitude, selectedNode.originalLongitude ?? pendingMove.longitude, pendingMove.latitude, pendingMove.longitude) : selectedNode.movedDistanceMetres ?? 0).toFixed(2)} m</span><span>Revision: {selectedNode.revision}</span><span>Source: {selectedNode.sourceIdentifier}</span></div> : null}
            <label className="grid gap-1 text-xs font-semibold">Equipment type<select value={nodeForm.equipmentType} disabled={!editMode} onChange={(event) => setNodeForm({ ...nodeForm, equipmentType: event.target.value as PipelineEquipmentType })} className={inputClass()}>{PIPELINE_EQUIPMENT_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label>
            <label className="grid gap-1 text-xs font-semibold">Display label<input value={nodeForm.displayLabel} disabled={!editMode} onChange={(event) => setNodeForm({ ...nodeForm, displayLabel: event.target.value })} className={inputClass()} placeholder={manualDraft ? "Auto-generated if blank" : "Point label"} /></label>
            <label className="grid gap-1 text-xs font-semibold">Motor / valve name<input value={nodeForm.motorName} disabled={!editMode} onChange={(event) => setNodeForm({ ...nodeForm, motorName: event.target.value })} className={inputClass()} /></label>
            <label className="grid gap-1 text-xs font-semibold">Secondary equipment tags<input value={nodeForm.secondaryEquipmentTags} disabled={!editMode} onChange={(event) => setNodeForm({ ...nodeForm, secondaryEquipmentTags: event.target.value })} className={inputClass()} placeholder="Comma-separated" /></label>
            <label className="grid gap-1 text-xs font-semibold">Nearby tree numbers<input value={nodeForm.nearbyTreeNumbers} disabled={!editMode} onChange={(event) => setNodeForm({ ...nodeForm, nearbyTreeNumbers: event.target.value })} className={inputClass()} placeholder="35.1, 36, 37" /></label>
            <div><p className="mb-1 text-xs font-semibold">Irrigation zones</p><ZoneChecks value={nodeForm.irrigationZoneCodes} disabled={!editMode} onChange={(value) => setNodeForm({ ...nodeForm, irrigationZoneCodes: value })} /></div>
            <label className="grid gap-1 text-xs font-semibold">Confidence<select value={nodeForm.confidenceLevel} disabled={!editMode} onChange={(event) => setNodeForm({ ...nodeForm, confidenceLevel: event.target.value as PipelineConfidence })} className={inputClass()}>{PIPELINE_CONFIDENCE.map((value) => <option key={value}>{value}</option>)}</select></label>
            <label className="grid gap-1 text-xs font-semibold">Remarks<textarea value={nodeForm.remarks} disabled={!editMode} onChange={(event) => setNodeForm({ ...nodeForm, remarks: event.target.value })} className="min-h-16 rounded-md border border-border bg-background p-2 text-sm" /></label>
            <label className="flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={nodeForm.terminationApproved} disabled={!editMode} onChange={(event) => setNodeForm({ ...nodeForm, terminationApproved: event.target.checked })} />Approved dangling termination</label>
            {nodeForm.terminationApproved ? <input aria-label="Termination reason" value={nodeForm.terminationReason} disabled={!editMode} onChange={(event) => setNodeForm({ ...nodeForm, terminationReason: event.target.value })} className={inputClass()} placeholder="Required termination reason" /> : null}
            {selectedNode?.photoFilenames.length ? <div><p className="text-xs font-semibold">Photograph filenames</p>{selectedNode.photoFilenames.map((filename) => <button type="button" key={filename} onClick={() => void navigator.clipboard.writeText(filename)} className="mt-1 flex w-full items-center justify-between rounded border border-border px-2 py-1 text-left text-xs"><span className="truncate">{filename}</span><Copy className="size-3.5 shrink-0" /></button>)}</div> : null}
            {selectedNode?.voiceFilename ? <button type="button" onClick={() => void navigator.clipboard.writeText(selectedNode.voiceFilename!)} className="flex items-center justify-between rounded border border-border px-2 py-1 text-left text-xs"><span className="truncate">Voice: {selectedNode.voiceFilename}</span><Copy className="size-3.5" /></button> : null}
            {selectedNode?.localSummary ? <div className="rounded-lg border border-amber-300 bg-amber-50 p-2 text-xs text-amber-950"><strong>Local voice summary:</strong> {selectedNode.localSummary}</div> : null}
            <div className="grid grid-cols-2 gap-2"><Button type="button" size="sm" disabled={!editMode || busy} onClick={() => void saveNode()}><Save className="mr-1 size-4" />Save point</Button><Button type="button" size="sm" variant="outline" disabled={!editMode || !pendingMove} onClick={() => setPendingMove(null)}>Undo move</Button>{selectedNode && selectedNode.originalLatitude !== null ? <Button type="button" size="sm" variant="outline" disabled={!editMode || busy} onClick={() => void resetNode()}>Reset surveyed</Button> : null}<Button type="button" size="sm" variant="outline" disabled={!editMode || busy || !selectedNode || Boolean(pendingMove)} onClick={() => void verifyNode()}>Verify</Button><Button type="button" size="sm" variant="destructive" disabled={!editMode || busy || !selectedNode} onClick={() => void ignoreNode()}>Ignore point</Button><Button type="button" size="sm" variant="outline" disabled={!editMode || busy || !selectedNode || !selectedSegment} onClick={() => void splitSelectedPipe()}>Split at node</Button></div>
            <div className="grid grid-cols-2 gap-2"><Button type="button" size="sm" variant="outline" onClick={() => navigateUnverified(-1)}>Previous</Button><Button type="button" size="sm" variant="outline" onClick={() => navigateUnverified(1)}>Next unverified</Button></div>
          </div>
        </Panel>
      ) : null}

      {segmentForm ? (
        <Panel title={draw.endNodeId ? "New Pipeline Segment" : `Pipe ${selectedSegment?.segmentCode ?? ""}`} icon={GitBranch}>
          <div className="grid gap-3 text-sm">
            <label className="grid gap-1 text-xs font-semibold">Segment code<input value={segmentForm.segmentCode} disabled={!editMode} onChange={(event) => setSegmentForm({ ...segmentForm, segmentCode: event.target.value })} className={inputClass()} /></label>
            <label className="grid gap-1 text-xs font-semibold">Line class<select value={segmentForm.lineClass} disabled={!editMode} onChange={(event) => setSegmentForm({ ...segmentForm, lineClass: event.target.value as PipelineLineClass | "" })} className={inputClass()}><option value="">Select class</option>{PIPELINE_LINE_CLASSES.map((value) => <option key={value}>{value}</option>)}</select></label>
            <div className="grid grid-cols-2 gap-2"><label className="grid gap-1 text-xs font-semibold">Pipe size<input list="pipeline-size-suggestions" type="number" min="0.001" step="any" value={segmentForm.pipeSizeValue} disabled={!editMode} onChange={(event) => setSegmentForm({ ...segmentForm, pipeSizeValue: event.target.value })} className={inputClass()} /><datalist id="pipeline-size-suggestions">{PIPE_SIZE_SUGGESTIONS.map((value) => <option key={value} value={value} />)}</datalist></label><label className="grid gap-1 text-xs font-semibold">Unit<select value={segmentForm.pipeSizeUnit} disabled={!editMode} onChange={(event) => setSegmentForm({ ...segmentForm, pipeSizeUnit: event.target.value as "inch" | "millimetre" })} className={inputClass()}><option value="inch">inch</option><option value="millimetre">millimetre</option></select></label></div>
            <label className="grid gap-1 text-xs font-semibold">Material<input value={segmentForm.pipeMaterial} disabled={!editMode} onChange={(event) => setSegmentForm({ ...segmentForm, pipeMaterial: event.target.value })} className={inputClass()} /></label>
            <label className="grid gap-1 text-xs font-semibold">Subline<select value={segmentForm.sublineId} disabled={!editMode} onChange={(event) => setSegmentForm({ ...segmentForm, sublineId: event.target.value })} className={inputClass()}><option value="">Unassigned</option>{sublines.map((subline) => <option key={subline.sublineId} value={subline.sublineId}>{subline.sublineCode} · {subline.sublineName}</option>)}</select></label>
            <Button type="button" size="sm" variant="outline" disabled={!editMode || busy} onClick={() => void createSubline()}>Create / assign subline</Button>
            <div><p className="mb-1 text-xs font-semibold">Zones served</p><ZoneChecks value={segmentForm.irrigationZoneCodes} disabled={!editMode} onChange={(value) => setSegmentForm({ ...segmentForm, irrigationZoneCodes: value })} /></div>
            <label className="grid gap-1 text-xs font-semibold">Verification<select value={segmentForm.verificationStatus} disabled={!editMode} onChange={(event) => setSegmentForm({ ...segmentForm, verificationStatus: event.target.value as SegmentForm["verificationStatus"] })} className={inputClass()}><option>Draft</option><option>Needs review</option><option>Verified</option></select></label>
            <label className="grid gap-1 text-xs font-semibold">Remarks<textarea value={segmentForm.remarks} disabled={!editMode} onChange={(event) => setSegmentForm({ ...segmentForm, remarks: event.target.value })} className="min-h-16 rounded-md border border-border bg-background p-2 text-sm" /></label>
            <Button type="button" disabled={!editMode || busy} onClick={() => void saveSegment()}><Save className="mr-1 size-4" />Save pipe</Button>
          </div>
        </Panel>
      ) : null}

      {selectedNode ? (
        <Panel title="Tree Correlation" icon={Search}>
          <div className="grid gap-2">
            <div className="flex gap-2"><input list="pipeline-tree-numbers" value={treeSearch} onChange={(event) => setTreeSearch(event.target.value)} className={inputClass()} placeholder="Exact TreeNo, e.g. 35.1" /><datalist id="pipeline-tree-numbers">{trees.map((tree) => <option key={`${tree.plot}:${tree.treeNo}`} value={tree.treeNo} />)}</datalist><Button type="button" size="sm" variant="outline" onClick={findTree}><Search className="size-4" /></Button></div>
            <div className="grid gap-1">{nearestTrees.map((tree) => <button type="button" key={`${tree.plot}:${tree.treeNo}`} onClick={() => { addNearbyTree(tree.treeNo); map?.setView([tree.latitude, tree.longitude], 21) }} className="flex justify-between rounded border border-border px-2 py-1 text-xs"><span>Tree {tree.treeNo} · {tree.plot}</span><span>{tree.distance.toFixed(1)} m</span></button>)}</div>
            <p className="text-xs text-muted-foreground">Nearest-tree highlights are advisory only. Points are never snapped to trees.</p>
          </div>
        </Panel>
      ) : null}

      <Panel title="Network Export" icon={Download}>
        <div className="grid gap-2"><Button type="button" size="sm" variant="outline" disabled={!capabilities?.canEdit} onClick={() => pipelineDownload("nodes-geojson")}>Nodes GeoJSON</Button><Button type="button" size="sm" variant="outline" disabled={!capabilities?.canEdit} onClick={() => pipelineDownload("segments-geojson")}>Segments GeoJSON</Button><Button type="button" size="sm" variant="outline" disabled={!capabilities?.canEdit} onClick={() => pipelineDownload("backup-json")}>Complete JSON backup</Button></div>
      </Panel>

      {validation ? (
        <Panel title="Network Validation" icon={validation.valid ? CheckCircle2 : AlertTriangle}>
          <div className="grid gap-2"><p className="text-sm font-semibold">{validation.summary.issueCount} issues · {validation.summary.bySeverity.error ?? 0} errors</p><p className="text-xs text-muted-foreground">Warnings never change network data.</p><div className="max-h-64 space-y-1 overflow-y-auto">{validation.issues.map((issue, index) => <button type="button" key={`${issue.category}:${issue.entityId}:${index}`} className={`block w-full rounded border p-2 text-left text-xs ${issue.severity === "error" ? "border-red-300 bg-red-50 text-red-950" : "border-amber-300 bg-amber-50 text-amber-950"}`} onClick={() => { if (issue.entityType === "node") { const node = nodes.find((item) => item.nodeId === issue.entityId); if (node) selectNode(node) } else if (issue.entityType === "segment") { const segment = segments.find((item) => item.segmentId === issue.entityId); if (segment) selectSegment(segment) } }}>{issue.message}</button>)}</div></div>
        </Panel>
      ) : null}
    </>
  )
}
