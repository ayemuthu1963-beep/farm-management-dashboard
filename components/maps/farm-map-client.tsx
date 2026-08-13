"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { LeafletMouseEvent } from "leaflet"
import { AlertTriangle, RefreshCw, Trees } from "lucide-react"

import { Panel } from "@/components/farm/panel"
import { TreeNumberAutocomplete } from "@/components/harvest/tree-number-autocomplete"
import {
  FarmOrthomosaicMap,
  type LeafletApi,
  type LeafletCircleMarker,
  type LeafletLayerGroup,
  type LeafletMap,
} from "@/components/maps/farm-orthomosaic-map"
import { Button } from "@/components/ui/button"
import { farmCombinedLayer, jackfruitBounds } from "@/lib/farm-map-data"
import {
  CLASSIFICATION_STYLES,
  PERFORMANCE_CLASSIFICATIONS,
  UNKNOWN_CLASSIFICATION_STYLE,
  classificationFilterKey,
  classificationStyle,
  type ClassificationFilter,
} from "@/lib/farm-map/classification-styles"
import { canonicalTreeNo } from "@/lib/farm-map/tree-number"
import { nearestTreeHit, treeHitRadiusPx } from "@/lib/farm-map/tree-hit-testing"
import type {
  FarmMapCoordinateCollection,
  FarmMapCoordinateFeature,
  FarmMapOperationalPayload,
  FarmMapOperationalRecord,
  PlotName,
} from "@/lib/farm-map/types"
import { treeNumberOptionKey, type TreeNumberOption } from "@/lib/tree-number-options"

type PlotFilter = "Plot 1 & Plot 2" | PlotName
type DataState = "loading" | "ready" | "stale" | "partial" | "error"

interface TreeMapEntry {
  feature: FarmMapCoordinateFeature
  marker: LeafletCircleMarker
  hitMarker: LeafletCircleMarker
}

interface JackfruitFeature {
  type: "Feature"
  geometry: {
    type: "Point"
    coordinates: [number, number]
  }
  properties: {
    crop: "Jackfruit"
    treeNo: string
    canonicalId: string
  }
}

interface JackfruitCollection {
  type: "FeatureCollection"
  features: JackfruitFeature[]
}

type JackfruitCoordinateVariant = "original" | "translated" | "affine"

interface JackfruitMapEntry {
  feature: JackfruitFeature
  marker: LeafletCircleMarker
  hitMarker: LeafletCircleMarker
  variant: JackfruitCoordinateVariant
}

const MARKER_ZOOM = 18
const LABEL_ZOOM = 20
const OPERATIONAL_REFRESH_MS = 5 * 60 * 1000
const EXPECTED_TREE_COUNT = 2_117
const EXPECTED_JACKFRUIT_COUNT = 582
const EXPECTED_PLOT_COUNTS: Record<PlotName, number> = { "Plot 1": 954, "Plot 2": 1_163 }

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}

function display(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "—"
  return typeof value === "number" ? value.toLocaleString("en-IN") : escapeHtml(value)
}

function formatTimestamp(value: string | null | undefined) {
  if (!value) return "Unavailable"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("en-IN")
}

function validateCoordinateCollection(value: unknown): FarmMapCoordinateCollection {
  const collection = value as FarmMapCoordinateCollection
  if (collection?.type !== "FeatureCollection" || !Array.isArray(collection.features)) {
    throw new Error("Coordinate GeoJSON is not a FeatureCollection")
  }
  if (collection.features.length !== EXPECTED_TREE_COUNT) {
    throw new Error(`Expected ${EXPECTED_TREE_COUNT} coordinates, found ${collection.features.length}`)
  }

  const seen = new Set<string>()
  const counts: Record<PlotName, number> = { "Plot 1": 0, "Plot 2": 0 }
  for (const feature of collection.features) {
    const treeNo = canonicalTreeNo(feature?.properties?.treeNo)
    const plot = feature?.properties?.plot
    const coordinates = feature?.geometry?.coordinates
    if (
      feature?.type !== "Feature" ||
      feature?.geometry?.type !== "Point" ||
      treeNo === null ||
      treeNo !== feature.properties.treeNo ||
      (plot !== "Plot 1" && plot !== "Plot 2") ||
      !Array.isArray(coordinates) ||
      coordinates.length !== 2 ||
      !coordinates.every(Number.isFinite)
    ) {
      throw new Error("Coordinate GeoJSON contains an invalid feature")
    }
    if (seen.has(treeNo)) throw new Error(`Duplicate spatial TreeNo ${treeNo}`)
    seen.add(treeNo)
    counts[plot] += 1
  }
  for (const plot of ["Plot 1", "Plot 2"] as PlotName[]) {
    if (counts[plot] !== EXPECTED_PLOT_COUNTS[plot]) {
      throw new Error(`${plot} coordinate count is ${counts[plot]}`)
    }
  }
  return collection
}

function validateOperationalPayload(value: unknown): FarmMapOperationalPayload {
  const payload = value as FarmMapOperationalPayload
  if (
    payload?.recordCount !== EXPECTED_TREE_COUNT ||
    payload?.decimalTreeNoCount !== 15 ||
    !Array.isArray(payload.records) ||
    payload.records.length !== EXPECTED_TREE_COUNT
  ) {
    throw new Error("Operational Farm Map payload failed its count contract")
  }

  const seen = new Set<string>()
  for (const record of payload.records) {
    const treeNo = canonicalTreeNo(record?.treeNo)
    if (treeNo === null || treeNo !== record.treeNo || seen.has(treeNo)) {
      throw new Error("Operational Farm Map payload has an invalid or duplicate TreeNo")
    }
    seen.add(treeNo)
  }
  return payload
}

function validateJackfruitCoordinateCollection(value: unknown): JackfruitCollection {
  const collection = value as JackfruitCollection
  if (collection?.type !== "FeatureCollection" || !Array.isArray(collection.features)) {
    throw new Error("Jackfruit coordinate GeoJSON is not a FeatureCollection")
  }
  if (collection.features.length !== EXPECTED_JACKFRUIT_COUNT) {
    throw new Error(
      `Expected ${EXPECTED_JACKFRUIT_COUNT} Jackfruit coordinates, found ${collection.features.length}`,
    )
  }

  const seen = new Set<string>()
  for (const feature of collection.features) {
    const treeNo = feature?.properties?.treeNo
    const canonicalId = feature?.properties?.canonicalId
    const coordinates = feature?.geometry?.coordinates
    if (
      feature?.type !== "Feature" ||
      feature?.geometry?.type !== "Point" ||
      feature?.properties?.crop !== "Jackfruit" ||
      typeof treeNo !== "string" ||
      !/^[1-9]\d*$/.test(treeNo) ||
      canonicalId !== `jackfruit:${treeNo}` ||
      !Array.isArray(coordinates) ||
      coordinates.length !== 2 ||
      !coordinates.every(Number.isFinite)
    ) {
      throw new Error("Jackfruit coordinate GeoJSON contains an invalid feature")
    }
    if (seen.has(canonicalId)) throw new Error(`Duplicate Jackfruit canonical ID ${canonicalId}`)
    seen.add(canonicalId)
  }
  return collection
}

function treeLabelIcon(leaflet: LeafletApi, treeNo: string, classification: string | null) {
  const style = classificationStyle(classification)
  const labelWidth = Math.max(26, treeNo.length * 7 + 9)
  return leaflet.divIcon({
    className: "farm-map-tree-label",
    html: `<span style="box-sizing:border-box;display:flex;width:100%;height:100%;align-items:center;justify-content:center;padding:1px 4px;border:1px solid ${style.border};border-radius:3px;background:${style.fill};color:${style.text};font:800 10px/1.25 sans-serif;box-shadow:0 1px 3px rgba(0,0,0,.55);white-space:nowrap">${escapeHtml(treeNo)}</span>`,
    iconSize: [labelWidth, 17],
    iconAnchor: [labelWidth / 2, 25],
  })
}

function jackfruitLabelIcon(
  leaflet: LeafletApi,
  treeNo: string,
  variant: JackfruitCoordinateVariant,
) {
  const prefix = variant === "original" ? "O" : variant === "translated" ? "T" : "A"
  const label = `${prefix}:JF:${treeNo}`
  const labelWidth = Math.max(38, label.length * 7 + 9)
  const colour = variant === "original" ? "#ff00ff" : variant === "translated" ? "#00e5ff" : "#dfff00"
  const textColour = variant === "original" ? "#8a005d" : variant === "translated" ? "#004e64" : "#374400"
  return leaflet.divIcon({
    className: `farm-map-jackfruit-label farm-map-jackfruit-label-${variant}`,
    html: `<span style="box-sizing:border-box;display:flex;width:100%;height:100%;align-items:center;justify-content:center;padding:1px 4px;border:2px solid ${colour};border-radius:3px;background:rgba(255,255,255,.9);color:${textColour};font:800 10px/1.25 sans-serif;box-shadow:0 1px 3px rgba(0,0,0,.55);white-space:nowrap;cursor:pointer">${label}</span>`,
    iconSize: [labelWidth, 18],
    iconAnchor: [labelWidth / 2, 26],
  })
}

function popupHtml(feature: FarmMapCoordinateFeature, record?: FarmMapOperationalRecord) {
  const treeNo = escapeHtml(feature.properties.treeNo)
  const plot = escapeHtml(feature.properties.plot)
  const detailsHref = `/coconut-harvest/tree-view?treeNo=${encodeURIComponent(feature.properties.treeNo)}`
  const harvest = record?.latestHarvest
  const rows: Array<[string, string | number | null | undefined]> = [
    ["Tree Number", treeNo],
    ["Plot", plot],
    ["Tree status", record?.status],
    ["Lifecycle status", record?.lifecycleStatus],
    ["Performance class", record?.classification ?? "Unknown"],
    ["Classification reason", record?.classificationReason],
    ["Classification period", record?.classificationPeriod],
    ["Latest harvest date", harvest?.date],
    ["Latest bunches", harvest?.totalBunches],
    ["Latest nuts", harvest?.totalNuts],
  ]

  return `
    <div style="min-width:280px;max-width:360px;font-family:inherit">
      <table style="width:100%;border-collapse:collapse">
        ${rows
          .map(
            ([label, value]) =>
              `<tr><th style="padding:3px 8px 3px 0;text-align:left;vertical-align:top;color:#475569">${label}</th><td style="padding:3px 0;text-align:right;font-weight:700">${display(value)}</td></tr>`,
          )
          .join("")}
      </table>
      <a href="${detailsHref}" style="display:inline-block;margin-top:10px;font-weight:700;color:#0f766e">View Full Harvest Details</a>
    </div>`
}

function jackfruitPopupHtml(feature: JackfruitFeature, variant: JackfruitCoordinateVariant) {
  const coordinateStatus =
    variant === "original"
      ? "Original coordinates — review only"
      : variant === "translated"
        ? "Previous translated baseline — not approved"
        : "Affine correction — review only"
  return `
    <div style="min-width:230px;max-width:320px;font-family:inherit">
      <table style="width:100%;border-collapse:collapse">
        <tr><th style="padding:3px 8px 3px 0;text-align:left;color:#475569">Jackfruit Tree Number</th><td style="padding:3px 0;text-align:right;font-weight:700">${escapeHtml(feature.properties.treeNo)}</td></tr>
        <tr><th style="padding:3px 8px 3px 0;text-align:left;color:#475569">Crop</th><td style="padding:3px 0;text-align:right;font-weight:700">Jackfruit</td></tr>
        <tr><th style="padding:3px 8px 3px 0;text-align:left;color:#475569">Coordinate status</th><td style="padding:3px 0;text-align:right;font-weight:700">${coordinateStatus}</td></tr>
      </table>
    </div>`
}

function ClassificationLegend({
  counts,
  activeFilter,
  onFilter,
}: {
  counts: Record<string, number>
  activeFilter: ClassificationFilter
  onFilter: (filter: ClassificationFilter) => void
}) {
  const entries = [
    ...PERFORMANCE_CLASSIFICATIONS.map((classification) => ({
      classification,
      style: CLASSIFICATION_STYLES[classification],
    })),
    { classification: "Unknown/unmatched" as const, style: UNKNOWN_CLASSIFICATION_STYLE },
  ]

  return (
    <Panel title="Current Performance Classification" icon={Trees}>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <button
          type="button"
          onClick={() => onFilter("All")}
          aria-pressed={activeFilter === "All"}
          className={`rounded-lg border px-3 py-2 text-left text-sm ${activeFilter === "All" ? "border-primary bg-primary/10" : "border-border bg-background"}`}
        >
          <span className="font-bold">All</span>
          <span className="ml-2 text-muted-foreground">{EXPECTED_TREE_COUNT.toLocaleString("en-IN")}</span>
        </button>
        {entries.map(({ classification, style }) => (
          <button
            key={classification}
            type="button"
            onClick={() => onFilter(classification)}
            aria-pressed={activeFilter === classification}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm ${activeFilter === classification ? "border-primary bg-primary/10" : "border-border bg-background"}`}
          >
            <span
              className="size-4 shrink-0 rounded-full border-2"
              style={{ backgroundColor: style.fill, borderColor: style.border }}
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1 font-semibold">{classification}</span>
            <span className="tabular-nums text-muted-foreground">
              {(counts[classification] ?? 0).toLocaleString("en-IN")}
            </span>
          </button>
        ))}
      </div>
    </Panel>
  )
}

export function FarmMapClient() {
  const mapRef = useRef<LeafletMap | null>(null)
  const leafletRef = useRef<LeafletApi | null>(null)
  const pointLayers = useRef<Record<PlotName, LeafletLayerGroup | null>>({
    "Plot 1": null,
    "Plot 2": null,
  })
  const hitLayers = useRef<Record<PlotName, LeafletLayerGroup | null>>({
    "Plot 1": null,
    "Plot 2": null,
  })
  const labelLayer = useRef<LeafletLayerGroup | null>(null)
  const jackfruitPointLayer = useRef<LeafletLayerGroup | null>(null)
  const jackfruitHitLayer = useRef<LeafletLayerGroup | null>(null)
  const jackfruitLabelLayer = useRef<LeafletLayerGroup | null>(null)
  const translatedJackfruitPointLayer = useRef<LeafletLayerGroup | null>(null)
  const translatedJackfruitHitLayer = useRef<LeafletLayerGroup | null>(null)
  const translatedJackfruitLabelLayer = useRef<LeafletLayerGroup | null>(null)
  const affineJackfruitPointLayer = useRef<LeafletLayerGroup | null>(null)
  const affineJackfruitHitLayer = useRef<LeafletLayerGroup | null>(null)
  const affineJackfruitLabelLayer = useRef<LeafletLayerGroup | null>(null)
  const treesByNumber = useRef(new Map<string, TreeMapEntry>())
  const jackfruitByCanonicalId = useRef(new Map<string, JackfruitMapEntry>())
  const translatedJackfruitByCanonicalId = useRef(new Map<string, JackfruitMapEntry>())
  const affineJackfruitByCanonicalId = useRef(new Map<string, JackfruitMapEntry>())
  const operationalByNumber = useRef(new Map<string, FarmMapOperationalRecord>())
  const activePopupRef = useRef<ReturnType<LeafletApi["popup"]> | null>(null)
  const hitRadiusRef = useRef(14)
  const treeMarkersEnabledRef = useRef(true)
  const treeLabelsEnabledRef = useRef(true)
  const plotFilterRef = useRef<PlotFilter>("Plot 1 & Plot 2")
  const classificationFilterRef = useRef<ClassificationFilter>("All")
  const selectedTreeNoRef = useRef<string | null>(null)
  const selectedJackfruitIdRef = useRef<string | null>(null)
  const jackfruitEnabledRef = useRef(true)
  const translatedJackfruitEnabledRef = useRef(true)
  const affineJackfruitEnabledRef = useRef(true)
  const selectAndOpenTreeRef = useRef<((entry: TreeMapEntry) => void) | null>(null)
  const selectAndOpenJackfruitRef = useRef<((entry: JackfruitMapEntry) => void) | null>(null)

  const [treeMarkersEnabled, setTreeMarkersEnabled] = useState(true)
  const [treeLabelsEnabled, setTreeLabelsEnabled] = useState(true)
  const [jackfruitEnabled, setJackfruitEnabled] = useState(true)
  const [translatedJackfruitEnabled, setTranslatedJackfruitEnabled] = useState(true)
  const [affineJackfruitEnabled, setAffineJackfruitEnabled] = useState(true)
  const [jackfruitState, setJackfruitState] = useState<"loading" | "ready" | "error">("loading")
  const [translatedJackfruitState, setTranslatedJackfruitState] = useState<"loading" | "ready" | "error">("loading")
  const [affineJackfruitState, setAffineJackfruitState] = useState<"loading" | "ready" | "error">("loading")
  const [jackfruitCount, setJackfruitCount] = useState(0)
  const [translatedJackfruitCount, setTranslatedJackfruitCount] = useState(0)
  const [affineJackfruitCount, setAffineJackfruitCount] = useState(0)
  const [plotFilter, setPlotFilter] = useState<PlotFilter>("Plot 1 & Plot 2")
  const [classificationFilter, setClassificationFilter] =
    useState<ClassificationFilter>("All")
  const [searchTreeNo, setSearchTreeNo] = useState("")
  const [status, setStatus] = useState("Loading approved tree coordinates…")
  const [geometryState, setGeometryState] = useState<"loading" | "ready" | "error">("loading")
  const [dataState, setDataState] = useState<DataState>("loading")
  const [dataAsOf, setDataAsOf] = useState<string | null>(null)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [unmatchedSpatial, setUnmatchedSpatial] = useState(0)
  const [operationalWithoutSpatial, setOperationalWithoutSpatial] = useState(0)
  const [geometryOptions, setGeometryOptions] = useState<TreeNumberOption[]>([])

  const availableOptions = useMemo(
    () =>
      plotFilter === "Plot 1 & Plot 2"
        ? geometryOptions
        : geometryOptions.filter((option) => option.plot === plotFilter),
    [geometryOptions, plotFilter],
  )

  const matchesActiveFilters = useCallback((entry: TreeMapEntry) => {
    const plotAllowed =
      plotFilterRef.current === "Plot 1 & Plot 2" ||
      entry.feature.properties.plot === plotFilterRef.current
    const classification = operationalByNumber.current.get(entry.feature.properties.treeNo)?.classification
    const classAllowed =
      classificationFilterRef.current === "All" ||
      classificationFilterKey(classification) === classificationFilterRef.current
    return plotAllowed && classAllowed
  }, [])

  const refreshLabels = useCallback(() => {
    const map = mapRef.current
    const leaflet = leafletRef.current
    const labels = labelLayer.current
    if (!map || !leaflet || !labels) return

    labels.clearLayers()
    const canShow =
      treeMarkersEnabledRef.current &&
      treeLabelsEnabledRef.current &&
      map.getZoom() >= LABEL_ZOOM
    if (!canShow) {
      if (map.hasLayer(labels)) labels.remove()
      return
    }

    const visibleBounds = map.getBounds().pad(0.08)
    for (const entry of treesByNumber.current.values()) {
      if (!matchesActiveFilters(entry)) continue
      const [longitude, latitude] = entry.feature.geometry.coordinates
      if (!visibleBounds.contains([latitude, longitude])) continue
      const record = operationalByNumber.current.get(entry.feature.properties.treeNo)
      const labelMarker = leaflet.marker([latitude, longitude], {
          interactive: true,
          keyboard: false,
          icon: treeLabelIcon(
            leaflet,
            entry.feature.properties.treeNo,
            record?.classification ?? null,
          ),
        })
      labelMarker.on("click", (event: LeafletMouseEvent) => {
        leaflet.DomEvent.stopPropagation(event.originalEvent)
        selectAndOpenTreeRef.current?.(entry)
      })
      labels.addLayer(labelMarker)
    }
    if (!map.hasLayer(labels)) labels.addTo(map)
  }, [matchesActiveFilters])

  const refreshJackfruitLabels = useCallback((variant: JackfruitCoordinateVariant) => {
    const map = mapRef.current
    const leaflet = leafletRef.current
    const labels =
      variant === "original"
        ? jackfruitLabelLayer.current
        : variant === "translated"
          ? translatedJackfruitLabelLayer.current
          : affineJackfruitLabelLayer.current
    if (!map || !leaflet || !labels) return

    labels.clearLayers()
    const enabled =
      variant === "original"
        ? jackfruitEnabledRef.current
        : variant === "translated"
          ? translatedJackfruitEnabledRef.current
          : affineJackfruitEnabledRef.current
    const canShow = enabled && map.getZoom() >= LABEL_ZOOM
    if (!canShow) {
      if (map.hasLayer(labels)) labels.remove()
      return
    }

    const visibleBounds = map.getBounds().pad(0.08)
    const entries =
      variant === "original"
        ? jackfruitByCanonicalId.current.values()
        : variant === "translated"
          ? translatedJackfruitByCanonicalId.current.values()
          : affineJackfruitByCanonicalId.current.values()
    for (const entry of entries) {
      const [longitude, latitude] = entry.feature.geometry.coordinates
      if (!visibleBounds.contains([latitude, longitude])) continue
      const labelMarker = leaflet.marker([latitude, longitude], {
        interactive: true,
        keyboard: false,
        icon: jackfruitLabelIcon(leaflet, entry.feature.properties.treeNo, variant),
      })
      labelMarker.on("click", (event: LeafletMouseEvent) => {
        leaflet.DomEvent.stopPropagation(event.originalEvent)
        selectAndOpenJackfruitRef.current?.(entry)
      })
      labels.addLayer(labelMarker)
    }
    if (!map.hasLayer(labels)) labels.addTo(map)
  }, [])

  const applyJackfruitMapState = useCallback((variant: JackfruitCoordinateVariant) => {
    const map = mapRef.current
    const points =
      variant === "original"
        ? jackfruitPointLayer.current
        : variant === "translated"
          ? translatedJackfruitPointLayer.current
          : affineJackfruitPointLayer.current
    const hits =
      variant === "original"
        ? jackfruitHitLayer.current
        : variant === "translated"
          ? translatedJackfruitHitLayer.current
          : affineJackfruitHitLayer.current
    if (!map || !points || !hits) return

    points.clearLayers()
    hits.clearLayers()
    let selectedEntry: JackfruitMapEntry | null = null
    const colour = variant === "original" ? "#ff00ff" : variant === "translated" ? "#00e5ff" : "#dfff00"
    const entries =
      variant === "original"
        ? jackfruitByCanonicalId.current.values()
        : variant === "translated"
          ? translatedJackfruitByCanonicalId.current.values()
          : affineJackfruitByCanonicalId.current.values()
    for (const entry of entries) {
      const selected = selectedJackfruitIdRef.current === `${variant}:${entry.feature.properties.canonicalId}`
      entry.marker.setRadius(selected ? 7 : 5)
      entry.marker.setStyle({
        color: colour,
        fillColor: colour,
        fillOpacity: variant === "affine" ? 0.9 : selected ? 0.14 : 0,
        opacity: 1,
        weight: selected ? 4 : 2.5,
      })
      if (selected) selectedEntry = entry
      points.addLayer(entry.marker)
      hits.addLayer(entry.hitMarker)
    }

    const enabled =
      variant === "original"
        ? jackfruitEnabledRef.current
        : variant === "translated"
          ? translatedJackfruitEnabledRef.current
          : affineJackfruitEnabledRef.current
    const canShow = enabled && map.getZoom() >= MARKER_ZOOM
    if (canShow && !map.hasLayer(points)) points.addTo(map)
    if (!canShow && map.hasLayer(points)) points.remove()
    if (canShow && !map.hasLayer(hits)) hits.addTo(map)
    if (!canShow && map.hasLayer(hits)) hits.remove()
    selectedEntry?.marker.bringToFront()
    refreshJackfruitLabels(variant)
  }, [refreshJackfruitLabels])

  const applyMapState = useCallback(() => {
    const map = mapRef.current
    if (!map) return

    for (const plot of ["Plot 1", "Plot 2"] as PlotName[]) {
      pointLayers.current[plot]?.clearLayers()
      hitLayers.current[plot]?.clearLayers()
    }
    let selectedEntry: TreeMapEntry | null = null
    for (const entry of treesByNumber.current.values()) {
      const treeNo = entry.feature.properties.treeNo
      const record = operationalByNumber.current.get(treeNo)
      const style = classificationStyle(record?.classification)
      const selected = selectedTreeNoRef.current === treeNo
      entry.marker.setRadius(selected ? 7 : 4.5)
      entry.marker.setStyle({
        color: selected ? style.selectedBorder : style.border,
        fillColor: style.fill,
        fillOpacity: 0.92,
        opacity: 1,
        weight: selected ? 4 : 1.5,
      })
      if (selected) selectedEntry = entry
      if (matchesActiveFilters(entry)) {
        pointLayers.current[entry.feature.properties.plot]?.addLayer(entry.marker)
        hitLayers.current[entry.feature.properties.plot]?.addLayer(entry.hitMarker)
      }
    }

    const canShowPoints = treeMarkersEnabledRef.current && map.getZoom() >= MARKER_ZOOM
    for (const plot of ["Plot 1", "Plot 2"] as PlotName[]) {
      const layer = pointLayers.current[plot]
      if (!layer) continue
      const plotAllowed =
        plotFilterRef.current === "Plot 1 & Plot 2" || plotFilterRef.current === plot
      if (canShowPoints && plotAllowed && !map.hasLayer(layer)) layer.addTo(map)
      if ((!canShowPoints || !plotAllowed) && map.hasLayer(layer)) layer.remove()
    }
    for (const plot of ["Plot 1", "Plot 2"] as PlotName[]) {
      const layer = hitLayers.current[plot]
      if (!layer) continue
      const plotAllowed =
        plotFilterRef.current === "Plot 1 & Plot 2" || plotFilterRef.current === plot
      if (canShowPoints && plotAllowed && !map.hasLayer(layer)) layer.addTo(map)
      if ((!canShowPoints || !plotAllowed) && map.hasLayer(layer)) layer.remove()
    }
    selectedEntry?.marker.bringToFront()
    refreshLabels()
  }, [matchesActiveFilters, refreshLabels])

  const recalculateJoinState = useCallback(() => {
    const nextCounts = Object.fromEntries([
      ...PERFORMANCE_CLASSIFICATIONS.map((classification) => [classification, 0]),
      ["Unknown/unmatched", 0],
    ]) as Record<string, number>
    let unmatched = 0

    for (const treeNo of treesByNumber.current.keys()) {
      const record = operationalByNumber.current.get(treeNo)
      if (!record) unmatched += 1
      nextCounts[classificationFilterKey(record?.classification)] += 1
    }
    let withoutSpatial = 0
    for (const treeNo of operationalByNumber.current.keys()) {
      if (!treesByNumber.current.has(treeNo)) withoutSpatial += 1
    }
    setCounts(nextCounts)
    setUnmatchedSpatial(unmatched)
    setOperationalWithoutSpatial(withoutSpatial)
    return { unmatched, withoutSpatial }
  }, [])

  const loadOperationalData = useCallback(async () => {
    setDataState((current) => (current === "ready" ? current : "loading"))
    try {
      const response = await fetch("/api/farm-map/trees", { cache: "no-store" })
      if (!response.ok) throw new Error(`Farm Map API returned ${response.status}`)
      const payload = validateOperationalPayload(await response.json())
      operationalByNumber.current = new Map(payload.records.map((record) => [record.treeNo, record]))
      setDataAsOf(payload.classificationAsOf ?? payload.generatedAt)
      const join = recalculateJoinState()
      const complete =
        treesByNumber.current.size === 0 || (join.unmatched === 0 && join.withoutSpatial === 0)
      const generatedAt = Date.parse(payload.generatedAt)
      const stale = Number.isNaN(generatedAt) || Date.now() - generatedAt > OPERATIONAL_REFRESH_MS * 2
      setDataState(complete ? (stale ? "stale" : "ready") : "partial")
      applyMapState()
    } catch (error) {
      console.error("[farm-map-operational-data]", error)
      operationalByNumber.current.clear()
      setDataAsOf(null)
      setDataState("error")
      recalculateJoinState()
      applyMapState()
    }
  }, [applyMapState, recalculateJoinState])

  const selectAndOpenTree = useCallback(
    (entry: TreeMapEntry) => {
      const treeNo = entry.feature.properties.treeNo
      const map = mapRef.current
      const leaflet = leafletRef.current
      if (!map || !leaflet) return

      selectedJackfruitIdRef.current = null
      selectedTreeNoRef.current = treeNo
      applyJackfruitMapState("original")
      applyJackfruitMapState("translated")
      applyJackfruitMapState("affine")
      applyMapState()
      const record = operationalByNumber.current.get(treeNo)
      const [longitude, latitude] = entry.feature.geometry.coordinates
      const popup =
        activePopupRef.current ??
        leaflet.popup({
          autoClose: true,
          closeButton: true,
          closeOnClick: false,
          maxWidth: 390,
          offset: leaflet.point(0, -8),
        })
      popup
        .setLatLng([latitude, longitude])
        .setContent(popupHtml(entry.feature, record))
        .openOn(map)
      activePopupRef.current = popup
      setStatus(`Tree ${treeNo} selected in ${entry.feature.properties.plot}.`)
    },
    [applyJackfruitMapState, applyMapState],
  )

  const selectAndOpenJackfruit = useCallback(
    (entry: JackfruitMapEntry) => {
      const map = mapRef.current
      const leaflet = leafletRef.current
      if (!map || !leaflet) return

      selectedTreeNoRef.current = null
      selectedJackfruitIdRef.current = `${entry.variant}:${entry.feature.properties.canonicalId}`
      applyMapState()
      applyJackfruitMapState("original")
      applyJackfruitMapState("translated")
      applyJackfruitMapState("affine")
      const [longitude, latitude] = entry.feature.geometry.coordinates
      const popup =
        activePopupRef.current ??
        leaflet.popup({
          autoClose: true,
          closeButton: true,
          closeOnClick: false,
          maxWidth: 340,
          offset: leaflet.point(0, -8),
        })
      popup
        .setLatLng([latitude, longitude])
        .setContent(jackfruitPopupHtml(entry.feature, entry.variant))
        .openOn(map)
      activePopupRef.current = popup
      setStatus(`Jackfruit tree ${entry.feature.properties.treeNo} selected (${entry.variant} coordinates).`)
    },
    [applyJackfruitMapState, applyMapState],
  )

  useEffect(() => {
    selectAndOpenTreeRef.current = selectAndOpenTree
    return () => {
      selectAndOpenTreeRef.current = null
    }
  }, [selectAndOpenTree])

  useEffect(() => {
    selectAndOpenJackfruitRef.current = selectAndOpenJackfruit
    return () => {
      selectAndOpenJackfruitRef.current = null
    }
  }, [selectAndOpenJackfruit])

  const handleTreeHit = useCallback(
    (event: LeafletMouseEvent) => {
      const map = mapRef.current
      const leaflet = leafletRef.current
      if (!map || !leaflet) return

      const candidates = Array.from(treesByNumber.current.values())
        .filter(matchesActiveFilters)
        .map((entry) => {
          const [longitude, latitude] = entry.feature.geometry.coordinates
          const point = map.latLngToContainerPoint([latitude, longitude])
          return {
            id: entry.feature.properties.treeNo,
            value: entry,
            x: point.x,
            y: point.y,
          }
        })
      const nearest = nearestTreeHit(
        candidates,
        { x: event.containerPoint.x, y: event.containerPoint.y },
        hitRadiusRef.current,
      )
      if (!nearest) return

      leaflet.DomEvent.stopPropagation(event.originalEvent)
      selectAndOpenTree(nearest.value)
    },
    [matchesActiveFilters, selectAndOpenTree],
  )

  const handleJackfruitHit = useCallback(
    (event: LeafletMouseEvent) => {
      const map = mapRef.current
      const leaflet = leafletRef.current
      if (!map || !leaflet) return

      const entries = [
        ...(jackfruitEnabledRef.current ? jackfruitByCanonicalId.current.values() : []),
        ...(translatedJackfruitEnabledRef.current ? translatedJackfruitByCanonicalId.current.values() : []),
        ...(affineJackfruitEnabledRef.current ? affineJackfruitByCanonicalId.current.values() : []),
      ]
      const candidates = Array.from(entries).map((entry) => {
        const [longitude, latitude] = entry.feature.geometry.coordinates
        const point = map.latLngToContainerPoint([latitude, longitude])
        return {
          id: `${entry.variant}:${entry.feature.properties.canonicalId}`,
          value: entry,
          x: point.x,
          y: point.y,
        }
      })
      const nearest = nearestTreeHit(
        candidates,
        { x: event.containerPoint.x, y: event.containerPoint.y },
        hitRadiusRef.current,
      )
      if (!nearest) return

      leaflet.DomEvent.stopPropagation(event.originalEvent)
      selectAndOpenJackfruit(nearest.value)
    },
    [selectAndOpenJackfruit],
  )

  const handleMapReady = useCallback(
    (map: LeafletMap, leaflet: LeafletApi) => {
      let cancelled = false
      mapRef.current = map
      leafletRef.current = leaflet
      pointLayers.current = { "Plot 1": leaflet.layerGroup(), "Plot 2": leaflet.layerGroup() }
      hitLayers.current = { "Plot 1": leaflet.layerGroup(), "Plot 2": leaflet.layerGroup() }
      labelLayer.current = leaflet.layerGroup()
      jackfruitPointLayer.current = leaflet.layerGroup()
      jackfruitHitLayer.current = leaflet.layerGroup()
      jackfruitLabelLayer.current = leaflet.layerGroup()
      translatedJackfruitPointLayer.current = leaflet.layerGroup()
      translatedJackfruitHitLayer.current = leaflet.layerGroup()
      translatedJackfruitLabelLayer.current = leaflet.layerGroup()
      affineJackfruitPointLayer.current = leaflet.layerGroup()
      affineJackfruitHitLayer.current = leaflet.layerGroup()
      affineJackfruitLabelLayer.current = leaflet.layerGroup()
      const canvasRenderer = leaflet.canvas({ padding: 0.5 })
      const updateHitRadius = () => {
        hitRadiusRef.current = treeHitRadiusPx({
          coarsePointer: window.matchMedia?.("(pointer: coarse)").matches ?? false,
          viewportWidth: window.innerWidth,
        })
        for (const entry of treesByNumber.current.values()) {
          entry.hitMarker.setRadius(hitRadiusRef.current)
        }
        for (const entry of jackfruitByCanonicalId.current.values()) {
          entry.hitMarker.setRadius(hitRadiusRef.current)
        }
        for (const entry of translatedJackfruitByCanonicalId.current.values()) {
          entry.hitMarker.setRadius(hitRadiusRef.current)
        }
        for (const entry of affineJackfruitByCanonicalId.current.values()) {
          entry.hitMarker.setRadius(hitRadiusRef.current)
        }
      }
      updateHitRadius()
      window.addEventListener("resize", updateHitRadius)

      const mapChangeHandler = () => {
        applyMapState()
        applyJackfruitMapState("original")
        applyJackfruitMapState("translated")
        applyJackfruitMapState("affine")
      }
      map.on("zoomend moveend", mapChangeHandler)

      void fetch(farmCombinedLayer.coordinatesUrl, { cache: "force-cache" })
        .then(async (response) => {
          if (!response.ok) throw new Error(`Coordinate GeoJSON returned ${response.status}`)
          return validateCoordinateCollection(await response.json())
        })
        .then((collection) => {
          if (cancelled) return
          const nextOptions: TreeNumberOption[] = []
          for (const feature of collection.features) {
            const [longitude, latitude] = feature.geometry.coordinates
            const marker = leaflet.circleMarker([latitude, longitude], {
              renderer: canvasRenderer,
              radius: 4.5,
              weight: 1.5,
              color: UNKNOWN_CLASSIFICATION_STYLE.border,
              fillColor: UNKNOWN_CLASSIFICATION_STYLE.fill,
              fillOpacity: 0.92,
              interactive: false,
              bubblingMouseEvents: false,
            })
            const hitMarker = leaflet.circleMarker([latitude, longitude], {
              renderer: canvasRenderer,
              radius: hitRadiusRef.current,
              stroke: false,
              fill: true,
              fillOpacity: 0,
              interactive: true,
              bubblingMouseEvents: false,
            })
            const entry: TreeMapEntry = { feature, marker, hitMarker }
            hitMarker
              .bindTooltip(`Tree ${escapeHtml(feature.properties.treeNo)}`, { direction: "top" })
              .on("click", handleTreeHit)
            treesByNumber.current.set(feature.properties.treeNo, entry)
            nextOptions.push({
              key: treeNumberOptionKey(feature.properties.treeNo, feature.properties.plot),
              treeNo: feature.properties.treeNo,
              plot: feature.properties.plot,
            })
          }
          setGeometryOptions(nextOptions)
          setGeometryState("ready")
          setStatus(`${EXPECTED_TREE_COUNT.toLocaleString("en-IN")} approved coconut-tree coordinates loaded.`)
          const join = recalculateJoinState()
          if (operationalByNumber.current.size > 0) {
            setDataState(join.unmatched === 0 && join.withoutSpatial === 0 ? "ready" : "partial")
          }
          applyMapState()
        })
        .catch((error: unknown) => {
          console.error("[farm-map-coordinates]", error)
          setGeometryState("error")
          setStatus("Approved tree coordinates could not be loaded.")
        })

      const loadJackfruitVariant = async (
        variant: JackfruitCoordinateVariant,
        url: string,
        collectionTarget: Map<string, JackfruitMapEntry>,
        setVariantCount: (count: number) => void,
        setVariantState: (state: "loading" | "ready" | "error") => void,
      ) => {
        try {
          const response = await fetch(url, { cache: "force-cache" })
          if (!response.ok) throw new Error(`Jackfruit ${variant} GeoJSON returned ${response.status}`)
          const collection = validateJackfruitCoordinateCollection(await response.json())
          if (cancelled) return
          const colour = variant === "original" ? "#ff00ff" : variant === "translated" ? "#00e5ff" : "#dfff00"
          for (const feature of collection.features) {
            const [longitude, latitude] = feature.geometry.coordinates
            const marker = leaflet.circleMarker([latitude, longitude], {
              renderer: canvasRenderer,
              radius: variant === "affine" ? 3.5 : 5,
              weight: variant === "affine" ? 1.5 : 2.5,
              color: variant === "affine" ? "#374400" : colour,
              fillColor: colour,
              fillOpacity: variant === "affine" ? 0.9 : 0,
              interactive: false,
              bubblingMouseEvents: false,
            })
            const hitMarker = leaflet.circleMarker([latitude, longitude], {
              renderer: canvasRenderer,
              radius: hitRadiusRef.current,
              stroke: false,
              fill: true,
              fillOpacity: 0,
              interactive: true,
              bubblingMouseEvents: false,
            })
            const entry: JackfruitMapEntry = { feature, marker, hitMarker, variant }
            hitMarker
              .bindTooltip(`${variant} Jackfruit tree ${escapeHtml(feature.properties.treeNo)}`, { direction: "top" })
              .on("click", handleJackfruitHit)
            collectionTarget.set(feature.properties.canonicalId, entry)
          }
          setVariantCount(collection.features.length)
          setVariantState("ready")
          applyJackfruitMapState(variant)
        } catch (error) {
          console.error(`[farm-map-jackfruit-${variant}-coordinates]`, error)
          setVariantState("error")
        }
      }

      void loadJackfruitVariant(
        "original",
        farmCombinedLayer.jackfruitOriginalCoordinatesUrl,
        jackfruitByCanonicalId.current,
        setJackfruitCount,
        setJackfruitState,
      )
      void loadJackfruitVariant(
        "translated",
        farmCombinedLayer.jackfruitTranslatedCoordinatesUrl,
        translatedJackfruitByCanonicalId.current,
        setTranslatedJackfruitCount,
        setTranslatedJackfruitState,
      )
      void loadJackfruitVariant(
        "affine",
        farmCombinedLayer.jackfruitAffineCoordinatesUrl,
        affineJackfruitByCanonicalId.current,
        setAffineJackfruitCount,
        setAffineJackfruitState,
      )
      void loadOperationalData()
      const refreshTimer = window.setInterval(() => void loadOperationalData(), OPERATIONAL_REFRESH_MS)

      return () => {
        cancelled = true
        window.clearInterval(refreshTimer)
        window.removeEventListener("resize", updateHitRadius)
        map.off("zoomend moveend", mapChangeHandler)
        activePopupRef.current?.remove()
        activePopupRef.current = null
        pointLayers.current["Plot 1"]?.remove()
        pointLayers.current["Plot 2"]?.remove()
        hitLayers.current["Plot 1"]?.remove()
        hitLayers.current["Plot 2"]?.remove()
        labelLayer.current?.remove()
        jackfruitPointLayer.current?.remove()
        jackfruitHitLayer.current?.remove()
        jackfruitLabelLayer.current?.remove()
        translatedJackfruitPointLayer.current?.remove()
        translatedJackfruitHitLayer.current?.remove()
        translatedJackfruitLabelLayer.current?.remove()
        affineJackfruitPointLayer.current?.remove()
        affineJackfruitHitLayer.current?.remove()
        affineJackfruitLabelLayer.current?.remove()
        pointLayers.current = { "Plot 1": null, "Plot 2": null }
        hitLayers.current = { "Plot 1": null, "Plot 2": null }
        labelLayer.current = null
        jackfruitPointLayer.current = null
        jackfruitHitLayer.current = null
        jackfruitLabelLayer.current = null
        translatedJackfruitPointLayer.current = null
        translatedJackfruitHitLayer.current = null
        translatedJackfruitLabelLayer.current = null
        affineJackfruitPointLayer.current = null
        affineJackfruitHitLayer.current = null
        affineJackfruitLabelLayer.current = null
        treesByNumber.current.clear()
        jackfruitByCanonicalId.current.clear()
        translatedJackfruitByCanonicalId.current.clear()
        affineJackfruitByCanonicalId.current.clear()
        operationalByNumber.current.clear()
        setGeometryOptions([])
        mapRef.current = null
        leafletRef.current = null
      }
    },
    [
      applyJackfruitMapState,
      applyMapState,
      handleJackfruitHit,
      handleTreeHit,
      loadOperationalData,
      recalculateJoinState,
    ],
  )

  function updateVisibilitySettings(settings: {
    markers?: boolean
    labels?: boolean
    plot?: PlotFilter
    classification?: ClassificationFilter
  }) {
    if (settings.markers !== undefined) {
      treeMarkersEnabledRef.current = settings.markers
      setTreeMarkersEnabled(settings.markers)
    }
    if (settings.labels !== undefined) {
      treeLabelsEnabledRef.current = settings.labels
      setTreeLabelsEnabled(settings.labels)
    }
    if (settings.plot !== undefined) {
      plotFilterRef.current = settings.plot
      setPlotFilter(settings.plot)
    }
    if (settings.classification !== undefined) {
      classificationFilterRef.current = settings.classification
      setClassificationFilter(settings.classification)
    }
    applyMapState()
  }

  function updateJackfruitVisibility(variant: JackfruitCoordinateVariant, enabled: boolean) {
    if (variant === "original") {
      jackfruitEnabledRef.current = enabled
      setJackfruitEnabled(enabled)
    } else if (variant === "translated") {
      translatedJackfruitEnabledRef.current = enabled
      setTranslatedJackfruitEnabled(enabled)
    } else {
      affineJackfruitEnabledRef.current = enabled
      setAffineJackfruitEnabled(enabled)
    }
    applyJackfruitMapState(variant)
  }

  function fitToJackfruitArea() {
    mapRef.current?.fitBounds(jackfruitBounds, { padding: [12, 12], maxZoom: 20 })
  }

  function selectMappedTree(option: TreeNumberOption) {
    const canonical = canonicalTreeNo(option.treeNo)
    const entry = canonical ? treesByNumber.current.get(canonical) : undefined
    if (!entry) {
      setStatus("TreeNo is absent from the approved coordinate layer.")
      return
    }
    if (!treeMarkersEnabled) updateVisibilitySettings({ markers: true })
    const [longitude, latitude] = entry.feature.geometry.coordinates
    mapRef.current?.setView([latitude, longitude], 21)
    setSearchTreeNo(entry.feature.properties.treeNo)
    setStatus(`Tree ${entry.feature.properties.treeNo} selected in ${entry.feature.properties.plot}.`)
    selectAndOpenTree(entry)
  }

  function handleInvalidTreeNumber(value: string) {
    const canonical = canonicalTreeNo(value)
    if (canonical && treesByNumber.current.has(canonical)) {
      const entry = treesByNumber.current.get(canonical)!
      if (plotFilter !== "Plot 1 & Plot 2" && entry.feature.properties.plot !== plotFilter) {
        setStatus(
          `Tree found in ${entry.feature.properties.plot}. Select ${entry.feature.properties.plot} or Plot 1 & Plot 2.`,
        )
        return
      }
    }
    setStatus("Select an exact valid TreeNo, including its decimal where applicable.")
  }

  const warning =
    dataState === "error"
      ? "Operational data is unavailable. Coordinates remain visible in neutral grey; grey does not mean Sapling."
      : dataState === "stale"
        ? "Operational data loaded, but its generated-at time is stale. Marker colours may not reflect the latest classification refresh."
      : dataState === "partial"
        ? `Partial join: ${unmatchedSpatial} spatial trees unmatched; ${operationalWithoutSpatial} operational records lack approved coordinates.`
        : null

  return (
    <FarmOrthomosaicMap
      mapTitle={
        <>
          <span>MFMS Farm Map — Preview/UAT</span>
          <span className="ml-2 normal-case tracking-normal text-red-600">
            Markers from zoom {MARKER_ZOOM}; TreeNo labels from zoom {LABEL_ZOOM}.
          </span>
        </>
      }
      onMapReady={handleMapReady}
      note="The orthomosaic contains no tree markers or classifications. Approved coordinates are joined by canonical TreeNo to current MFMS operational data and restyled after each refresh."
      contentBelowMap={
        <ClassificationLegend
          counts={counts}
          activeFilter={classificationFilter}
          onFilter={(filter) => updateVisibilitySettings({ classification: filter })}
        />
      }
    >
      <>
      <Panel title="Coconut Trees" icon={Trees}>
        <div className="grid gap-3">
          {warning ? (
            <div className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs font-medium text-amber-950">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>{warning}</span>
            </div>
          ) : null}

          <label className="flex cursor-pointer items-center justify-between rounded-lg border border-border bg-background px-3 py-2.5 text-sm font-medium text-foreground">
            <span>Tree markers</span>
            <input
              type="checkbox"
              checked={treeMarkersEnabled}
              onChange={(event) => updateVisibilitySettings({ markers: event.target.checked })}
              className="size-4 accent-primary"
            />
          </label>
          <label className="flex cursor-pointer items-center justify-between rounded-lg border border-border bg-background px-3 py-2.5 text-sm font-medium text-foreground">
            <span>TreeNo labels</span>
            <input
              type="checkbox"
              checked={treeLabelsEnabled}
              onChange={(event) => updateVisibilitySettings({ labels: event.target.checked })}
              className="size-4 accent-primary"
            />
          </label>

          <label className="grid gap-1.5 text-sm font-medium text-foreground">
            Plot
            <select
              value={plotFilter}
              onChange={(event) =>
                updateVisibilitySettings({ plot: event.target.value as PlotFilter })
              }
              className="h-10 rounded-md border border-border bg-background px-3 text-sm"
            >
              <option>Plot 1</option>
              <option>Plot 2</option>
              <option>Plot 1 &amp; Plot 2</option>
            </select>
          </label>

          <label className="grid gap-1.5 text-sm font-medium text-foreground">
            Performance filter
            <select
              value={classificationFilter}
              onChange={(event) =>
                updateVisibilitySettings({
                  classification: event.target.value as ClassificationFilter,
                })
              }
              className="h-10 rounded-md border border-border bg-background px-3 text-sm"
            >
              <option>All</option>
              {PERFORMANCE_CLASSIFICATIONS.map((classification) => (
                <option key={classification}>{classification}</option>
              ))}
              <option>Unknown/unmatched</option>
            </select>
          </label>

          <div className="grid gap-1.5">
            <label htmlFor="farm-map-tree-search" className="text-sm font-medium text-foreground">
              TreeNo search
            </label>
            <TreeNumberAutocomplete
              id="farm-map-tree-search"
              value={searchTreeNo}
              options={availableOptions}
              loading={geometryState === "loading"}
              loadError={geometryState === "error"}
              placeholder="Exact TreeNo, e.g. 141.1"
              showPlot={plotFilter === "Plot 1 & Plot 2"}
              onValueChange={setSearchTreeNo}
              onSelect={selectMappedTree}
              onInvalidCommit={handleInvalidTreeNumber}
              onRetry={() => window.location.reload()}
            />
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => void loadOperationalData()}
            disabled={dataState === "loading"}
          >
            <RefreshCw className="mr-2 size-4" aria-hidden="true" />
            Refresh current classifications
          </Button>

          <p className="text-xs text-muted-foreground" aria-live="polite">
            {status}
          </p>
          <p className="text-xs text-muted-foreground">
            Operational data as of: {formatTimestamp(dataAsOf)}
          </p>
          <p className="text-xs text-muted-foreground">
            Plot 1: 954 corrected coordinates · Plot 2: 1,163 unchanged coordinates
          </p>
        </div>
      </Panel>

      <Panel title="Jackfruit Coordinate Comparison" icon={Trees}>
        <div className="grid gap-3">
          <label className="flex cursor-pointer items-center justify-between rounded-lg border border-fuchsia-300 bg-fuchsia-50 px-3 py-2.5 text-sm font-medium text-fuchsia-950">
            <span>Original Jackfruit points — magenta</span>
            <input
              type="checkbox"
              checked={jackfruitEnabled}
              onChange={(event) => updateJackfruitVisibility("original", event.target.checked)}
              className="size-4 accent-fuchsia-600"
            />
          </label>
          <label className="flex cursor-pointer items-center justify-between rounded-lg border border-cyan-300 bg-cyan-50 px-3 py-2.5 text-sm font-medium text-cyan-950">
            <span>Previous translation — cyan baseline</span>
            <input
              type="checkbox"
              checked={translatedJackfruitEnabled}
              onChange={(event) => updateJackfruitVisibility("translated", event.target.checked)}
              className="size-4 accent-cyan-600"
            />
          </label>
          <label className="flex cursor-pointer items-center justify-between rounded-lg border border-lime-400 bg-lime-50 px-3 py-2.5 text-sm font-medium text-lime-950">
            <span>Jackfruit affine correction — review only</span>
            <input
              type="checkbox"
              checked={affineJackfruitEnabled}
              onChange={(event) => updateJackfruitVisibility("affine", event.target.checked)}
              className="size-4 accent-lime-600"
            />
          </label>
          <Button type="button" variant="outline" onClick={fitToJackfruitArea}>
            Fit to Jackfruit area
          </Button>
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {jackfruitState === "loading"
              ? "Loading Jackfruit coordinates…"
              : jackfruitState === "error"
                ? "Jackfruit coordinates could not be loaded."
                : `${jackfruitCount.toLocaleString("en-IN")} original coordinates loaded.`}
          </p>
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {translatedJackfruitState === "loading"
              ? "Loading previous translated baseline…"
              : translatedJackfruitState === "error"
                ? "Previous translated baseline could not be loaded."
                : `${translatedJackfruitCount.toLocaleString("en-IN")} previous translated coordinates loaded; approval revoked.`}
          </p>
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {affineJackfruitState === "loading"
              ? "Loading affine correction proposal…"
              : affineJackfruitState === "error"
                ? "Affine correction proposal could not be loaded."
                : `${affineJackfruitCount.toLocaleString("en-IN")} affine-proposal coordinates loaded for manual review.`}
          </p>
          <p className="text-xs font-medium text-amber-800">
            Comparison only. No Jackfruit coordinate layer is approved. These layers are not joined to coconut performance classifications.
          </p>
        </div>
      </Panel>
      </>
    </FarmOrthomosaicMap>
  )
}
