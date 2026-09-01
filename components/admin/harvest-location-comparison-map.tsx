"use client"

import { useCallback, useMemo, useState } from "react"
import { MapPinned } from "lucide-react"

import {
  FarmOrthomosaicMap,
  type LeafletApi,
  type LeafletMap,
} from "@/components/maps/farm-orthomosaic-map"
import { farmCombinedLayer } from "@/lib/farm-map-data"
import type { HarvestScanItem } from "@/lib/harvest-review-model"

interface FarmMapCoordinateCollection {
  type: "FeatureCollection"
  features: Array<{
    type: "Feature"
    geometry: { type: "Point"; coordinates: [number, number] }
    properties: { treeNo: string }
  }>
}

interface HarvestLocationComparisonMapProps {
  rows: HarvestScanItem[]
  correctedTreeNo?: string | null
}

interface LocatedSubmission {
  row: HarvestScanItem
  latitude: number
  longitude: number
  accuracy: number | null
  label: string
}

function finiteCoordinate(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null
  const parsed = typeof value === "number" ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function escapeHtml(value: unknown) {
  return String(value ?? "—")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}

function accuracyColour(accuracy: number | null) {
  if (accuracy === null || accuracy > 100) return "#dc2626"
  if (accuracy > 50) return "#d97706"
  return "#16a34a"
}

function distanceMetres(first: LocatedSubmission, second: LocatedSubmission) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180
  const earthRadius = 6_371_000
  const latDelta = radians(second.latitude - first.latitude)
  const lonDelta = radians(second.longitude - first.longitude)
  const a =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(radians(first.latitude)) *
      Math.cos(radians(second.latitude)) *
      Math.sin(lonDelta / 2) ** 2
  return Math.round(earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)))
}

export function HarvestLocationComparisonMap({
  rows,
  correctedTreeNo,
}: HarvestLocationComparisonMapProps) {
  const [status, setStatus] = useState("Loading approved tree position…")
  const located = useMemo<LocatedSubmission[]>(
    () =>
      rows
        .flatMap<Omit<LocatedSubmission, "label">>((row) => {
          const latitude = finiteCoordinate(row.gps_latitude)
          const longitude = finiteCoordinate(row.gps_longitude)
          if (
            latitude === null ||
            longitude === null ||
            latitude < -90 ||
            latitude > 90 ||
            longitude < -180 ||
            longitude > 180
          ) {
            return []
          }
          const rawAccuracy = finiteCoordinate(row.gps_accuracy_m)
          return [
            {
              row,
              latitude,
              longitude,
              accuracy: rawAccuracy !== null && rawAccuracy >= 0 ? rawAccuracy : null,
            },
          ]
        })
        .map((item, index) => ({
          ...item,
          label: String.fromCharCode(65 + index),
        })),
    [rows],
  )
  const distance = located.length >= 2 ? distanceMetres(located[0], located[1]) : null

  const handleMapReady = useCallback(
    (map: LeafletMap, leaflet: LeafletApi) => {
      let cancelled = false
      const layers = leaflet.layerGroup().addTo(map)
      const fitPoints: Array<[number, number]> = []

      for (const item of located) {
        const point: [number, number] = [item.latitude, item.longitude]
        const colour = accuracyColour(item.accuracy)
        fitPoints.push(point)
        if (item.accuracy !== null) {
          const accuracyCircle = leaflet.circle(point, {
            radius: item.accuracy,
            color: colour,
            weight: 1.5,
            fillColor: colour,
            fillOpacity: 0.12,
            interactive: false,
          }).addTo(layers)
          const accuracyBounds = accuracyCircle.getBounds()
          const southWest = accuracyBounds.getSouthWest()
          const northEast = accuracyBounds.getNorthEast()
          fitPoints.push(
            [southWest.lat, southWest.lng],
            [northEast.lat, northEast.lng],
          )
        }
        leaflet
          .circleMarker(point, {
            radius: 9,
            color: "#ffffff",
            weight: 3,
            fillColor: colour,
            fillOpacity: 1,
          })
          .bindTooltip(`Submission ${item.label}`, { permanent: true, direction: "top" })
          .bindPopup(
            `<strong>Submission ${item.label}</strong><br>` +
              `Tree ${escapeHtml(item.row.original_tree_no)}<br>` +
              `Accuracy: ${item.accuracy === null ? "not reported" : `${Math.round(item.accuracy)} m`}<br>` +
              `Device: ${escapeHtml(item.row.device_id)}`,
          )
          .addTo(layers)
      }

      const fitMap = () => {
        if (fitPoints.length === 0) return
        if (fitPoints.length === 1) {
          map.setView(fitPoints[0], 20, { animate: false })
          return
        }
        map.fitBounds(leaflet.latLngBounds(fitPoints), {
          padding: [36, 36],
          maxZoom: 20,
          animate: false,
        })
      }
      fitMap()

      const expectedTrees = new Set(
        [String(rows[0]?.original_tree_no ?? "").trim(), String(correctedTreeNo ?? "").trim()].filter(
          Boolean,
        ),
      )
      void fetch(farmCombinedLayer.coordinatesUrl, { cache: "force-cache" })
        .then(async (response) => {
          if (!response.ok) throw new Error(`Approved coordinates returned ${response.status}`)
          return (await response.json()) as FarmMapCoordinateCollection
        })
        .then((collection) => {
          if (cancelled || !Array.isArray(collection.features)) return
          let expectedCount = 0
          for (const feature of collection.features) {
            if (!expectedTrees.has(feature.properties.treeNo)) continue
            const [longitude, latitude] = feature.geometry.coordinates
            if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue
            const point: [number, number] = [latitude, longitude]
            fitPoints.push(point)
            expectedCount += 1
            leaflet
              .circleMarker(point, {
                radius: 7,
                color: "#111827",
                weight: 3,
                fillColor: "#fde047",
                fillOpacity: 1,
              })
              .bindTooltip(`Approved Tree ${feature.properties.treeNo}`, {
                permanent: true,
                direction: "bottom",
              })
              .addTo(layers)
          }
          fitMap()
          setStatus(
            expectedCount > 0
              ? "Approved Tree Master position and submitted phone locations are shown."
              : "Submitted phone locations are shown; the expected tree has no approved map point.",
          )
        })
        .catch(() => {
          if (!cancelled) setStatus("Phone locations are shown; approved tree coordinates could not be loaded.")
        })

      return () => {
        cancelled = true
        layers.remove()
      }
    },
    [correctedTreeNo, located, rows],
  )

  if (located.length === 0) {
    return (
      <div className="mt-3 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
        <p className="flex items-center gap-2 font-bold text-foreground">
          <MapPinned className="size-4" /> No submitted location is available
        </p>
        <p className="mt-1">
          Existing submissions were collected before automatic location was added. Future submissions will appear here when the phone provides a location.
        </p>
      </div>
    )
  }

  return (
    <div className="mt-3 rounded-xl border bg-card p-3">
      <FarmOrthomosaicMap
        mapTitle="Duplicate submission location comparison"
        note={status}
        className="border-0 shadow-none"
        mapHeightClassName="h-[48vh] min-h-[340px]"
        showLayerControls={false}
        showDetails={false}
        onMapReady={handleMapReady}
      />
      <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-3">
        {located.map((item) => (
          <div key={item.row.odk_instance_id} className="rounded-lg border p-3">
            <p className="font-black">Submission {item.label} · Tree {item.row.original_tree_no}</p>
            <p>Accuracy: {item.accuracy === null ? "not reported" : `${Math.round(item.accuracy)} m`}</p>
            <p>Captured: {item.row.gps_captured_at || "time not reported"}</p>
          </div>
        ))}
        <div className="rounded-lg border p-3">
          <p className="font-black">
            Distance between {located[0]?.label ?? "A"} and {located[1]?.label ?? "B"}
          </p>
          <p>{distance === null ? "Needs two submitted locations" : `${distance.toLocaleString("en-IN")} m`}</p>
        </div>
      </div>
    </div>
  )
}
