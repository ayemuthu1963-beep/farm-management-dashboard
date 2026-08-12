"use client"

import { useCallback, useMemo, useRef, useState } from "react"
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
import { farmCombinedLayer } from "@/lib/farm-map-data"
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

const MARKER_ZOOM = 18
const LABEL_ZOOM = 20
const OPERATIONAL_REFRESH_MS = 5 * 60 * 1000
const EXPECTED_TREE_COUNT = 2_117
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

function treeLabelIcon(leaflet: LeafletApi, treeNo: string, classification: string | null) {
  const style = classificationStyle(classification)
  return leaflet.divIcon({
    className: "farm-map-tree-label",
    html: `<span style="pointer-events:none;display:inline-block;transform:translate(-50%,-145%);padding:1px 4px;border:1px solid ${style.border};border-radius:3px;background:${style.fill};color:${style.text};font:800 10px/1.25 sans-serif;box-shadow:0 1px 3px rgba(0,0,0,.55);white-space:nowrap">${escapeHtml(treeNo)}</span>`,
    iconSize: [1, 1],
  })
}

function popupHtml(feature: FarmMapCoordinateFeature, record?: FarmMapOperationalRecord) {
  const treeNo = escapeHtml(feature.properties.treeNo)
  const plot = escapeHtml(feature.properties.plot)
  const [longitude, latitude] = feature.geometry.coordinates
  const detailsHref = `/coconut-harvest/tree-view?treeNo=${encodeURIComponent(feature.properties.treeNo)}`
  const matchStatus = record ? "Matched to current MFMS record" : "Operational record unavailable/unmatched"
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
    ["Data as of", record?.lastUpdated],
    ["Coordinate", `${latitude.toFixed(8)}, ${longitude.toFixed(8)}`],
    ["Coordinate version", feature.properties.coordinateVersion],
    ["Operational match", matchStatus],
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
      <p style="margin:8px 0 0;color:#64748b;font-size:11px">Spatial source: ${escapeHtml(feature.properties.coordinateSource)}</p>
      <a href="${detailsHref}" style="display:inline-block;margin-top:10px;font-weight:700;color:#0f766e">View Full Harvest Details</a>
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
  const treesByNumber = useRef(new Map<string, TreeMapEntry>())
  const operationalByNumber = useRef(new Map<string, FarmMapOperationalRecord>())
  const activePopupRef = useRef<ReturnType<LeafletApi["popup"]> | null>(null)
  const hitRadiusRef = useRef(14)
  const treeMarkersEnabledRef = useRef(true)
  const treeLabelsEnabledRef = useRef(true)
  const plotFilterRef = useRef<PlotFilter>("Plot 1 & Plot 2")
  const classificationFilterRef = useRef<ClassificationFilter>("All")
  const selectedTreeNoRef = useRef<string | null>(null)

  const [treeMarkersEnabled, setTreeMarkersEnabled] = useState(true)
  const [treeLabelsEnabled, setTreeLabelsEnabled] = useState(true)
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
      labels.addLayer(
        leaflet.marker([latitude, longitude], {
          interactive: false,
          keyboard: false,
          icon: treeLabelIcon(
            leaflet,
            entry.feature.properties.treeNo,
            record?.classification ?? null,
          ),
        }),
      )
    }
    if (!map.hasLayer(labels)) labels.addTo(map)
  }, [matchesActiveFilters])

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

      selectedTreeNoRef.current = treeNo
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
    [applyMapState],
  )

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

  const handleMapReady = useCallback(
    (map: LeafletMap, leaflet: LeafletApi) => {
      let cancelled = false
      mapRef.current = map
      leafletRef.current = leaflet
      pointLayers.current = { "Plot 1": leaflet.layerGroup(), "Plot 2": leaflet.layerGroup() }
      hitLayers.current = { "Plot 1": leaflet.layerGroup(), "Plot 2": leaflet.layerGroup() }
      labelLayer.current = leaflet.layerGroup()
      const canvasRenderer = leaflet.canvas({ padding: 0.5 })
      const updateHitRadius = () => {
        hitRadiusRef.current = treeHitRadiusPx({
          coarsePointer: window.matchMedia?.("(pointer: coarse)").matches ?? false,
          viewportWidth: window.innerWidth,
        })
        for (const entry of treesByNumber.current.values()) {
          entry.hitMarker.setRadius(hitRadiusRef.current)
        }
      }
      updateHitRadius()
      window.addEventListener("resize", updateHitRadius)

      const mapChangeHandler = () => applyMapState()
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
        pointLayers.current = { "Plot 1": null, "Plot 2": null }
        hitLayers.current = { "Plot 1": null, "Plot 2": null }
        labelLayer.current = null
        treesByNumber.current.clear()
        operationalByNumber.current.clear()
        setGeometryOptions([])
        mapRef.current = null
        leafletRef.current = null
      }
    },
    [applyMapState, handleTreeHit, loadOperationalData, recalculateJoinState],
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
    </FarmOrthomosaicMap>
  )
}
