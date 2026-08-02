"use client"

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { Bug, Info, MapPin, Table2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Panel } from "@/components/farm/panel"
import {
  FarmOrthomosaicMap,
  type LeafletApi,
  type LeafletLayerGroup,
  type LeafletMap,
} from "@/components/maps/farm-orthomosaic-map"
import { bandForCount, countBands } from "@/lib/beetle-data"
import { BEETLE_TRAP_DATA_UPDATED_EVENT } from "@/lib/beetle-sync"
import { cn } from "@/lib/utils"

interface BeetleInspectionRecord {
  inspectionDate: string
  beetleCount: number
}

interface BeetleTrapMarker {
  trapNo: string
  trapType: "Rhinoceros Beetle" | "Red Palm Weevil" | "Unknown"
  latitude: number
  longitude: number
  cumulativeCount: number
  latestInspectionDate: string
  latestCount: number
  recordsCount: number
  pheromoneInstalledOn: string
  resetDate: string
  inspectionRecords: BeetleInspectionRecord[]
  countBand: "Very Low" | "Low" | "Medium" | "High" | "Very High"
}

interface BeetleMarkerResponse {
  markers?: BeetleTrapMarker[]
  error?: string
  source?: {
    locationSubmissions?: number
    inspectionSubmissions?: number
    countsConnected?: boolean
  }
}

function markerColor(type: BeetleTrapMarker["trapType"]): string {
  if (type === "Red Palm Weevil") return "#dc2626"
  return "#111827"
}

function trapNumberLabel(trapNo: string): string {
  return trapNo.replace(/^Trap\s+/i, "")
}

function markerSize(cumulativeCount: number): number {
  const band = bandForCount(cumulativeCount)
  return Math.max(18, Math.min(48, band.sizePx))
}

function markerFontSize(size: number): number {
  if (size >= 40) return 13
  if (size >= 30) return 12
  return 10
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function markerPopupHtml(marker: BeetleTrapMarker): string {
  const inspectionRows = marker.inspectionRecords.length
    ? marker.inspectionRecords.map((record) => `<tr>
        <td style="border-top:1px solid #d7e3d9;padding:5px 0;color:#34513a;">${escapeHtml(record.inspectionDate)}</td>
        <td style="border-top:1px solid #d7e3d9;padding:5px 0;text-align:right;font-weight:700;">${record.beetleCount}</td>
      </tr>`).join("")
    : `<tr><td colspan="2" style="border-top:1px solid #d7e3d9;padding:5px 0;color:#34513a;">No inspection records since reset.</td></tr>`

  return `<div style="min-width:210px;font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#0f2415;">
    <div style="font-weight:800;font-size:15px;margin-bottom:6px;">${escapeHtml(marker.trapNo)}</div>
    <div style="font-size:12px;margin-bottom:8px;"><strong>Cumulative Beetle Count Since Reset:</strong> ${marker.cumulativeCount}</div>
    <table style="width:100%;border-collapse:collapse;font-size:12px;">
      <thead><tr><th style="padding:0 0 4px;text-align:left;color:#34513a;">Date</th><th style="padding:0 0 4px;text-align:right;color:#34513a;">Beetle Count</th></tr></thead>
      <tbody>${inspectionRows}</tbody>
    </table>
  </div>`
}

function BeetleCountLegend() {
  return (
    <Panel title="Beetle Count Since Last Reset" icon={Bug}>
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        {countBands.map((band) => (
          <div key={band.band} className="flex items-center gap-2">
            <span className="flex w-8 items-center justify-center">
              <span
                className={cn(
                  "flex items-center justify-center rounded-full border border-card bg-card shadow-sm",
                  band.glow && "ring-2 ring-destructive/60",
                )}
                style={{ width: Math.min(band.sizePx, 28), height: Math.min(band.sizePx, 28) }}
              >
                <Bug
                  className={band.glow ? "text-destructive" : "text-foreground"}
                  style={{
                    width: Math.min(band.sizePx, 28) * 0.58,
                    height: Math.min(band.sizePx, 28) * 0.58,
                  }}
                  aria-hidden="true"
                />
              </span>
            </span>
            <span className="text-sm text-foreground">
              <span className="font-bold">{band.range}</span>{" "}
              <span className="text-muted-foreground">{band.label}</span>
            </span>
          </div>
        ))}
      </div>
      <p className="mt-4 flex items-start gap-1.5 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        Beetle icon size represents cumulative count since last pheromone reset date.
      </p>
    </Panel>
  )
}

function TrapTable({ markers }: { markers: BeetleTrapMarker[] }) {
  const [showAll, setShowAll] = useState(false)
  const sortedMarkers = [...markers].sort((a, b) => {
    if (b.cumulativeCount !== a.cumulativeCount) return b.cumulativeCount - a.cumulativeCount
    const aTrap = Number(a.trapNo.replace(/\D/g, ""))
    const bTrap = Number(b.trapNo.replace(/\D/g, ""))
    if (Number.isFinite(aTrap) && Number.isFinite(bTrap)) return aTrap - bTrap
    return a.trapNo.localeCompare(b.trapNo)
  })
  const visibleMarkers = showAll ? sortedMarkers : sortedMarkers.slice(0, 10)
  const remainingCount = Math.max(0, sortedMarkers.length - 10)

  return (
    <Panel
      title={showAll ? "All Beetle Traps" : "Top 10 Traps Since Last Reset"}
      icon={Table2}
      headerRight={
        remainingCount > 0 ? (
          <Button type="button" variant="outline" size="sm" onClick={() => setShowAll((current) => !current)}>
            {showAll ? "Show top 10 only" : `Show all traps (${remainingCount})`}
          </Button>
        ) : null
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead>
            <tr className="bg-primary/10 text-left text-xs font-semibold uppercase tracking-wide text-primary">
              <th className="px-3 py-2.5">Trap No</th>
              <th className="px-3 py-2.5">Trap Type</th>
              <th className="px-3 py-2.5 text-right">Cumulative Count</th>
              <th className="px-3 py-2.5 text-right">Latest Count</th>
              <th className="px-3 py-2.5">Latest Inspection</th>
              <th className="px-3 py-2.5 text-right">Records</th>
              <th className="px-3 py-2.5">Band</th>
            </tr>
          </thead>
          <tbody>
            {visibleMarkers.map((marker) => (
              <tr key={`${marker.trapNo}-${marker.trapType}`} className="border-b border-border last:border-0 hover:bg-muted/50">
                <td className="whitespace-nowrap px-3 py-2.5 font-bold text-foreground">{marker.trapNo}</td>
                <td className="px-3 py-2.5 text-foreground">
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="size-2.5 rounded-full"
                      style={{ backgroundColor: markerColor(marker.trapType) }}
                      aria-hidden="true"
                    />
                    {marker.trapType}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right font-bold text-foreground">{marker.cumulativeCount}</td>
                <td className="px-3 py-2.5 text-right text-foreground">{marker.latestCount}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{marker.latestInspectionDate}</td>
                <td className="px-3 py-2.5 text-right text-foreground">{marker.recordsCount}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{marker.countBand}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}

function markerHtml(marker: BeetleTrapMarker): string {
  const size = markerSize(marker.cumulativeCount)
  const colour = markerColor(marker.trapType)
  const fontSize = markerFontSize(size)
  const number = trapNumberLabel(marker.trapNo)

  return `<div style="
    width:${size}px;
    height:${size}px;
    border-radius:9999px;
    background:${colour};
    color:white;
    border:2px solid rgba(255,255,255,0.95);
    box-shadow:0 2px 8px rgba(0,0,0,0.38);
    display:flex;
    align-items:center;
    justify-content:center;
    font-weight:800;
    font-size:${fontSize}px;
    line-height:1;
    letter-spacing:-0.04em;
  ">${number}</div>`
}

export function BeetleTrapMapArea({ children }: { children?: ReactNode }) {
  const [markers, setMarkers] = useState<BeetleTrapMarker[]>([])
  const [status, setStatus] = useState("Loading real trap locations from database...")
  const [error, setError] = useState("")
  const [mapReadyTick, setMapReadyTick] = useState(0)
  const leafletRef = useRef<LeafletApi | null>(null)
  const layerRef = useRef<LeafletLayerGroup | null>(null)

  const loadMarkers = useCallback(async () => {
    try {
      const response = await fetch("/api/beetle-trap/markers", { cache: "no-store" })
      const data = (await response.json()) as BeetleMarkerResponse
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`)

      const realMarkers = data.markers ?? []
      setMarkers(realMarkers)
      setStatus(
        realMarkers.length
          ? `Real database trap locations and beetle counts loaded: ${realMarkers.length} traps.`
          : "No active trap locations found in database.",
      )
      setError("")
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : "Unknown marker loading error"
      setMarkers([])
      setStatus("Real trap locations could not be loaded.")
      setError(message)
    }
  }, [])

  useEffect(() => {
    void loadMarkers()
    window.addEventListener(BEETLE_TRAP_DATA_UPDATED_EVENT, loadMarkers)
    return () => window.removeEventListener(BEETLE_TRAP_DATA_UPDATED_EVENT, loadMarkers)
  }, [loadMarkers])

  const handleMapReady = useCallback((map: LeafletMap, leaflet: LeafletApi) => {
    leafletRef.current = leaflet
    layerRef.current = leaflet.layerGroup().addTo(map)
    setMapReadyTick((current) => current + 1)

    return () => {
      layerRef.current?.remove()
      layerRef.current = null
      leafletRef.current = null
    }
  }, [])

  useEffect(() => {
    const leaflet = leafletRef.current
    const layer = layerRef.current
    if (!leaflet || !layer) return

    layer.clearLayers()
    for (const marker of markers) {
      const size = markerSize(marker.cumulativeCount)
      const icon = leaflet.divIcon({
        html: markerHtml(marker),
        className: "mfms-beetle-number-marker",
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      })

      leaflet
        .marker([marker.latitude, marker.longitude], { icon, keyboard: true, title: marker.trapNo })
        .bindPopup(markerPopupHtml(marker), { closeButton: true, maxWidth: 260 })
        .bindTooltip(`${marker.trapNo} · ${marker.trapType} · ${marker.cumulativeCount}`, {
          direction: "top",
          sticky: true,
        })
        .addTo(layer)
    }
  }, [markers, mapReadyTick])

  return (
    <div className="flex flex-col gap-5">
      <FarmOrthomosaicMap
        mapTitle="Farm Map – Beetle Trap Monitoring"
        note=""
        mapHeightClassName="h-[520px] min-h-[420px]"
        showLayerControls={false}
        showDetails={false}
        controlsPlacement="below"
        onMapReady={handleMapReady}
      />

      {children}

      <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm font-medium text-primary">
        <MapPin className="mr-2 inline size-4 align-text-bottom" aria-hidden="true" />
        {status}
        {error && <span className="mt-1 block text-xs font-normal text-destructive">{error}</span>}
      </div>

      <BeetleCountLegend />

      <TrapTable markers={markers} />
    </div>
  )
}
