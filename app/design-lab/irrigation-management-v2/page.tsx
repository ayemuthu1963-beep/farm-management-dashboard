'use client'

import { useState } from 'react'
import { DashboardShell } from '@/components/farm/dashboard-shell'
import { Header } from '@/components/farm/header'
import { Panel } from '@/components/farm/panel'
import { waterPerTreeTrend, statusColors } from '@/lib/irrigation-data'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Droplets, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Zone {
  id: string
  name: string
  totalWaterSupplied: number
  waterPerTree: number
  status: string
  statusLabel: string
}

type ZoneId = "P1E" | "P1W" | "P2E" | "P2W" | "JF" | "NM"

// Mock data for Total Water Pumped — Date Wise chart
const totalWaterPumpedTrend = [
  { date: "06 Jul", total: 12500 },
  { date: "07 Jul", total: 13200 },
  { date: "08 Jul", total: 12800 },
  { date: "09 Jul", total: 13500 },
  { date: "10 Jul", total: 14100 },
  { date: "11 Jul", total: 13800 },
  { date: "12 Jul", total: 14300 },
  { date: "13 Jul", total: 13900 },
]

// Tree icon component for zone tiles
function TreeIcon({ zoneId }: { zoneId: string }) {
  switch (zoneId) {
    case 'P1W': // Big Coconut Tree with Sunset
      return (
        <svg width="60" height="60" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Sunset */}
          <circle cx="45" cy="20" r="8" fill="currentColor" opacity="0.4" />
          {/* Tree trunk */}
          <rect x="26" y="32" width="8" height="16" fill="currentColor" opacity="0.6" />
          {/* Large canopy */}
          <circle cx="30" cy="28" r="14" fill="currentColor" opacity="0.7" />
          <circle cx="18" cy="32" r="11" fill="currentColor" opacity="0.6" />
          <circle cx="42" cy="32" r="11" fill="currentColor" opacity="0.6" />
        </svg>
      )
    case 'P1E': // Big Coconut Tree with Sunrise
      return (
        <svg width="60" height="60" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Sunrise */}
          <circle cx="15" cy="20" r="8" fill="currentColor" opacity="0.4" />
          {/* Tree trunk */}
          <rect x="26" y="32" width="8" height="16" fill="currentColor" opacity="0.6" />
          {/* Large canopy */}
          <circle cx="30" cy="28" r="14" fill="currentColor" opacity="0.7" />
          <circle cx="18" cy="32" r="11" fill="currentColor" opacity="0.6" />
          <circle cx="42" cy="32" r="11" fill="currentColor" opacity="0.6" />
        </svg>
      )
    case 'P2W': // Small Coconut Tree with Sunset
      return (
        <svg width="60" height="60" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Sunset */}
          <circle cx="45" cy="25" r="6" fill="currentColor" opacity="0.4" />
          {/* Tree trunk */}
          <rect x="27" y="36" width="6" height="12" fill="currentColor" opacity="0.6" />
          {/* Medium canopy */}
          <circle cx="30" cy="32" r="10" fill="currentColor" opacity="0.7" />
          <circle cx="20" cy="35" r="8" fill="currentColor" opacity="0.6" />
          <circle cx="40" cy="35" r="8" fill="currentColor" opacity="0.6" />
        </svg>
      )
    case 'P2E': // Small Coconut Tree with Sunrise
      return (
        <svg width="60" height="60" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Sunrise */}
          <circle cx="15" cy="25" r="6" fill="currentColor" opacity="0.4" />
          {/* Tree trunk */}
          <rect x="27" y="36" width="6" height="12" fill="currentColor" opacity="0.6" />
          {/* Medium canopy */}
          <circle cx="30" cy="32" r="10" fill="currentColor" opacity="0.7" />
          <circle cx="20" cy="35" r="8" fill="currentColor" opacity="0.6" />
          <circle cx="40" cy="35" r="8" fill="currentColor" opacity="0.6" />
        </svg>
      )
    case 'JF': // Jackfruit tree
      return (
        <svg width="60" height="60" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Tree trunk */}
          <rect x="26" y="34" width="8" height="14" fill="currentColor" opacity="0.6" />
          {/* Main canopy */}
          <circle cx="30" cy="26" r="12" fill="currentColor" opacity="0.7" />
          {/* Fruits (bumpy texture) */}
          <circle cx="28" cy="20" r="3" fill="currentColor" opacity="0.5" />
          <circle cx="35" cy="21" r="3" fill="currentColor" opacity="0.5" />
          <circle cx="32" cy="28" r="2.5" fill="currentColor" opacity="0.5" />
        </svg>
      )
    case 'NM': // Nutmeg tree
      return (
        <svg width="60" height="60" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Tree trunk */}
          <rect x="27" y="32" width="6" height="16" fill="currentColor" opacity="0.6" />
          {/* Compact canopy */}
          <circle cx="30" cy="24" r="11" fill="currentColor" opacity="0.7" />
          <circle cx="22" cy="28" r="9" fill="currentColor" opacity="0.6" />
          <circle cx="38" cy="28" r="9" fill="currentColor" opacity="0.6" />
          {/* Nutmeg details */}
          <circle cx="30" cy="22" r="1.5" fill="currentColor" opacity="0.4" />
          <circle cx="26" cy="26" r="1.5" fill="currentColor" opacity="0.4" />
          <circle cx="34" cy="26" r="1.5" fill="currentColor" opacity="0.4" />
        </svg>
      )
    default:
      return null
  }
}

export default function IrrigationManagementV2() {
  const [activePeriod, setActivePeriod] = useState('today')
  const isLoading = false

  // Mock zones with 6 entries
  const mockZones: Zone[] = [
    { id: 'P1E', name: 'Plot 1 East', totalWaterSupplied: 2400, waterPerTree: 642, status: 'target', statusLabel: 'Target Achieved' },
    { id: 'P1W', name: 'Plot 1 West', totalWaterSupplied: 2100, waterPerTree: 580, status: 'target', statusLabel: 'Target Achieved' },
    { id: 'P2E', name: 'Plot 2 East', totalWaterSupplied: 1800, waterPerTree: 451, status: 'no-data', statusLabel: 'No Data' },
    { id: 'P2W', name: 'Plot 2 West', totalWaterSupplied: 1600, waterPerTree: 410, status: 'no-data', statusLabel: 'No Data' },
    { id: 'JF', name: 'Jackfruit', totalWaterSupplied: 1200, waterPerTree: 265, status: 'target', statusLabel: 'Target Achieved' },
    { id: 'NM', name: 'Nutmeg', totalWaterSupplied: 900, waterPerTree: 80, status: 'target', statusLabel: 'Target Achieved' },
  ]

  return (
    <DashboardShell>
      <Header
        title="IRRIGATION MANAGEMENT"
        subtitle="Water distribution by irrigation zone"
      />

      <main className="space-y-6">
        {/* Period Selector */}
        <div className="flex gap-2 flex-wrap">
          {[
            { id: 'today', label: 'Today' },
            { id: 'yesterday', label: 'Yesterday' },
            { id: 'last7', label: 'Last 7 Days' },
            { id: 'custom', label: 'Custom Date Range' },
          ].map((option) => (
            <button
              key={option.id}
              onClick={() => setActivePeriod(option.id)}
              className={cn(
                'px-4 py-2 rounded-lg font-medium text-sm transition-colors',
                activePeriod === option.id
                  ? 'bg-chart-2 text-white'
                  : 'bg-muted text-foreground hover:bg-muted/80'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        {/* Zone Status Grid - 6 zones */}
        <div>
          <h2 className="mb-4 text-lg font-semibold text-foreground">Zone Status</h2>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
            {mockZones.map((zone) => (
              <div key={zone.id} className="rounded-lg border border-border bg-card p-3 text-center">
                <div className="text-xs font-semibold uppercase text-muted-foreground mb-2">{zone.name}</div>
                <div
                  className={cn(
                    "inline-block rounded-full px-2 py-1 text-xs font-semibold",
                    statusColors[zone.status as keyof typeof statusColors]?.bg || "bg-muted/15",
                    statusColors[zone.status as keyof typeof statusColors]?.text || "text-muted-foreground",
                  )}
                >
                  {zone.statusLabel}
                </div>
                <div className="mt-2 text-sm font-medium text-foreground">
                  {isLoading ? "--" : `${zone.totalWaterSupplied.toLocaleString("en-IN")} L`}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Farm Irrigation Map - 2 rows layout */}
        <Panel title="Farm Irrigation Map" icon={Droplets}>
          <div className="space-y-4">
            {/* First row - 4 zones */}
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
              {mockZones.slice(0, 4).map((zone) => (
                <div key={zone.id} className="rounded-lg border border-border bg-card p-4 text-center relative overflow-hidden">
                  <div className="absolute inset-0 opacity-15 flex items-center justify-center">
                    <TreeIcon zoneId={zone.id} />
                  </div>
                  <div className="relative z-10">
                    <div className="text-sm font-semibold uppercase text-foreground mb-2">{zone.name}</div>
                    <div className="text-2xl font-bold text-chart-2 mb-2">{zone.totalWaterSupplied.toLocaleString("en-IN")}</div>
                    <div className="text-xs text-muted-foreground">{zone.statusLabel}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Second row - 2 zones (Jackfruit, Nutmeg) centered and evenly distributed */}
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-2 lg:max-w-2xl lg:mx-auto">
              {mockZones.slice(4, 6).map((zone) => (
                <div key={zone.id} className="rounded-lg border border-border bg-card p-4 text-center relative overflow-hidden">
                  <div className="absolute inset-0 opacity-15 flex items-center justify-center">
                    <TreeIcon zoneId={zone.id} />
                  </div>
                  <div className="relative z-10">
                    <div className="text-sm font-semibold uppercase text-foreground mb-2">{zone.name}</div>
                    <div className="text-2xl font-bold text-chart-2 mb-2">{zone.totalWaterSupplied.toLocaleString("en-IN")}</div>
                    <div className="text-xs text-muted-foreground">{zone.statusLabel}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Panel>

        {/* Charts Row - Total Water Pumped and Daily Irrigation Trend */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Total Water Pumped — Date Wise */}
          <Panel title="Total Water Pumped — Date Wise" icon={TrendingUp}>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={totalWaterPumpedTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" />
                <YAxis tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" />
                <Tooltip contentStyle={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)' }} />
                <Line type="monotone" dataKey="total" stroke="rgb(34, 197, 94)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Panel>

          {/* Daily Irrigation Trend */}
          <Panel title="Daily Irrigation Trend" icon={TrendingUp}>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={waterPerTreeTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" />
                <YAxis tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" />
                <Tooltip contentStyle={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)' }} />
                <Legend />
                <Line type="monotone" dataKey="P1E" stroke="rgb(34, 197, 94)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="P1W" stroke="rgb(59, 130, 246)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="P2E" stroke="rgb(249, 115, 22)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="P2W" stroke="rgb(168, 85, 247)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="JF" stroke="rgb(236, 72, 153)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="NM" stroke="rgb(14, 165, 233)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Panel>
        </div>

        {/* Water Per Tree Trend - All 6 zones */}
        <Panel title="Water Per Tree Trend" icon={TrendingUp}>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={waterPerTreeTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" />
              <YAxis tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" />
              <Tooltip contentStyle={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)' }} />
              <Legend />
              <Line type="monotone" dataKey="P1E" stroke="rgb(34, 197, 94)" strokeWidth={2} dot={false} name="Plot 1 East" />
              <Line type="monotone" dataKey="P1W" stroke="rgb(59, 130, 246)" strokeWidth={2} dot={false} name="Plot 1 West" />
              <Line type="monotone" dataKey="P2E" stroke="rgb(249, 115, 22)" strokeWidth={2} dot={false} name="Plot 2 East" />
              <Line type="monotone" dataKey="P2W" stroke="rgb(168, 85, 247)" strokeWidth={2} dot={false} name="Plot 2 West" />
              <Line type="monotone" dataKey="JF" stroke="rgb(236, 72, 153)" strokeWidth={2} dot={false} name="Jackfruit" />
              <Line type="monotone" dataKey="NM" stroke="rgb(14, 165, 233)" strokeWidth={2} dot={false} name="Nutmeg" />
            </LineChart>
          </ResponsiveContainer>
        </Panel>

        {/* Irrigation by Zone Table - All 6 zones */}
        <Panel title="Irrigation by Zone">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-2 text-left font-semibold text-foreground">Zone</th>
                  <th className="px-4 py-2 text-right font-semibold text-foreground">Water Supplied (L)</th>
                  <th className="px-4 py-2 text-right font-semibold text-foreground">Water Per Tree (L)</th>
                  <th className="px-4 py-2 text-center font-semibold text-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {mockZones.map((zone) => (
                  <tr key={zone.id} className="border-b border-border hover:bg-muted/50">
                    <td className="px-4 py-2 text-foreground">{zone.name}</td>
                    <td className="px-4 py-2 text-right font-medium text-chart-2">{zone.totalWaterSupplied.toLocaleString("en-IN")}</td>
                    <td className="px-4 py-2 text-right font-medium text-foreground">{zone.waterPerTree}</td>
                    <td className="px-4 py-2 text-center">
                      <span
                        className={cn(
                          "inline-block rounded-full px-2 py-1 text-xs font-semibold",
                          statusColors[zone.status as keyof typeof statusColors]?.bg || "bg-muted/15",
                          statusColors[zone.status as keyof typeof statusColors]?.text || "text-muted-foreground",
                        )}
                      >
                        {zone.statusLabel}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </main>
    </DashboardShell>
  )
}
