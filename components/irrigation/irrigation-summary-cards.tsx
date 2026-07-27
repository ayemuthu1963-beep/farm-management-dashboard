"use client"

import { Droplets, Zap, CheckCircle2, AlertCircle } from "lucide-react"
import { StatCard, StatGrid } from "@/components/farm/stat-card"
import { calculateSummary, formatRuntimeMinutes, formatWaterLitres } from "@/lib/irrigation-mock-data"

interface IrrigationSummaryCardsProps {
  dateStr: string
}

export function IrrigationSummaryCards({ dateStr }: IrrigationSummaryCardsProps) {
  const summary = calculateSummary()

  return (
    <StatGrid>
      <StatCard
        icon={Zap}
        label="Total Runtime"
        value={formatRuntimeMinutes(summary.totalRuntimeMinutes)}
        accent="bg-chart-1/10 text-chart-1"
      />
      <StatCard
        icon={Droplets}
        label="Total Water Pumped"
        value={formatWaterLitres(summary.totalWaterLitres)}
        accent="bg-chart-2/10 text-chart-2"
      />
      <StatCard
        icon={CheckCircle2}
        label="Zones Irrigated"
        value={`${summary.zonesIrrigated} / 6`}
        accent="bg-green-100/20 text-green-700"
      />
      <StatCard
        icon={AlertCircle}
        label="Zones Not Irrigated"
        value={`${summary.zonesNotIrrigated} / 6`}
        accent="bg-gray-100/20 text-gray-700"
      />
      <StatCard
        icon={Droplets}
        label="Average Water per Tree"
        value={formatWaterLitres(Math.round(summary.averageWaterPerTree))}
        accent="bg-blue-100/20 text-blue-700"
      />
    </StatGrid>
  )
}
