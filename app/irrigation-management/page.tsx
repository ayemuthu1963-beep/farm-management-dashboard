"use client"

import { useState } from "react"
import { Droplets, AlertTriangle } from "lucide-react"
import { DashboardShell } from "@/components/farm/dashboard-shell"
import { Header } from "@/components/farm/header"
import { Panel } from "@/components/farm/panel"
import { IrrigationPeriodSelector } from "@/components/irrigation/irrigation-period-selector"
import { IrrigationSummaryCards } from "@/components/irrigation/irrigation-summary-cards"
import { ZoneStatusCards } from "@/components/irrigation/zone-status-cards"
import { IrrigationMapWithDetails } from "@/components/irrigation/irrigation-map-with-details"
import { IrrigationChartsHybrid } from "@/components/irrigation/irrigation-charts-hybrid"
import { IrrigationZoneTableHybrid } from "@/components/irrigation/irrigation-zone-table-hybrid"
import { type ZoneId, IRRIGATION_RECORDS, getAllZoneDetails } from "@/lib/irrigation-mock-data"

export default function IrrigationManagementPage() {
  const [selectedZoneId, setSelectedZoneId] = useState<ZoneId>("P1E")
  const [selectedDate, setSelectedDate] = useState("2026-07-16")

  // Get alert/missing records for today
  const todayZoneDetails = getAllZoneDetails(selectedDate)
  const missingZones = todayZoneDetails.filter((z) => z.status === "no-record")
  const partialZones = todayZoneDetails.filter((z) => z.status === "partial")

  return (
    <DashboardShell>
      <Header />

      <main className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {/* Page title section */}
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">IRRIGATION MANAGEMENT</h1>
          <p className="mt-1 text-muted-foreground">Water distribution by irrigation zone</p>
        </div>

        {/* Period selector with refresh and export */}
        <IrrigationPeriodSelector onDateChange={setSelectedDate} />

        {/* Summary cards */}
        <IrrigationSummaryCards dateStr={selectedDate} />

        {/* Zone status cards */}
        <div>
          <div className="mb-3">
            <h2 className="text-sm font-semibold uppercase text-muted-foreground">Zone Status</h2>
          </div>
          <ZoneStatusCards dateStr={selectedDate} selectedZoneId={selectedZoneId} onSelectZone={setSelectedZoneId} />
        </div>

        {/* Map and detail panel */}
        <IrrigationMapWithDetails dateStr={selectedDate} selectedZoneId={selectedZoneId} onSelectZone={setSelectedZoneId} />

        {/* Missing records alert */}
        {(missingZones.length > 0 || partialZones.length > 0) && (
          <Panel title="Operational Alerts" icon={AlertTriangle}>
            <div className="space-y-2">
              {missingZones.map((zone) => (
                <div
                  key={zone.zoneId}
                  className="flex items-start gap-3 rounded-lg bg-gray-50 border border-gray-200 p-3 text-sm"
                >
                  <AlertTriangle className="size-4 text-gray-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="font-medium text-gray-900">{zone.name}</span>
                    <span className="text-gray-600"> — No irrigation record for selected date</span>
                  </div>
                </div>
              ))}
              {partialZones.map((zone) => (
                <div
                  key={zone.zoneId}
                  className="flex items-start gap-3 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm"
                >
                  <AlertTriangle className="size-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="font-medium text-amber-900">{zone.name}</span>
                    <span className="text-amber-700"> — Partial irrigation record ({zone.recordCount} records)</span>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        )}

        {/* Charts section */}
        <IrrigationChartsHybrid dateStr={selectedDate} />

        {/* Detailed records table */}
        <IrrigationZoneTableHybrid dateStr={selectedDate} />
      </main>
    </DashboardShell>
  )
}
