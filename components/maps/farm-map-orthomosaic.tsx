"use client"

import type { ReactNode } from "react"
import { useCallback, useEffect, useId, useRef, useState } from "react"
import { Layers, MapPinned, Maximize2, Minimize2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Panel } from "@/components/farm/panel"
import { plotBounds, type Coordinate } from "@/lib/farm-map-data"
import { farmMapLayer, type FarmMapLayer } from "@/lib/farm-map-layer"

export type LeafletMap = {
  fitBounds: (bounds: Coordinate[], options?: Record<string, unknown>) => void
  setView: (center: Coordinate, zoom: number, options?: Record<string, unknown>) => void
  getZoom: () => number
  getSize: () => { x: number; y: number }
  invalidateSize: (options?: Record<string, unknown>) => LeafletMap
  latLngToContainerPoint: (coordinate: Coordinate) => { x: number; y: number }
  hasLayer: (layer: LeafletLayerGroup) => boolean
  on: (eventName: string, handler: () => void) => LeafletMap
  off: (eventName: string, handler: () => void) => LeafletMap
  remove: () => void
}

export type LeafletTileLayer = {
  addTo: (map: LeafletMap) => LeafletTileLayer
  remove: () => void
}

export type LeafletCircleMarker = {
  addTo: (target: LeafletMap | LeafletLayerGroup) => LeafletCircleMarker
  bindPopup: (content: string, options?: Record<string, unknown>) => LeafletCircleMarker
  bindTooltip: (content: string, options?: Record<string, unknown>) => LeafletCircleMarker
  openPopup: () => LeafletCircleMarker
  setStyle: (options: Record<string, unknown>) => LeafletCircleMarker
  on: (eventName: string, handler: () => void) => LeafletCircleMarker
  getElement?: () => SVGElement | undefined
}

export type LeafletCircle = {
  addTo: (target: LeafletMap | LeafletLayerGroup) => LeafletCircle
  getBounds: () => {
    getSouthWest: () => { lat: number; lng: number }
    getNorthEast: () => { lat: number; lng: number }
  }
}

export type LeafletDivIcon = Record<string, unknown>

export type LeafletMarker = {
  addTo: (target: LeafletMap | LeafletLayerGroup) => LeafletMarker
  bindPopup: (content: string, options?: Record<string, unknown>) => LeafletMarker
  bindTooltip: (content: string, options?: Record<string, unknown>) => LeafletMarker
  openPopup: () => LeafletMarker
  on: (eventName: string, handler: () => void) => LeafletMarker
  setIcon: (icon: LeafletDivIcon) => LeafletMarker
  getElement?: () => HTMLElement | undefined
}

export type LeafletLayerGroup = {
  addTo: (map: LeafletMap) => LeafletLayerGroup
  addLayer: (layer: LeafletCircleMarker | LeafletCircle | LeafletMarker) => LeafletLayerGroup
  clearLayers: () => void
  remove: () => void
}

export type LeafletApi = {
  map: (element: HTMLElement, options: Record<string, unknown>) => LeafletMap
  tileLayer: (url: string, options: Record<string, unknown>) => LeafletTileLayer
  circleMarker: (latlng: Coordinate, options: Record<string, unknown>) => LeafletCircleMarker
  circle: (latlng: Coordinate, options: Record<string, unknown>) => LeafletCircle
  latLngBounds: (latlngs: Coordinate[]) => Coordinate[]
  divIcon: (options: Record<string, unknown>) => LeafletDivIcon
  marker: (latlng: Coordinate, options: Record<string, unknown>) => LeafletMarker
  layerGroup: () => LeafletLayerGroup
}

function currentLeaflet(): LeafletApi | undefined {
  return (window as unknown as { L?: LeafletApi }).L
}

interface FarmOrthomosaicMapProps {
  layer?: FarmMapLayer
  fitInitialBounds?: boolean
  preferCanvas?: boolean
  mapTitle?: ReactNode
  note?: string
  className?: string
  mapHeightClassName?: string
  showLayerControls?: boolean
  showFitControls?: boolean
  showDetails?: boolean
  enableFullscreen?: boolean
  controlsPlacement?: "side" | "below"
  onMapReady?: (map: LeafletMap, leaflet: LeafletApi) => void | (() => void)
  children?: ReactNode
  contentBelowMap?: ReactNode
}

const LEAFLET_CSS_ID = "mfms-leaflet-css"
const LEAFLET_SCRIPT_ID = "mfms-leaflet-script"
const FARM_FIT_PADDING: [number, number] = [8, 8]

function loadLeaflet(): Promise<LeafletApi> {
  const existingLeaflet = currentLeaflet()
  if (existingLeaflet) return Promise.resolve(existingLeaflet)

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
      existingScript.addEventListener("load", () => { const leaflet = currentLeaflet(); return leaflet ? resolve(leaflet) : reject(new Error("Leaflet unavailable")) })
      existingScript.addEventListener("error", () => reject(new Error("Leaflet failed to load")))
      return
    }

    const script = document.createElement("script")
    script.id = LEAFLET_SCRIPT_ID
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
    script.async = true
    script.onload = () => { const leaflet = currentLeaflet(); return leaflet ? resolve(leaflet) : reject(new Error("Leaflet unavailable")) }
    script.onerror = () => reject(new Error("Leaflet failed to load"))
    document.body.appendChild(script)
  })
}

export function FarmMapOrthomosaic({
  layer = farmMapLayer,
  fitInitialBounds = false,
  preferCanvas = false,
  mapTitle = "Drone Orthomosaic Map",
  note = "Drone orthomosaic preview. Tree points, wells, beetle traps, and pipeline overlays will be added later.",
  className = "",
  mapHeightClassName = "h-[54vh] min-h-[360px]",
  showLayerControls = true,
  showFitControls = true,
  showDetails = true,
  enableFullscreen = false,
  controlsPlacement = "side",
  onMapReady,
  children,
  contentBelowMap,
}: FarmOrthomosaicMapProps) {
  const mapContainerId = useId()
  const mapElementRef = useRef<HTMLDivElement | null>(null)
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const expandButtonRef = useRef<HTMLButtonElement | null>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const tileRef = useRef<LeafletTileLayer | null>(null)
  const resizeTimerRef = useRef<number | null>(null)
  const wasExpandedRef = useRef(false)
  const [layerEnabled, setLayerEnabled] = useState(true)
  const [status, setStatus] = useState("Loading map…")
  const [fullscreenMode, setFullscreenMode] = useState<"none" | "native" | "fallback">("none")
  const isMapExpanded = fullscreenMode !== "none"

  const resizeMap = useCallback(() => {
    const map = mapRef.current
    if (!map) return

    window.requestAnimationFrame(() => {
      map.invalidateSize({ animate: false, pan: false })
    })
    if (resizeTimerRef.current !== null) window.clearTimeout(resizeTimerRef.current)
    resizeTimerRef.current = window.setTimeout(() => {
      mapRef.current?.invalidateSize({ animate: false, pan: false })
      resizeTimerRef.current = null
    }, 180)
  }, [])

  useEffect(() => {
    let cancelled = false
    let overlayCleanup: void | (() => void)

    loadLeaflet()
      .then(async (leaflet) => {
        if (cancelled || !mapElementRef.current) return

        const { PMTiles, TileType, leafletRasterLayer } = await import("pmtiles")
        const archive = new PMTiles(layer.pmtilesUrl)
        const header = await archive.getHeader()
        if (header.tileType !== TileType.Webp || header.minZoom !== 16 || header.maxZoom !== 22) {
          throw new Error("The orthomosaic archive does not match the approved map")
        }
        if (cancelled || !mapElementRef.current) return

        const map = leaflet.map(mapElementRef.current, {
          center: layer.center,
          zoom: layer.defaultZoom,
          minZoom: layer.minZoom,
          maxZoom: layer.maxZoom,
          preferCanvas,
          zoomControl: true,
          zoomSnap: 0.1,
          zoomDelta: 0.5,
          attributionControl: Boolean(layer.attribution),
        })
        mapRef.current = map

        const tile = leafletRasterLayer(archive, {
          minZoom: layer.minZoom,
          maxZoom: layer.maxZoom,
          maxNativeZoom: 22,
          tileSize: 256,
          ...(fitInitialBounds ? { bounds: layer.bounds, noWrap: true } : {}),
          opacity: 1,
          attribution: layer.attribution,
        }) as LeafletTileLayer
        tileRef.current = tile
        tile.addTo(map)

        if (fitInitialBounds) map.fitBounds(layer.bounds, { padding: FARM_FIT_PADDING, animate: false })
        else map.setView(layer.center, layer.defaultZoom, { animate: false })
        overlayCleanup = onMapReady?.(map, leaflet)
        setStatus("Full-farm orthomosaic loaded.")
      })
      .catch(() => setStatus("Map library could not load. Please check internet connection and try again."))

    return () => {
      cancelled = true
      overlayCleanup?.()
      mapRef.current?.remove()
      mapRef.current = null
      tileRef.current = null
    }
  }, [fitInitialBounds, layer, onMapReady, preferCanvas])

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

  useEffect(() => {
    if (!enableFullscreen) return

    const handleFullscreenChange = () => {
      if (document.fullscreenElement === mapContainerRef.current) {
        setFullscreenMode("native")
        return
      }
      setFullscreenMode((current) => (current === "native" ? "none" : current))
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && fullscreenMode === "fallback") {
        event.preventDefault()
        setFullscreenMode("none")
      }
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [enableFullscreen, fullscreenMode])

  useEffect(() => {
    if (!isMapExpanded) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isMapExpanded])

  useEffect(() => {
    resizeMap()
    if (wasExpandedRef.current && !isMapExpanded) expandButtonRef.current?.focus()
    wasExpandedRef.current = isMapExpanded
  }, [isMapExpanded, resizeMap])

  useEffect(() => {
    if (!enableFullscreen) return
    const fullscreenContainer = mapContainerRef.current
    const handleViewportChange = () => resizeMap()
    window.addEventListener("resize", handleViewportChange)
    window.addEventListener("orientationchange", handleViewportChange)

    const observer =
      typeof ResizeObserver === "undefined" || !mapElementRef.current
        ? null
        : new ResizeObserver(handleViewportChange)
    if (observer && mapElementRef.current) observer.observe(mapElementRef.current)

    return () => {
      window.removeEventListener("resize", handleViewportChange)
      window.removeEventListener("orientationchange", handleViewportChange)
      observer?.disconnect()
      if (resizeTimerRef.current !== null) window.clearTimeout(resizeTimerRef.current)
      if (document.fullscreenElement === fullscreenContainer) void document.exitFullscreen()
    }
  }, [enableFullscreen, resizeMap])

  async function toggleMapExpansion() {
    const container = mapContainerRef.current
    if (!container) return

    if (isMapExpanded) {
      if (document.fullscreenElement === container && document.exitFullscreen) {
        await document.exitFullscreen()
      } else {
        setFullscreenMode("none")
      }
      return
    }

    if (container.requestFullscreen) {
      try {
        await container.requestFullscreen()
        setFullscreenMode("native")
        return
      } catch {
        // The fixed-viewport fallback keeps this control available when native fullscreen is rejected.
      }
    }
    setFullscreenMode("fallback")
  }

  function fitTo(bounds: Coordinate[]) {
    mapRef.current?.fitBounds(bounds, { padding: FARM_FIT_PADDING })
  }

  const mapPanel = (
    <div
      ref={mapContainerRef}
      id={mapContainerId}
      className={isMapExpanded ? "fixed inset-0 z-[1100] h-[100dvh] w-screen bg-background" : "min-w-0"}
    >
      <Panel
        title={mapTitle}
        icon={MapPinned}
        className={isMapExpanded ? "flex h-full min-h-0 flex-col rounded-none border-0" : undefined}
        bodyClassName={isMapExpanded ? "flex min-h-0 flex-1 p-0" : "p-0"}
        headerRight={enableFullscreen ? (
          <div className="flex items-center justify-end gap-2">
            <span className="hidden max-w-64 text-xs font-medium leading-tight text-muted-foreground sm:block" aria-live="polite">
              {isMapExpanded ? "Press Esc to return" : status}
            </span>
            <Button
              ref={expandButtonRef}
              type="button"
              size="sm"
              variant="outline"
              aria-controls={mapContainerId}
              aria-expanded={isMapExpanded}
              aria-keyshortcuts="Escape"
              aria-label={isMapExpanded ? "Exit full screen" : "Open map full screen"}
              title={isMapExpanded ? "Exit full screen (Esc)" : "Open map full screen"}
              onClick={() => void toggleMapExpansion()}
            >
              {isMapExpanded ? <Minimize2 aria-hidden="true" /> : <Maximize2 aria-hidden="true" />}
              <span className="hidden sm:inline">{isMapExpanded ? "Exit Full Screen" : "Full Screen"}</span>
            </Button>
          </div>
        ) : <span className="text-xs font-medium text-muted-foreground">{status}</span>}
      >
        <div
          className={`${isMapExpanded ? "h-full min-h-0 flex-1 rounded-none" : `${mapHeightClassName} rounded-b-xl`} overflow-hidden bg-muted`}
        >
          <div ref={mapElementRef} className="h-full w-full" aria-label="Farm drone orthomosaic map" />
        </div>
      </Panel>
    </div>
  )

  const layerControls = showLayerControls ? (
    <Panel title="Layer Controls" icon={Layers}>
      <label className="flex cursor-pointer items-center justify-between rounded-lg border border-border bg-background px-3 py-2.5 text-sm font-medium text-foreground">
        <span>{layer.name}</span>
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
        <Button type="button" variant="outline" onClick={() => fitTo(layer.bounds)}>
          Fit to Full Farm
        </Button>
      </div>
    </Panel>
  ) : null

  const detailsPanel = showDetails ? (
    <Panel title="Orthomosaic Details" icon={MapPinned}>
      <div className="rounded-lg bg-muted/60 p-3 text-sm">
        <p className="font-bold text-foreground">{layer.name}</p>
        <p className="mt-1 text-muted-foreground">Source: {layer.metadata.source}</p>
        <p className="text-muted-foreground">Web CRS: {layer.metadata.webCrs}</p>
        <p className="text-muted-foreground">Zoom levels: {layer.metadata.zoomLevels}</p>
        <p className="text-muted-foreground">Tile format: {layer.metadata.tileFormat}</p>
      </div>
    </Panel>
  ) : null

  const notePanel = note ? <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground">{note}</div> : null

  if (controlsPlacement === "below") {
    return (
      <div className={`flex flex-col gap-4 ${className}`}>
        {mapPanel}
        {contentBelowMap}
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
      </div>

      {contentBelowMap ? <div className="xl:col-span-2">{contentBelowMap}</div> : null}
      {detailsPanel ? <div className="xl:col-start-1">{detailsPanel}</div> : null}
      {notePanel ? <div className="xl:col-start-2 xl:self-start">{notePanel}</div> : null}
    </div>
  )
}
