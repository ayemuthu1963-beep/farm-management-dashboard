"use client"

import { Clock, Droplets, Gauge, MapPinned } from "lucide-react"
import { StatCard } from "@/components/farm/stat-card"
import { formatWaterLitres, type IrrigationSummary } from "@/lib/irrigation-data"

interface IrrigationSummaryCardsProps {
  summary: IrrigationSummary
  zoneCount: number
  isLoading?: boolean
}

export function IrrigationSummaryCards({ summary, zoneCount, isLoading = false }: IrrigationSummaryCardsProps) {
  const loading = isLoading ? "Loading..." : null
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard icon={Droplets} label="Total Water Pumped" value={loading ?? formatWaterLitres(summary.totalWaterSupplied)} sublabel="From Motor Runtime" accent="bg-sky-100 text-sky-700" />
      <StatCard icon={Clock} label="Total Runtime" value={loading ?? summary.totalMotorRuntime} sublabel="Total minutes converted to hours" accent="bg-emerald-100 text-emerald-700" />
      <StatCard icon={MapPinned} label="Zones Irrigated" value={loading ?? `${summary.zonesIrrigated} / ${zoneCount}`} sublabel="Six operational zones" accent="bg-lime-100 text-lime-700" />
      <StatCard icon={Gauge} label="Zones Not Irrigated" value={loading ?? summary.zonesNotIrrigated} sublabel="Selected period" accent="bg-slate-100 text-slate-700" />
    </div>
  )
}
