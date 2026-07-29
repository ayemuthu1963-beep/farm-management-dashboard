"use client"

import { FormEvent, useCallback, useEffect, useRef, useState } from "react"
import { Layers, Search, Trees } from "lucide-react"

import { Panel } from "@/components/farm/panel"
import {
  FarmOrthomosaicMap,
  type LeafletApi,
  type LeafletCircleMarker,
  type LeafletLayerGroup,
  type LeafletMap,
} from "@/components/maps/farm-orthomosaic-map"

type PlotName = "Plot 1" | "Plot 2"
type PlotFilter = "All Plots" | PlotName

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
}

const TREE_SOURCES: Array<{ plot: PlotName; url: string }> = [
  { plot: "Plot 1", url: "/map-data/vector/plot1-coconut-trees-v1.geojson" },
  { plot: "Plot 2", url: "/map-data/vector/plot2-coconut-trees-v1.geojson" },
]
const MARKER_ZOOM = 18
const LABEL_ZOOM = 20
const SUMMARY_CACHE_MS = 5 * 60 * 1000

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
  const trees = useRef(new Map<string, TreeMapEntry>())
  const cache = useRef(new Map<string, { expiresAt: number; summary: TreeHarvestSummary }>())
  const treeNumbersEnabledRef = useRef(true)
  const plotFilterRef = useRef<PlotFilter>("All Plots")

  const [treeNumbersEnabled, setTreeNumbersEnabled] = useState(true)
  const [plotFilter, setPlotFilter] = useState<PlotFilter>("All Plots")
  const [searchTreeNo, setSearchTreeNo] = useState("")
  const [status, setStatus] = useState("Loading coconut tree geometry…")
  const [counts, setCounts] = useState<Record<PlotName, number>>({ "Plot 1": 0, "Plot 2": 0 })

  const applyVisibility = useCallback(() => {
    const map = mapRef.current
    if (!map) return

    const zoom = map.getZoom()
    for (const plot of ["Plot 1", "Plot 2"] as PlotName[]) {
      const plotAllowed = plotFilterRef.current === "All Plots" || plotFilterRef.current === plot
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
    entry.marker.bindPopup(popupHtml(entry.feature), { maxWidth: 360 }).openPopup()

    const cached = cache.current.get(treeNo)
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
      cache.current.set(treeNo, { expiresAt: Date.now() + SUMMARY_CACHE_MS, summary })
      entry.marker.bindPopup(popupHtml(entry.feature, summary), { maxWidth: 360 }).openPopup()
    } catch {
      entry.marker
        .bindPopup(popupHtml(entry.feature, undefined, "Harvest information is temporarily unavailable."), {
          maxWidth: 360,
        })
        .openPopup()
    }
  }, [])

  const handleMapReady = useCallback(
    (map: LeafletMap, leaflet: LeafletApi) => {
      let cancelled = false
      mapRef.current = map
      leafletRef.current = leaflet

      const zoomHandler = () => applyVisibility()
      map.on("zoomend", zoomHandler)

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
              const entry = { feature, marker }
              marker
                .bindTooltip(`Tree ${escapeHtml(feature.properties.TreeNo)}`, { direction: "top" })
                .on("click", () => void selectTree(entry))
              pointLayer.addLayer(marker)

              const label = leaflet.marker([latitude, longitude], {
                interactive: false,
                icon: leaflet.divIcon({
                  className: "",
                  html: `<span style="display:inline-block;transform:translate(-50%,-130%);padding:1px 3px;border-radius:3px;background:rgba(255,255,255,.82);color:#0f172a;font:700 10px/1.2 sans-serif;text-shadow:0 0 2px #fff;white-space:nowrap">${escapeHtml(feature.properties.TreeNo)}</span>`,
                  iconSize: [1, 1],
                }),
              })
              labelLayer.addLayer(label)
              trees.current.set(feature.properties.TreeNo, entry)
              nextCounts[plot] += 1
            }
          }
          setCounts(nextCounts)
          setStatus(`${nextCounts["Plot 1"] + nextCounts["Plot 2"]} coconut trees loaded.`)
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
        trees.current.clear()
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

  function runSearch() {
    const treeNo = searchTreeNo.trim()
    if (!treeNo) {
      setStatus("Enter an exact Tree Number.")
      return
    }

    const entry = trees.current.get(treeNo)
    if (!entry) {
      setStatus(`Tree ${treeNo} was not found.`)
      return
    }
    if (plotFilter !== "All Plots" && entry.feature.properties.Plot !== plotFilter) {
      setStatus(`Tree ${treeNo} is outside the selected ${plotFilter} layer.`)
      return
    }

    if (!treeNumbersEnabled) setTreeNumbersEnabled(true)
    const [longitude, latitude] = entry.feature.geometry.coordinates
    mapRef.current?.setView([latitude, longitude], 21)
    setStatus(`Tree ${treeNo} selected in ${entry.feature.properties.Plot}.`)
    void selectTree(entry)
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    runSearch()
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
              <option>All Plots</option>
              <option>Plot 1</option>
              <option>Plot 2</option>
            </select>
          </label>

          <form onSubmit={handleSearch} className="grid gap-1.5">
            <label htmlFor="farm-map-tree-search" className="text-sm font-medium text-foreground">
              Tree Number
            </label>
            <div className="flex gap-2">
              <input
                id="farm-map-tree-search"
                value={searchTreeNo}
                onChange={(event) => setSearchTreeNo(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault()
                    runSearch()
                  }
                }}
                placeholder="Example: 845.1"
                className="h-10 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-sm"
              />
              <button
                type="submit"
                className="inline-flex size-10 items-center justify-center rounded-md bg-primary text-primary-foreground"
                aria-label="Search Tree Number"
              >
                <Search className="size-4" aria-hidden="true" />
              </button>
            </div>
          </form>

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
      onMapReady={handleMapReady}
      note="Coconut tree points are a separate vector overlay. Harvest information is loaded only when a tree is selected."
    >
      {treeControls}
    </FarmOrthomosaicMap>
  )
}
