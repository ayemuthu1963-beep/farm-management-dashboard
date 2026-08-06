"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Trees } from "lucide-react"

import { Panel } from "@/components/farm/panel"
import { TreeNumberAutocomplete } from "@/components/harvest/tree-number-autocomplete"
import {
  FarmOrthomosaicMap,
  type LeafletApi,
  type LeafletCircleMarker,
  type LeafletLayerGroup,
  type LeafletMap,
  type LeafletMarker,
} from "@/components/maps/farm-orthomosaic-map"
import {
  treeNumberOptionKey,
  type TreeNumberOption,
} from "@/lib/tree-number-options"

type PlotName = "Plot 1" | "Plot 2"
type PlotFilter = "Plot 1 & Plot 2" | PlotName

interface CoconutTreeFeature {
  type: "Feature"
  geometry: {
    type: "Point"
    coordinates: [number, number]
  }
  properties: {
    TreeNo: string
    Plot: PlotName
  }
}

interface CoconutTreeCollection {
  type: "FeatureCollection"
  features: CoconutTreeFeature[]
}

interface TreeHarvestSummary {
  treeNo: string
  status: string | null
  classification: string | null
  lastHarvestDate: string | null
  latestBunches: number | null
  latestNuts: number | null
  currentYearTotalNuts: number | null
  missedHarvestCycles: number | null
  hasHarvestData: boolean
}

interface TreeMapEntry {
  feature: CoconutTreeFeature
  marker: LeafletCircleMarker
  label: LeafletMarker
}

interface TreeClassificationRow {
  treeNo: string
  classification: string | null
}

const TREE_SOURCES: Array<{ plot: PlotName; url: string }> = [
  { plot: "Plot 1", url: "/map-data/vector/plot1-coconut-trees-v1.geojson" },
  { plot: "Plot 2", url: "/map-data/vector/plot2-coconut-trees-v1.geojson" },
]
const MARKER_ZOOM = 18
const LABEL_ZOOM = 20
const SUMMARY_CACHE_MS = 5 * 60 * 1000

const TREE_LABEL_COLOURS: Record<string, { background: string; text: string; shadow: string }> = {
  "Century Maker": { background: "#166534", text: "#ffffff", shadow: "#14532d" },
  "Match Winner": { background: "#15803d", text: "#ffffff", shadow: "#14532d" },
  "Reliable Batter": { background: "#1d4ed8", text: "#ffffff", shadow: "#1e3a8a" },
  "Tail Ender": { background: "#f59e0b", text: "#111827", shadow: "#fef3c7" },
  "Bench Player": { background: "#b91c1c", text: "#ffffff", shadow: "#7f1d1d" },
  "Future Better": { background: "#7e22ce", text: "#ffffff", shadow: "#581c87" },
}

const DEFAULT_TREE_LABEL_COLOUR = {
  background: "rgba(255,255,255,.82)",
  text: "#0f172a",
  shadow: "#ffffff",
}

const TREE_CLASSIFICATION_LEGENDS = [
  {
    title: "Plot 1: Tree numbers 1 to 999",
    rows: [
      { badge: "💯", category: "Century Maker", criteria: "Over 400 nuts in last 10 harvests" },
      { badge: "🔥", category: "Match Winner", criteria: "300 to 399 nuts in last 10 harvests" },
      { badge: "👍", category: "Reliable Batter", criteria: "225 to 299 nuts in last 10 harvests" },
      { badge: "😬", category: "Tail Ender", criteria: "175 to 224 nuts in last 10 harvests" },
      { badge: "🪑", category: "Bench Player", criteria: "Less than 175 nuts in last 10 harvests" },
      { badge: "🌱", category: "Future Better", criteria: "Saplings under 36 completed months" },
    ],
  },
  {
    title: "Plot 2: Tree numbers above 1000",
    rows: [
      { badge: "🔥", category: "Match Winner", criteria: "200 to 299 nuts in last 10 harvests" },
      { badge: "👍", category: "Reliable Batter", criteria: "150 to 199 nuts in last 10 harvests" },
      { badge: "😬", category: "Tail Ender", criteria: "100 to 149 nuts in last 10 harvests" },
      { badge: "🪑", category: "Bench Player", criteria: "Less than 100 nuts in last 10 harvests" },
      { badge: "🌱", category: "Future Better", criteria: "Saplings under 36 completed months" },
    ],
  },
] as const

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}

function display(value: string | number | null) {
  if (value === null || value === "") return "—"
  return typeof value === "number" ? value.toLocaleString("en-IN") : escapeHtml(value)
}

function treeLabelIcon(
  leaflet: LeafletApi,
  treeNo: string,
  classification: string | null | undefined,
) {
  const colour = TREE_LABEL_COLOURS[classification ?? ""] ?? DEFAULT_TREE_LABEL_COLOUR
  return leaflet.divIcon({
    className: "",
    html: `<span style="display:inline-block;transform:translate(-50%,-130%);padding:1px 3px;border-radius:3px;background:${colour.background};color:${colour.text};font:700 10px/1.2 sans-serif;text-shadow:0 0 2px ${colour.shadow};white-space:nowrap">${escapeHtml(treeNo)}</span>`,
    iconSize: [1, 1],
  })
}

function TreeClassificationLegend() {
  return (
    <Panel title="Tree Classification Colour Legend" icon={Trees}>
      <div className="grid gap-5 xl:grid-cols-2">
        {TREE_CLASSIFICATION_LEGENDS.map((legend) => (
          <section key={legend.title} className="min-w-0">
            <h3 className="mb-2 text-sm font-bold text-foreground">{legend.title}</h3>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[540px] border-collapse text-sm">
                <thead>
                  <tr className="bg-primary/10 text-left text-xs font-semibold uppercase tracking-wide text-primary">
                    <th className="border-r border-border px-3 py-2">Category</th>
                    <th className="border-r border-border px-3 py-2 text-center">Colour Code</th>
                    <th className="px-3 py-2">Criteria</th>
                  </tr>
                </thead>
                <tbody>
                  {legend.rows.map((row) => {
                    const colour = TREE_LABEL_COLOURS[row.category]
                    return (
                      <tr key={row.category} className="border-t border-border">
                        <td className="whitespace-nowrap border-r border-border px-3 py-2 font-semibold text-foreground">
                          <span aria-hidden="true">{row.badge}</span> {row.category}
                        </td>
                        <td className="border-r border-border px-3 py-2 text-center">
                          <span
                            className="inline-flex min-w-12 items-center justify-center rounded px-2 py-1 text-xs font-bold"
                            style={{
                              backgroundColor: colour.background,
                              color: colour.text,
                              textShadow: `0 0 2px ${colour.shadow}`,
                            }}
                          >
                            1234
                          </span>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{row.criteria}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </Panel>
  )
}

async function fetchTreeClassifications(): Promise<Map<string, string | null> | null> {
  try {
    const response = await fetch("/api/farm-map/tree-classifications", { cache: "no-store" })
    if (!response.ok) return null

    const data = (await response.json()) as { rows?: unknown }
    if (!Array.isArray(data.rows)) return null

    return new Map(
      data.rows
        .filter(
          (row): row is TreeClassificationRow =>
            typeof row === "object" &&
            row !== null &&
            typeof (row as TreeClassificationRow).treeNo === "string" &&
            ((row as TreeClassificationRow).classification === null ||
              typeof (row as TreeClassificationRow).classification === "string"),
        )
        .map((row) => [row.treeNo, row.classification]),
    )
  } catch {
    return null
  }
}

function popupHtml(feature: CoconutTreeFeature, summary?: TreeHarvestSummary, error?: string) {
  const treeNo = escapeHtml(feature.properties.TreeNo)
  const plot = escapeHtml(feature.properties.Plot)
  const fullDetailsHref = `/coconut-harvest/tree-view?treeNo=${encodeURIComponent(feature.properties.TreeNo)}`

  if (error) {
    return `
      <div style="min-width:230px;font-family:inherit">
        <strong>Tree ${treeNo}</strong><div>${plot}</div>
        <p style="margin:8px 0;color:#64748b">${escapeHtml(error)}</p>
        <a href="${fullDetailsHref}" style="font-weight:700;color:#166534">View Full Harvest Details</a>
      </div>`
  }
  if (!summary) {
    return `<div style="min-width:210px;font-family:inherit"><strong>Tree ${treeNo}</strong><div>${plot}</div><p style="margin:8px 0">Loading Harvest data…</p></div>`
  }

  const rows = [
    ["Tree Number", treeNo],
    ["Plot", plot],
    ["Status", display(summary.status)],
    ["Classification", display(summary.classification)],
    ["Last Harvest Date", display(summary.lastHarvestDate)],
    ["Latest Bunches", display(summary.latestBunches)],
    ["Latest Nuts", display(summary.latestNuts)],
    ["Current-Year Total Nuts", display(summary.currentYearTotalNuts)],
    ["Missed Harvest Cycles", display(summary.missedHarvestCycles)],
  ]
  const noData = summary.hasHarvestData
    ? ""
    : `<p style="margin:8px 0;font-weight:700;color:#64748b">No Harvest data</p>`

  return `
    <div style="min-width:250px;font-family:inherit">
      ${noData}
      <table style="width:100%;border-collapse:collapse">
        ${rows
          .map(
            ([label, value]) =>
              `<tr><th style="padding:3px 8px 3px 0;text-align:left;color:#475569">${label}</th><td style="padding:3px 0;text-align:right;font-weight:700">${value}</td></tr>`,
          )
          .join("")}
      </table>
      <a href="${fullDetailsHref}" style="display:inline-block;margin-top:10px;font-weight:700;color:#166534">View Full Harvest Details</a>
    </div>`
}

export function FarmMapClient() {
  const mapRef = useRef<LeafletMap | null>(null)
  const leafletRef = useRef<LeafletApi | null>(null)
  const pointLayers = useRef<Record<PlotName, LeafletLayerGroup | null>>({
    "Plot 1": null,
    "Plot 2": null,
  })
  const labelLayers = useRef<Record<PlotName, LeafletLayerGroup | null>>({
    "Plot 1": null,
    "Plot 2": null,
  })
  const treesByKey = useRef(new Map<string, TreeMapEntry>())
  const treesByNumber = useRef(new Map<string, TreeMapEntry[]>())
  const cache = useRef(new Map<string, { expiresAt: number; summary: TreeHarvestSummary }>())
  const treeNumbersEnabledRef = useRef(true)
  const plotFilterRef = useRef<PlotFilter>("Plot 1 & Plot 2")

  const [treeNumbersEnabled, setTreeNumbersEnabled] = useState(true)
  const [plotFilter, setPlotFilter] = useState<PlotFilter>("Plot 1 & Plot 2")
  const [searchTreeNo, setSearchTreeNo] = useState("")
  const [status, setStatus] = useState("Loading coconut tree geometry…")
  const [counts, setCounts] = useState<Record<PlotName, number>>({ "Plot 1": 0, "Plot 2": 0 })
  const [geometryOptions, setGeometryOptions] = useState<TreeNumberOption[]>([])
  const [treeMasterNumbers, setTreeMasterNumbers] = useState<Set<string>>(new Set())
  const [treeMasterState, setTreeMasterState] = useState<"loading" | "ready" | "error">(
    "loading",
  )

  const validMappedOptions = useMemo(
    () => geometryOptions.filter((option) => treeMasterNumbers.has(option.treeNo)),
    [geometryOptions, treeMasterNumbers],
  )
  const availableOptions = useMemo(
    () =>
      plotFilter === "Plot 1 & Plot 2"
        ? validMappedOptions
        : validMappedOptions.filter((option) => option.plot === plotFilter),
    [plotFilter, validMappedOptions],
  )

  const applyVisibility = useCallback(() => {
    const map = mapRef.current
    if (!map) return

    const zoom = map.getZoom()
    for (const plot of ["Plot 1", "Plot 2"] as PlotName[]) {
      const plotAllowed =
        plotFilterRef.current === "Plot 1 & Plot 2" || plotFilterRef.current === plot
      const showPoints = treeNumbersEnabledRef.current && plotAllowed && zoom >= MARKER_ZOOM
      const showLabels = treeNumbersEnabledRef.current && plotAllowed && zoom >= LABEL_ZOOM
      const points = pointLayers.current[plot]
      const labels = labelLayers.current[plot]

      if (points) {
        if (showPoints && !map.hasLayer(points)) points.addTo(map)
        if (!showPoints && map.hasLayer(points)) points.remove()
      }
      if (labels) {
        if (showLabels && !map.hasLayer(labels)) labels.addTo(map)
        if (!showLabels && map.hasLayer(labels)) labels.remove()
      }
    }
  }, [])

  const selectTree = useCallback(async (entry: TreeMapEntry) => {
    const treeNo = entry.feature.properties.TreeNo
    const cacheKey = treeNumberOptionKey(treeNo, entry.feature.properties.Plot)
    entry.marker.bindPopup(popupHtml(entry.feature), { maxWidth: 360 }).openPopup()

    const cached = cache.current.get(cacheKey)
    if (cached && cached.expiresAt > Date.now()) {
      entry.marker.bindPopup(popupHtml(entry.feature, cached.summary), { maxWidth: 360 }).openPopup()
      return
    }

    try {
      const response = await fetch(
        `/api/farm-map/trees/${encodeURIComponent(treeNo)}/harvest-summary`,
        { cache: "no-store" },
      )
      if (response.status === 404) {
        entry.marker.bindPopup(popupHtml(entry.feature, undefined, "No Harvest data"), { maxWidth: 360 }).openPopup()
        return
      }
      if (!response.ok) throw new Error("Unable to load Harvest data")
      const summary = (await response.json()) as TreeHarvestSummary
      cache.current.set(cacheKey, { expiresAt: Date.now() + SUMMARY_CACHE_MS, summary })
      entry.marker.bindPopup(popupHtml(entry.feature, summary), { maxWidth: 360 }).openPopup()
    } catch {
      entry.marker
        .bindPopup(popupHtml(entry.feature, undefined, "Harvest information is temporarily unavailable."), {
          maxWidth: 360,
        })
        .openPopup()
    }
  }, [])

  const loadTreeMaster = useCallback(async () => {
    setTreeMasterState("loading")
    try {
      const response = await fetch("/api/coconut-harvest/tree-master", {
        cache: "force-cache",
      })
      if (!response.ok) throw new Error("Unable to load TREE MASTER")

      const data = (await response.json()) as { treeNumbers?: unknown }
      if (
        !Array.isArray(data.treeNumbers) ||
        !data.treeNumbers.every((treeNo) => typeof treeNo === "string")
      ) {
        throw new Error("Invalid TREE MASTER response")
      }

      setTreeMasterNumbers(new Set(data.treeNumbers))
      setTreeMasterState("ready")
    } catch {
      setTreeMasterNumbers(new Set())
      setTreeMasterState("error")
    }
  }, [])

  useEffect(() => {
    void loadTreeMaster()
  }, [loadTreeMaster])

  const handleMapReady = useCallback(
    (map: LeafletMap, leaflet: LeafletApi) => {
      let cancelled = false
      mapRef.current = map
      leafletRef.current = leaflet

      const zoomHandler = () => applyVisibility()
      map.on("zoomend", zoomHandler)

      let classifications: Map<string, string | null> | null = null
      let treeGeometryLoaded = false
      const applyClassificationColours = () => {
        if (!classifications || !treeGeometryLoaded || cancelled) return

        for (const entry of treesByKey.current.values()) {
          const treeNo = entry.feature.properties.TreeNo
          entry.label.setIcon(treeLabelIcon(leaflet, treeNo, classifications.get(treeNo)))
        }
      }

      void fetchTreeClassifications().then((loadedClassifications) => {
        classifications = loadedClassifications
        applyClassificationColours()
      })

      Promise.all(
        TREE_SOURCES.map(async ({ plot, url }) => {
          const response = await fetch(url, { cache: "force-cache" })
          if (!response.ok) throw new Error(`Unable to load ${plot} trees`)
          const collection = (await response.json()) as CoconutTreeCollection
          return { plot, collection }
        }),
      )
        .then((sources) => {
          if (cancelled) return

          const nextCounts: Record<PlotName, number> = { "Plot 1": 0, "Plot 2": 0 }
          const nextGeometryOptions: TreeNumberOption[] = []
          for (const { plot, collection } of sources) {
            const pointLayer = leaflet.layerGroup()
            const labelLayer = leaflet.layerGroup()
            pointLayers.current[plot] = pointLayer
            labelLayers.current[plot] = labelLayer

            for (const feature of collection.features) {
              const [longitude, latitude] = feature.geometry.coordinates
              const marker = leaflet.circleMarker([latitude, longitude], {
                radius: 4,
                weight: 1,
                color: "#ffffff",
                fillColor: "#0f766e",
                fillOpacity: 0.9,
              })
              const treeNo = feature.properties.TreeNo
              const label = leaflet.marker([latitude, longitude], {
                interactive: false,
                icon: treeLabelIcon(leaflet, treeNo, null),
              })
              const entry = { feature, marker, label }
              marker
                .bindTooltip(`Tree ${escapeHtml(treeNo)}`, { direction: "top" })
                .on("click", () => void selectTree(entry))
              pointLayer.addLayer(marker)
              labelLayer.addLayer(label)
              const option = {
                key: treeNumberOptionKey(treeNo, plot),
                treeNo,
                plot,
              }
              treesByKey.current.set(option.key, entry)
              const matchingEntries = treesByNumber.current.get(treeNo) ?? []
              matchingEntries.push(entry)
              treesByNumber.current.set(treeNo, matchingEntries)
              nextGeometryOptions.push(option)
              nextCounts[plot] += 1
            }
          }
          setCounts(nextCounts)
          setGeometryOptions(nextGeometryOptions)
          setStatus(`${nextCounts["Plot 1"] + nextCounts["Plot 2"]} coconut trees loaded.`)
          treeGeometryLoaded = true
          applyClassificationColours()
          applyVisibility()
        })
        .catch(() => setStatus("Coconut tree geometry could not be loaded."))

      return () => {
        cancelled = true
        map.off("zoomend", zoomHandler)
        for (const plot of ["Plot 1", "Plot 2"] as PlotName[]) {
          pointLayers.current[plot]?.remove()
          labelLayers.current[plot]?.remove()
          pointLayers.current[plot] = null
          labelLayers.current[plot] = null
        }
        treesByKey.current.clear()
        treesByNumber.current.clear()
        setGeometryOptions([])
        mapRef.current = null
        leafletRef.current = null
      }
    },
    [applyVisibility, selectTree],
  )

  useEffect(() => {
    treeNumbersEnabledRef.current = treeNumbersEnabled
    plotFilterRef.current = plotFilter
    applyVisibility()
  }, [applyVisibility, plotFilter, treeNumbersEnabled])

  function selectMappedTree(option: TreeNumberOption) {
    const entry = treesByKey.current.get(option.key)
    if (!entry || !treeMasterNumbers.has(option.treeNo)) {
      setStatus("Select a valid Tree Number from the available list.")
      return
    }
    if (!treeNumbersEnabled) setTreeNumbersEnabled(true)
    const [longitude, latitude] = entry.feature.geometry.coordinates
    mapRef.current?.setView([latitude, longitude], 21)
    setSearchTreeNo(option.treeNo)
    setStatus(`Tree ${option.treeNo} selected in ${entry.feature.properties.Plot}.`)
    void selectTree(entry)
  }

  function handleInvalidTreeNumber(value: string) {
    const treeNo = value.trim()
    const mappedEntries = treesByNumber.current.get(treeNo) ?? []
    const treeIsValid = treeMasterNumbers.has(treeNo)

    if (treeIsValid && plotFilter !== "Plot 1 & Plot 2") {
      const otherPlotEntry = mappedEntries.find(
        (entry) => entry.feature.properties.Plot !== plotFilter,
      )
      if (otherPlotEntry) {
        const treePlot = otherPlotEntry.feature.properties.Plot
        setStatus(`Tree found in ${treePlot}. Select ${treePlot} or Plot 1 & Plot 2.`)
        return
      }
    }

    setStatus("Select a valid Tree Number from the available list.")
  }

  const treeControls = (
    <>
      <Panel title="Coconut Trees" icon={Trees}>
        <div className="grid gap-3">
          <label className="flex cursor-pointer items-center justify-between rounded-lg border border-border bg-background px-3 py-2.5 text-sm font-medium text-foreground">
            <span>Tree Numbers</span>
            <input
              type="checkbox"
              checked={treeNumbersEnabled}
              onChange={(event) => setTreeNumbersEnabled(event.target.checked)}
              className="size-4 accent-primary"
            />
          </label>

          <label className="grid gap-1.5 text-sm font-medium text-foreground">
            Plot layer
            <select
              value={plotFilter}
              onChange={(event) => setPlotFilter(event.target.value as PlotFilter)}
              className="h-10 rounded-md border border-border bg-background px-3 text-sm"
            >
              <option>Plot 1</option>
              <option>Plot 2</option>
              <option>Plot 1 &amp; Plot 2</option>
            </select>
          </label>

          <div className="grid gap-1.5">
            <label htmlFor="farm-map-tree-search" className="text-sm font-medium text-foreground">
              Tree Number
            </label>
            <TreeNumberAutocomplete
              id="farm-map-tree-search"
              value={searchTreeNo}
              options={availableOptions}
              loading={treeMasterState === "loading"}
              loadError={treeMasterState === "error"}
              placeholder="Type or select a Tree Number"
              showPlot={plotFilter === "Plot 1 & Plot 2"}
              onValueChange={setSearchTreeNo}
              onSelect={selectMappedTree}
              onInvalidCommit={handleInvalidTreeNumber}
              onRetry={() => void loadTreeMaster()}
            />
          </div>

          <p className="text-xs text-muted-foreground" aria-live="polite">
            {status}
          </p>
          <p className="text-xs text-muted-foreground">
            Plot 1: {counts["Plot 1"].toLocaleString("en-IN")} · Plot 2:{" "}
            {counts["Plot 2"].toLocaleString("en-IN")}
          </p>
          <p className="text-xs text-muted-foreground">
            Points appear from zoom {MARKER_ZOOM}; labels from zoom {LABEL_ZOOM}.
          </p>
        </div>
      </Panel>
    </>
  )

  return (
    <FarmOrthomosaicMap
      mapTitle={
        <>
          <span>Drone Orthomosaic Map</span>
          <span className="ml-2 normal-case tracking-normal text-red-600">
            Zoom in to see tree numbers. Click a tree to view its data.
          </span>
        </>
      }
      onMapReady={handleMapReady}
      note="Coconut tree points are a separate vector overlay. Harvest information is loaded only when a tree is selected."
      contentBelowMap={<TreeClassificationLegend />}
    >
      {treeControls}
    </FarmOrthomosaicMap>
  )
}
