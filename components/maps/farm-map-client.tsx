"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Trees } from "lucide-react"

import { Panel } from "@/components/farm/panel"
import { FarmMapTreeSearch } from "@/components/maps/farm-map-tree-search"
import {
  FarmMapOrthomosaic,
  type LeafletApi,
  type LeafletCircleMarker,
  type LeafletLayerGroup,
  type LeafletMap,
  type LeafletMarker,
} from "@/components/maps/farm-map-orthomosaic"
import { farmMapLayer } from "@/lib/farm-map-layer"
import { CROP_STYLES, FARM_CROPS, FARM_TREE_SOURCES, readFarmTreeCollection, visibleFarmLabelKeys, type FarmCrop, type FarmMapTree } from "@/lib/farm-map-trees"

type PlotName = "Plot 1" | "Plot 2"
type PlotFilter = "Plot 1 & Plot 2" | PlotName

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
  tree: FarmMapTree
  marker: LeafletCircleMarker
  label: LeafletMarker | null
}

interface TreeClassificationRow {
  treeNo: string
  classification: string | null
}

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
  crop: FarmCrop = "Coconut",
) {
  const colour = crop === "Coconut" ? TREE_LABEL_COLOURS[classification ?? ""] ?? DEFAULT_TREE_LABEL_COLOUR : { background: CROP_STYLES[crop].colour, text: "#ffffff", shadow: "#334155" }
  return leaflet.divIcon({
    className: "farm-tree-number-label",
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

function popupHtml(tree: FarmMapTree, summary?: TreeHarvestSummary, error?: string) {
  const treeNo = escapeHtml(tree.treeNo)
  const crop = escapeHtml(tree.crop)
  const plot = escapeHtml(tree.plot ?? "")
  if (tree.crop !== "Coconut") {
    return `<div style="min-width:170px;font-family:inherit"><strong>${crop}</strong><div>TreeNo: ${treeNo}</div></div>`
  }
  const fullDetailsHref = `/coconut-harvest/tree-view?treeNo=${encodeURIComponent(tree.treeNo)}`

  if (error) {
    return `
      <div style="min-width:230px;font-family:inherit">
        <strong>${crop} · TreeNo: ${treeNo}</strong><div>${plot}</div>
        <p style="margin:8px 0;color:#64748b">${escapeHtml(error)}</p>
        <a href="${fullDetailsHref}" style="font-weight:700;color:#166534">View Full Harvest Details</a>
      </div>`
  }
  if (!summary) {
    return `<div style="min-width:210px;font-family:inherit"><strong>${crop} · TreeNo: ${treeNo}</strong><div>${plot}</div><p style="margin:8px 0">Loading Harvest data…</p></div>`
  }

  const rows = [
    ["Crop", crop],
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
  const pointLayers = useRef(new Map<string, LeafletLayerGroup>())
  const labelLayer = useRef<LeafletLayerGroup | null>(null)
  const treesByKey = useRef(new Map<string, TreeMapEntry>())
  const cache = useRef(new Map<string, { expiresAt: number; summary: TreeHarvestSummary }>())
  const classifications = useRef(new Map<string, string | null>())
  const selectedKey = useRef<string | null>(null)
  const treeNumbersEnabledRef = useRef(true)
  const plotFilterRef = useRef<PlotFilter>("Plot 1 & Plot 2")
  const visibleCropsRef = useRef<Record<FarmCrop, boolean>>({ Coconut: true, Jackfruit: true, Nutmeg: true })

  const [treeNumbersEnabled, setTreeNumbersEnabled] = useState(true)
  const [plotFilter, setPlotFilter] = useState<PlotFilter>("Plot 1 & Plot 2")
  const [visibleCrops, setVisibleCrops] = useState<Record<FarmCrop, boolean>>({ Coconut: true, Jackfruit: true, Nutmeg: true })
  const [status, setStatus] = useState("Loading Coconut, Jackfruit and Nutmeg trees…")
  const [trees, setTrees] = useState<FarmMapTree[]>([])
  const [loading, setLoading] = useState(true)

  const applyVisibility = useCallback(() => {
    const map = mapRef.current
    const leaflet = leafletRef.current
    if (!map || !leaflet) return

    for (const source of FARM_TREE_SOURCES) {
      const points = pointLayers.current.get(`${source.crop}:${source.plot ?? ""}`)
      const allowed = visibleCropsRef.current[source.crop] && (!source.plot || plotFilterRef.current === "Plot 1 & Plot 2" || plotFilterRef.current === source.plot)
      if (points) {
        if (allowed && !map.hasLayer(points)) points.addTo(map)
        if (!allowed && map.hasLayer(points)) points.remove()
      }
    }

    const labels = labelLayer.current
    if (!labels) return
    labels.clearLayers()
    // No HTML label markers exist at the full-farm extent.
    for (const entry of treesByKey.current.values()) entry.label = null
    if (!treeNumbersEnabledRef.current || map.getZoom() < LABEL_ZOOM) return

    const candidates = []
    for (const entry of treesByKey.current.values()) {
      const tree = entry.tree
      if (!visibleCropsRef.current[tree.crop] || (tree.plot && plotFilterRef.current !== "Plot 1 & Plot 2" && tree.plot !== plotFilterRef.current)) continue
      const [longitude, latitude] = tree.coordinates
      const point = map.latLngToContainerPoint([latitude, longitude])
      const candidate = { key: tree.key, treeNo: tree.treeNo, ...point }
      if (tree.key === selectedKey.current) candidates.unshift(candidate)
      else candidates.push(candidate)
    }
    const size = map.getSize()
    for (const key of visibleFarmLabelKeys(candidates, size.x, size.y)) {
      const entry = treesByKey.current.get(key)!
      const [longitude, latitude] = entry.tree.coordinates
      entry.label = leaflet.marker([latitude, longitude], {
        interactive: false,
        keyboard: false,
        icon: treeLabelIcon(leaflet, entry.tree.treeNo, classifications.current.get(entry.tree.treeNo), entry.tree.crop),
      })
      labels.addLayer(entry.label)
    }
  }, [])

  const selectTree = useCallback(async (entry: TreeMapEntry) => {
    const tree = entry.tree
    const treeNo = tree.treeNo
    const cacheKey = tree.key
    selectedKey.current = cacheKey
    entry.marker.bindPopup(popupHtml(tree), { maxWidth: 330 }).openPopup()
    applyVisibility()
    if (tree.crop !== "Coconut") return

    const showSummary = (summary?: TreeHarvestSummary, error?: string) => {
      if (selectedKey.current === cacheKey && mapRef.current) {
        entry.marker.bindPopup(popupHtml(tree, summary, error), { maxWidth: 330 }).openPopup()
      }
    }
    const cached = cache.current.get(cacheKey)
    if (cached && cached.expiresAt > Date.now()) {
      showSummary(cached.summary)
      return
    }
    try {
      const response = await fetch(`/api/farm-map/trees/${encodeURIComponent(treeNo)}/harvest-summary`, { cache: "no-store" })
      if (response.status === 404) {
        showSummary(undefined, "No Harvest data")
        return
      }
      if (!response.ok) throw new Error("Unable to load Harvest data")
      const summary = (await response.json()) as TreeHarvestSummary
      cache.current.set(cacheKey, { expiresAt: Date.now() + SUMMARY_CACHE_MS, summary })
      showSummary(summary)
    } catch {
      showSummary(undefined, "Harvest information is temporarily unavailable.")
    }
  }, [applyVisibility])

  const handleMapReady = useCallback((map: LeafletMap, leaflet: LeafletApi) => {
    let cancelled = false
    mapRef.current = map
    leafletRef.current = leaflet
    labelLayer.current = leaflet.layerGroup().addTo(map)
    map.on("zoomend", applyVisibility)
    map.on("moveend", applyVisibility)
    map.on("resize", applyVisibility)

    void fetchTreeClassifications().then((loaded) => {
      if (cancelled || !loaded) return
      classifications.current = loaded
      applyVisibility()
    })

    Promise.all(FARM_TREE_SOURCES.map(async (source) => {
      const response = await fetch(source.url, { cache: "force-cache" })
      if (!response.ok) throw new Error(`Unable to load ${source.crop} trees`)
      return { source, trees: readFarmTreeCollection(await response.json(), source) }
    })).then((sources) => {
      if (cancelled) return
      const loadedTrees = sources.flatMap((source) => source.trees)
      if (new Set(loadedTrees.map((tree) => tree.key)).size !== loadedTrees.length) throw new Error("Duplicate crop and Tree Number")
      for (const { source, trees: sourceTrees } of sources) {
        const points = leaflet.layerGroup()
        pointLayers.current.set(`${source.crop}:${source.plot ?? ""}`, points)
        for (const tree of sourceTrees) {
          const [longitude, latitude] = tree.coordinates
          const marker = leaflet.circleMarker([latitude, longitude], {
            radius: 4,
            weight: 1,
            color: "#ffffff",
            fillColor: CROP_STYLES[tree.crop].colour,
            fillOpacity: 0.9,
          })
          const entry: TreeMapEntry = { tree, marker, label: null }
          marker.bindTooltip(`${tree.crop} · TreeNo: ${escapeHtml(tree.treeNo)}`, { direction: "top" })
            .on("click", () => void selectTree(entry))
          points.addLayer(marker)
          treesByKey.current.set(tree.key, entry)
        }
      }
      setTrees(loadedTrees)
      setLoading(false)
      setStatus(`${loadedTrees.length.toLocaleString("en-IN")} trees loaded across all three crops.`)
      applyVisibility()
    }).catch(() => {
      if (cancelled) return
      setLoading(false)
      setStatus("Tree geometry could not be loaded. Please reload the map.")
    })

    return () => {
      cancelled = true
      map.off("zoomend", applyVisibility)
      map.off("moveend", applyVisibility)
      map.off("resize", applyVisibility)
      for (const points of pointLayers.current.values()) points.remove()
      pointLayers.current.clear()
      labelLayer.current?.remove()
      labelLayer.current = null
      treesByKey.current.clear()
      selectedKey.current = null
      mapRef.current = null
      leafletRef.current = null
    }
  }, [applyVisibility, selectTree])

  useEffect(() => {
    treeNumbersEnabledRef.current = treeNumbersEnabled
    plotFilterRef.current = plotFilter
    visibleCropsRef.current = visibleCrops
    applyVisibility()
  }, [applyVisibility, plotFilter, treeNumbersEnabled, visibleCrops])

  function selectMappedTree(tree: FarmMapTree) {
    const entry = treesByKey.current.get(tree.key)
    if (!entry) {
      setStatus("Select a valid Tree Number from the available list.")
      return
    }
    visibleCropsRef.current = { ...visibleCropsRef.current, [tree.crop]: true }
    setVisibleCrops(visibleCropsRef.current)
    if (tree.plot && plotFilterRef.current !== "Plot 1 & Plot 2" && plotFilterRef.current !== tree.plot) {
      plotFilterRef.current = "Plot 1 & Plot 2"
      setPlotFilter("Plot 1 & Plot 2")
    }
    const [longitude, latitude] = tree.coordinates
    applyVisibility()
    mapRef.current?.setView([latitude, longitude], 21, { animate: false })
    setStatus(`${tree.crop} TreeNo ${tree.treeNo} selected${tree.plot ? ` in ${tree.plot}` : ""}.`)
    void selectTree(entry)
  }

  const treeControls = (
    <Panel title="Tree Layers & Legend" icon={Trees}>
      <div className="grid gap-3">
        {FARM_CROPS.map((crop) => (
          <label key={crop} className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2.5 text-sm font-medium">
            <span className="flex items-center gap-2">
              <span aria-hidden="true" className="size-3 rounded-full border border-white" style={{ backgroundColor: CROP_STYLES[crop].colour }} />
              {crop} · {CROP_STYLES[crop].count.toLocaleString("en-IN")}
            </span>
            <input type="checkbox" aria-label={`Show ${crop} trees`} checked={visibleCrops[crop]} onChange={(event) => setVisibleCrops((current) => ({ ...current, [crop]: event.target.checked }))} className="size-4 accent-primary" />
          </label>
        ))}
        <p className="text-sm font-semibold">Total: 3,433 trees</p>
        <label className="flex min-h-11 cursor-pointer items-center justify-between rounded-lg border border-border px-3 py-2.5 text-sm">
          <span>Tree Numbers</span>
          <input type="checkbox" checked={treeNumbersEnabled} onChange={(event) => setTreeNumbersEnabled(event.target.checked)} className="size-4 accent-primary" />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          Coconut plot layer
          <select value={plotFilter} onChange={(event) => setPlotFilter(event.target.value as PlotFilter)} className="h-11 rounded-md border border-border bg-background px-3 text-sm">
            <option>Plot 1</option>
            <option>Plot 2</option>
            <option>Plot 1 &amp; Plot 2</option>
          </select>
        </label>
        <FarmMapTreeSearch trees={trees} loading={loading} onSelect={selectMappedTree} onInvalidCommit={() => setStatus("Select a valid Tree Number from the available list.")} />
        <p className="text-xs text-muted-foreground" aria-live="polite">{status}</p>
        <p className="text-xs text-muted-foreground">All crop points are visible at full-farm zoom. Numbers appear from zoom {LABEL_ZOOM} where space allows. Tap any point for its crop and exact TreeNo.</p>
      </div>
    </Panel>
  )

  return (
    <FarmMapOrthomosaic
      layer={farmMapLayer}
      fitInitialBounds
      preferCanvas
      mapTitle="Drone Orthomosaic Map"
      onMapReady={handleMapReady}
      note="Coconut, Jackfruit and Nutmeg trees share the full-farm orthophoto. Search includes all crops, including hidden layers. Coconut Harvest information loads when a tree is selected."
      contentBelowMap={<TreeClassificationLegend />}
    >
      {treeControls}
    </FarmMapOrthomosaic>
  )
}
