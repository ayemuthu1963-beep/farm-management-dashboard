"use client"

import type { ReactNode } from "react"
import { useEffect, useRef, useState } from "react"
import type Leaflet from "leaflet"
import { Layers, MapPinned, Maximize2 } from "lucide-react"
import { PMTiles, TileType, leafletRasterLayer } from "pmtiles"

import { Panel } from "@/components/farm/panel"
import { Button } from "@/components/ui/button"
import { farmCombinedLayer, plotBounds, type Coordinate } from "@/lib/farm-map-data"

export type LeafletMap = Leaflet.Map
export type LeafletApi = typeof Leaflet
export type LeafletCircleMarker = Leaflet.CircleMarker
export type LeafletMarker = Leaflet.Marker
export type LeafletLayerGroup = Leaflet.LayerGroup

interface FarmOrthomosaicMapProps {
  mapTitle?: ReactNode
  note?: string
  className?: string
  mapHeightClassName?: string
  showLayerControls?: boolean
  showFitControls?: boolean
  showDetails?: boolean
  controlsPlacement?: "side" | "below"
  onMapReady?: (map: LeafletMap, leaflet: LeafletApi) => void | (() => void)
  children?: ReactNode
  contentBelowMap?: ReactNode
}

const FARM_FIT_PADDING: [number, number] = [8, 8]

function fullBounds(): Coordinate[] {
  return farmCombinedLayer.bounds
}

export function FarmOrthomosaicMap({
  mapTitle = "Drone Orthomosaic Map",
  note = "Approved GIS coordinates and live MFMS data are separate overlays over the protected orthomosaic.",
  className = "",
  mapHeightClassName = "h-[54vh] min-h-[360px]",
  showLayerControls = true,
  showFitControls = true,
  showDetails = true,
  controlsPlacement = "side",
  onMapReady,
  children,
  contentBelowMap,
}: FarmOrthomosaicMapProps) {
  const mapElementRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const tileRef = useRef<Leaflet.GridLayer | null>(null)
  const [layerEnabled, setLayerEnabled] = useState(true)
  const [opacity, setOpacity] = useState(100)
  const [status, setStatus] = useState("Loading PMTiles orthomosaic…")

  useEffect(() => {
    let cancelled = false
    let overlayCleanup: void | (() => void)

    async function initializeMap() {
      if (!mapElementRef.current) return

      const { default: leaflet } = await import("leaflet")
      // The official PMTiles Leaflet adapter expects Leaflet on the browser global.
      ;(globalThis as typeof globalThis & { L: typeof Leaflet }).L = leaflet
      const archive = new PMTiles(farmCombinedLayer.pmtilesUrl)
      const header = await archive.getHeader()
      if (header.tileType !== TileType.Webp || header.minZoom !== 16 || header.maxZoom !== 22) {
        throw new Error("The orthomosaic PMTiles header does not match the approved archive")
      }
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

      const tile = leafletRasterLayer(archive, {
        minZoom: farmCombinedLayer.minZoom,
        maxZoom: farmCombinedLayer.maxZoom,
        maxNativeZoom: 22,
        tileSize: 256,
        opacity: 1,
        attribution: farmCombinedLayer.attribution,
      }) as Leaflet.GridLayer
      tile.on("tileerror", () => setStatus("An orthomosaic tile request failed."))
      tileRef.current = tile
      tile.addTo(map)

      map.setView(farmCombinedLayer.center, farmCombinedLayer.initialPresentationZoom, {
        animate: false,
      })
      overlayCleanup = onMapReady?.(map, leaflet)
      setStatus("Full-farm PMTiles orthomosaic loaded.")
    }

    void initializeMap().catch((error: unknown) => {
      console.error("[farm-map-pmtiles]", error)
      setStatus("Orthomosaic could not be loaded. Tree coordinates remain available when possible.")
    })

    return () => {
      cancelled = true
      overlayCleanup?.()
      mapRef.current?.remove()
      mapRef.current = null
      tileRef.current = null
    }
  }, [onMapReady])

  useEffect(() => {
    const map = mapRef.current
    const tile = tileRef.current
    if (!map || !tile) return

    if (layerEnabled && !map.hasLayer(tile)) tile.addTo(map)
    if (!layerEnabled && map.hasLayer(tile)) tile.remove()
  }, [layerEnabled])

  useEffect(() => {
    tileRef.current?.setOpacity(opacity / 100)
  }, [opacity])

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
    <Panel title="Raster Layer" icon={Layers}>
      <div className="grid gap-3">
        <label className="flex cursor-pointer items-center justify-between rounded-lg border border-border bg-background px-3 py-2.5 text-sm font-medium text-foreground">
          <span>{farmCombinedLayer.name}</span>
          <input
            type="checkbox"
            checked={layerEnabled}
            onChange={() => setLayerEnabled((current) => !current)}
            className="size-4 accent-primary"
          />
        </label>
        <label className="grid gap-1.5 text-sm font-medium text-foreground">
          Orthomosaic opacity: {opacity}%
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={opacity}
            onChange={(event) => setOpacity(Number(event.target.value))}
            className="w-full accent-primary"
          />
        </label>
      </div>
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

  const notePanel = note ? (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground">
      {note}
    </div>
  ) : null

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
