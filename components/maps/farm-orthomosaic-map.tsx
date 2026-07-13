"use client"

import type { ReactNode } from "react"
import { useEffect, useRef, useState } from "react"
import { Layers, MapPinned, Maximize2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Panel } from "@/components/farm/panel"
import { farmCombinedLayer, plotBounds, type Coordinate } from "@/lib/farm-map-data"

export type LeafletMap = {
  fitBounds: (bounds: Coordinate[], options?: Record<string, unknown>) => void
  setView: (center: Coordinate, zoom: number, options?: Record<string, unknown>) => void
  remove: () => void
}

export type LeafletTileLayer = {
  addTo: (map: LeafletMap) => LeafletTileLayer
  remove: () => void
}

export type LeafletCircleMarker = {
  addTo: (target: LeafletMap | LeafletLayerGroup) => LeafletCircleMarker
  bindTooltip: (content: string, options?: Record<string, unknown>) => LeafletCircleMarker
  on: (eventName: string, handler: () => void) => LeafletCircleMarker
  getElement?: () => SVGElement | undefined
}

export type LeafletDivIcon = Record<string, unknown>

export type LeafletMarker = {
  addTo: (target: LeafletMap | LeafletLayerGroup) => LeafletMarker
  bindPopup: (content: string, options?: Record<string, unknown>) => LeafletMarker
  bindTooltip: (content: string, options?: Record<string, unknown>) => LeafletMarker
  on: (eventName: string, handler: () => void) => LeafletMarker
  getElement?: () => HTMLElement | undefined
}

export type LeafletLayerGroup = {
  addTo: (map: LeafletMap) => LeafletLayerGroup
  clearLayers: () => void
  remove: () => void
}

export type LeafletApi = {
  map: (element: HTMLElement, options: Record<string, unknown>) => LeafletMap
  tileLayer: (url: string, options: Record<string, unknown>) => LeafletTileLayer
  circleMarker: (latlng: Coordinate, options: Record<string, unknown>) => LeafletCircleMarker
  divIcon: (options: Record<string, unknown>) => LeafletDivIcon
  marker: (latlng: Coordinate, options: Record<string, unknown>) => LeafletMarker
  layerGroup: () => LeafletLayerGroup
}

declare global {
  interface Window {
    L?: LeafletApi
  }
}

interface FarmOrthomosaicMapProps {
  mapTitle?: string
  note?: string
  className?: string
  mapHeightClassName?: string
  showLayerControls?: boolean
  showFitControls?: boolean
  showDetails?: boolean
  controlsPlacement?: "side" | "below"
  onMapReady?: (map: LeafletMap, leaflet: LeafletApi) => void | (() => void)
  children?: ReactNode
}

const LEAFLET_CSS_ID = "mfms-leaflet-css"
const LEAFLET_SCRIPT_ID = "mfms-leaflet-script"
const FARM_FIT_PADDING: [number, number] = [8, 8]

function loadLeaflet(): Promise<LeafletApi> {
  if (window.L) return Promise.resolve(window.L)

  return new Promise((resolve, reject) => {
    if (!document.getElementById(LEAFLET_CSS_ID)) {
      const link = document.createElement("link")
      link.id = LEAFLET_CSS_ID
      link.rel = "stylesheet"
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      document.head.appendChild(link)
    }

    const existingScript = document.getElementById(LEAFLET_SCRIPT_ID) as HTMLScriptElement | null
    if (existingScript) {
      existingScript.addEventListener("load", () => (window.L ? resolve(window.L) : reject(new Error("Leaflet unavailable"))))
      existingScript.addEventListener("error", () => reject(new Error("Leaflet failed to load")))
      return
    }

    const script = document.createElement("script")
    script.id = LEAFLET_SCRIPT_ID
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
    script.async = true
    script.onload = () => (window.L ? resolve(window.L) : reject(new Error("Leaflet unavailable")))
    script.onerror = () => reject(new Error("Leaflet failed to load"))
    document.body.appendChild(script)
  })
}

function fullBounds(): Coordinate[] {
  return farmCombinedLayer.bounds
}

export function FarmOrthomosaicMap({
  mapTitle = "Drone Orthomosaic Map",
  note = "Drone orthomosaic preview. Tree points, wells, beetle traps, and pipeline overlays will be added later.",
  className = "",
  mapHeightClassName = "h-[54vh] min-h-[360px]",
  showLayerControls = true,
  showFitControls = true,
  showDetails = true,
  controlsPlacement = "side",
  onMapReady,
  children,
}: FarmOrthomosaicMapProps) {
  const mapElementRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const tileRef = useRef<LeafletTileLayer | null>(null)
  const [layerEnabled, setLayerEnabled] = useState(true)
  const [status, setStatus] = useState("Loading map…")

  useEffect(() => {
    let cancelled = false
    let overlayCleanup: void | (() => void)

    loadLeaflet()
      .then((leaflet) => {
        if (cancelled || !mapElementRef.current) return

        const map = leaflet.map(mapElementRef.current, {
          center: farmCombinedLayer.center,
          zoom: farmCombinedLayer.defaultZoom,
          minZoom: farmCombinedLayer.minZoom,
          maxZoom: farmCombinedLayer.maxZoom,
          zoomControl: true,
          zoomSnap: 0.1,
          zoomDelta: 0.5,
          attributionControl: Boolean(farmCombinedLayer.attribution),
        })
        mapRef.current = map

        const tile = leaflet.tileLayer(farmCombinedLayer.tileUrl, {
          minZoom: farmCombinedLayer.minZoom,
          maxZoom: farmCombinedLayer.maxZoom,
          tms: false,
          opacity: 1,
          attribution: farmCombinedLayer.attribution,
        })
        tileRef.current = tile
        tile.addTo(map)

        map.setView(farmCombinedLayer.center, farmCombinedLayer.initialPresentationZoom, { animate: false })
        overlayCleanup = onMapReady?.(map, leaflet)
        setStatus("Combined farm orthomosaic loaded.")
      })
      .catch(() => setStatus("Map library could not load. Please check internet connection and try again."))

    return () => {
      cancelled = true
      overlayCleanup?.()
      mapRef.current?.remove()
      mapRef.current = null
      tileRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const tile = tileRef.current
    if (!map || !tile) return

    if (layerEnabled) {
      tile.addTo(map)
    } else {
      tile.remove()
    }
  }, [layerEnabled])

  function fitTo(bounds: Coordinate[]) {
    mapRef.current?.fitBounds(bounds, { padding: FARM_FIT_PADDING })
  }

  const mapPanel = (
    <Panel
      title={mapTitle}
      icon={MapPinned}
      bodyClassName="p-0"
      headerRight={<span className="text-xs font-medium text-muted-foreground">{status}</span>}
    >
      <div className={`${mapHeightClassName} overflow-hidden rounded-b-xl bg-muted`}>
        <div ref={mapElementRef} className="h-full w-full" aria-label="Farm drone orthomosaic map" />
      </div>
    </Panel>
  )

  const layerControls = showLayerControls ? (
    <Panel title="Layer Controls" icon={Layers}>
      <label className="flex cursor-pointer items-center justify-between rounded-lg border border-border bg-background px-3 py-2.5 text-sm font-medium text-foreground">
        <span>{farmCombinedLayer.name}</span>
        <input
          type="checkbox"
          checked={layerEnabled}
          onChange={() => setLayerEnabled((current) => !current)}
          className="size-4 accent-primary"
        />
      </label>
    </Panel>
  ) : null

  const fitControls = showFitControls ? (
    <Panel title="Map View" icon={Maximize2}>
      <div className={controlsPlacement === "below" ? "grid gap-2 sm:grid-cols-3" : "grid gap-2"}>
        <Button type="button" onClick={() => fitTo(plotBounds.plot1)}>
          Fit to Plot 1
        </Button>
        <Button type="button" onClick={() => fitTo(plotBounds.plot2)}>
          Fit to Plot 2
        </Button>
        <Button type="button" variant="outline" onClick={() => fitTo(fullBounds())}>
          Fit to Full Farm
        </Button>
      </div>
    </Panel>
  ) : null

  const detailsPanel = showDetails ? (
    <Panel title="Orthomosaic Details" icon={MapPinned}>
      <div className="rounded-lg bg-muted/60 p-3 text-sm">
        <p className="font-bold text-foreground">{farmCombinedLayer.name}</p>
        <p className="mt-1 text-muted-foreground">Source: {farmCombinedLayer.metadata.source}</p>
        <p className="text-muted-foreground">Web CRS: {farmCombinedLayer.metadata.webCrs}</p>
        <p className="text-muted-foreground">Zoom levels: {farmCombinedLayer.metadata.zoomLevels}</p>
        <p className="text-muted-foreground">Tile format: {farmCombinedLayer.metadata.tileFormat}</p>
      </div>
    </Panel>
  ) : null

  const notePanel = note ? <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground">{note}</div> : null

  if (controlsPlacement === "below") {
    return (
      <div className={`flex flex-col gap-4 ${className}`}>
        {mapPanel}
        {fitControls}
        {layerControls}
        {children}
        {detailsPanel}
        {notePanel}
      </div>
    )
  }

  return (
    <div className={`grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px] ${className}`}>
      {mapPanel}

      <div className="flex flex-col gap-5">
        {layerControls}
        {fitControls}
        {children}
        {detailsPanel}
        {notePanel}
      </div>
    </div>
  )
}
