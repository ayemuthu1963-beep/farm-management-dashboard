"use client"

import { useState } from "react"
import { Leaf, AlertCircle, Zap } from "lucide-react"

export default function HarvestLiveCounterPage() {
  // Mock data - all hard-coded
  const [displayState, setDisplayState] = useState<"live" | "near" | "reached" | "offline" | "empty">("live")

  // Live state data
  const liveData = {
    nutsHarvested: 8450,
    target: 10000,
    trees: 325,
    bunches: 610,
    submissions: 325,
    lastUpdated: "10:42:15 AM",
    completed: 84.5,
  }

  // Near target state
  const nearData = {
    nutsHarvested: 9850,
    target: 10000,
    trees: 328,
    bunches: 618,
    submissions: 328,
    lastUpdated: "10:50:32 AM",
    completed: 98.5,
  }

  // Target reached state
  const reachedData = {
    nutsHarvested: 10250,
    target: 10000,
    trees: 330,
    bunches: 620,
    submissions: 330,
    lastUpdated: "10:55:48 AM",
    completed: 102.5,
    exceededBy: 250,
  }

  // Offline state
  const offlineData = {
    nutsHarvested: 8450,
    target: 10000,
    trees: 325,
    bunches: 610,
    submissions: 325,
    lastUpdated: "10:42:15 AM",
    completed: 84.5,
  }

  // Empty state
  const emptyData = {
    nutsHarvested: 0,
    target: 10000,
    trees: 0,
    bunches: 0,
    submissions: 0,
    lastUpdated: null,
    completed: 0,
  }

  // Select data based on state
  let data = liveData
  if (displayState === "near") data = nearData
  if (displayState === "reached") data = reachedData
  if (displayState === "offline") data = offlineData
  if (displayState === "empty") data = emptyData

  // Determine colors based on completion %
  const getStatusColor = () => {
    if (displayState === "reached") return "red"
    if (data.completed >= 100) return "red"
    if (data.completed >= 80) return "amber"
    if (data.completed >= 50) return "blue"
    return "green"
  }

  const statusColor = getStatusColor()
  const colorClasses = {
    red: { bg: "bg-red-50", border: "border-red-200", text: "text-red-900", progress: "bg-red-500", badge: "bg-red-100 text-red-800" },
    amber: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-900", progress: "bg-amber-500", badge: "bg-amber-100 text-amber-800" },
    blue: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-900", progress: "bg-blue-500", badge: "bg-blue-100 text-blue-800" },
    green: { bg: "bg-green-50", border: "border-green-200", text: "text-green-900", progress: "bg-green-500", badge: "bg-green-100 text-green-800" },
  }

  const colors = colorClasses[statusColor as keyof typeof colorClasses]

  const previousDays = [
    { date: "23-07-2026", trees: 318, bunches: 596, nuts: 8210 },
    { date: "22-07-2026", trees: 304, bunches: 571, nuts: 7940 },
    { date: "21-07-2026", trees: 290, bunches: 544, nuts: 7580 },
  ]

  return (
    <main className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white px-4 py-4 sm:px-6">
        <div className="mx-auto max-w-2xl">
          {/* Title */}
          <div className="flex items-center gap-2">
            <Leaf className="h-6 w-6 text-green-700" />
            <h1 className="text-2xl font-bold text-gray-900">MFMS Harvest Live Counter</h1>
          </div>

          {/* Live status line */}
          <div className="mt-3 flex items-center gap-2">
            {displayState === "live" ? (
              <>
                <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-green-500" />
                <span className="text-sm font-medium text-gray-700">Live</span>
              </>
            ) : displayState === "offline" ? (
              <>
                <span className="inline-flex h-2 w-2 rounded-full bg-gray-500" />
                <span className="text-sm font-medium text-gray-700">Offline</span>
              </>
            ) : (
              <>
                <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-green-500" />
                <span className="text-sm font-medium text-gray-700">Live</span>
              </>
            )}
            <span className="text-sm text-gray-600">Last updated: {data.lastUpdated || "—"}</span>
            <button className="ml-auto rounded-md bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-200">
              Refresh
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
        {displayState === "empty" ? (
          // Empty state
          <div className={`rounded-lg border-2 ${colors.border} ${colors.bg} p-8 text-center`}>
            <p className={`text-lg font-semibold ${colors.text}`}>Harvest has not started</p>
            <p className={`mt-2 text-sm ${colors.text}`}>Today's Nuts: 0 | Trees: 0 | Bunches: 0</p>
          </div>
        ) : displayState === "offline" ? (
          // Offline state
          <div className={`rounded-lg border-2 border-gray-300 bg-gray-50 p-6 text-center`}>
            <p className={`text-lg font-semibold text-gray-900`}>LIVE UPDATE TEMPORARILY UNAVAILABLE</p>
            <p className={`mt-2 text-sm text-gray-600`}>Showing totals from: {data.lastUpdated}</p>
          </div>
        ) : null}

        {displayState !== "empty" && displayState !== "offline" && (
          <>
            {/* Hero Card - Today's Nuts */}
            <section className={`rounded-lg border-2 ${colors.border} ${colors.bg} p-6 sm:p-8`}>
              <p className={`text-sm font-semibold uppercase tracking-wide ${colors.text}`}>Today's Nuts</p>
              <p className="mt-3 text-6xl font-bold sm:text-7xl lg:text-8xl text-gray-900">{(data.nutsHarvested).toLocaleString()}</p>

              {/* Progress info */}
              <div className="mt-6 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-gray-700">Target: {data.target.toLocaleString()}</span>
                  <span className={`font-semibold ${colors.text}`}>{data.completed.toFixed(1)}%</span>
                </div>
                <div className="h-4 w-full overflow-hidden rounded-full bg-gray-200">
                  <div className={`h-full ${colors.progress}`} style={{ width: `${Math.min(data.completed, 100)}%` }} />
                </div>
                <div className="text-sm text-gray-600">Remaining: {Math.max(0, data.target - data.nutsHarvested).toLocaleString()}</div>
              </div>
            </section>

            {/* Summary cards */}
            <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <p className="text-sm font-medium text-gray-600">Trees Harvested</p>
                <p className="mt-2 text-4xl font-bold text-gray-900">{data.trees}</p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <p className="text-sm font-medium text-gray-600">Total Bunches</p>
                <p className="mt-2 text-4xl font-bold text-gray-900">{data.bunches}</p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <p className="text-sm font-medium text-gray-600">ODK Submissions</p>
                <p className="mt-2 text-4xl font-bold text-gray-900">{data.submissions}</p>
              </div>
            </section>

            {/* Status and target states */}
            <section className="mt-6 space-y-4">
              {/* Current status */}
              <div className={`rounded-lg border-2 ${colors.border} ${colors.bg} p-6 text-center`}>
                <p className={`text-lg font-bold uppercase ${colors.text}`}>
                  {displayState === "reached" ? "STOP HARVEST" : "HARVEST IN PROGRESS"}
                </p>
                {displayState === "reached" && <p className={`mt-2 text-sm ${colors.text}`}>Target exceeded by {reachedData.exceededBy} nuts</p>}
                {displayState === "near" && <p className={`mt-2 text-sm ${colors.text}`}>Target nearly reached</p>}
              </div>

              {/* Target reached preview card */}
              {displayState !== "reached" && (
                <div className="rounded-lg border-2 border-red-200 bg-red-50 p-6 text-center opacity-60">
                  <p className="text-sm font-semibold text-gray-600">Target-Reached Preview</p>
                  <p className="mt-2 text-lg font-bold text-red-900">STOP HARVEST</p>
                  <p className="text-sm text-red-900">TARGET REACHED</p>
                  <p className="mt-2 text-sm text-red-800">Target exceeded by 250 nuts</p>
                </div>
              )}
            </section>

            {/* Previous days */}
            <section className="mt-8">
              <h2 className="mb-4 text-sm font-semibold uppercase text-gray-700">Previous Harvest Days</h2>
              <div className="space-y-2">
                {previousDays.map((day, idx) => (
                  <div key={idx} className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3 text-sm">
                    <span className="font-medium text-gray-900">{day.date}</span>
                    <span className="text-gray-600">
                      Trees: {day.trees} | Bunches: {day.bunches} | Nuts: {day.nuts.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            {/* Duplicate warning */}
            <section className="mt-6 rounded-lg border border-yellow-300 bg-yellow-50 p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 flex-shrink-0 text-yellow-700 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-yellow-900">Possible duplicate tree entries: 2</p>
                  <button className="mt-2 text-sm font-medium text-yellow-700 hover:text-yellow-800 underline">View entries</button>
                </div>
              </div>
            </section>

            {/* Target control panel */}
            <section className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <p className="text-sm font-semibold text-gray-700 uppercase">Set Today's Target</p>
              <p className="mt-3 text-3xl font-bold text-gray-900">{data.target.toLocaleString()}</p>
              <div className="mt-4 flex gap-2">
                <button className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                  Edit Target
                </button>
                <button className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                  Save
                </button>
              </div>
              <p className="mt-3 text-xs text-gray-600">This panel is for supervisors only</p>
            </section>
          </>
        )}

        {/* Bottom status */}
        <section className="mt-8 rounded-lg border border-gray-200 bg-gray-50 p-4 text-center text-xs text-gray-600">
          <p>Auto-refresh every 30 seconds</p>
          <p className="mt-1">ODK direct monitoring</p>
          <p>Not yet imported into MFMS Production</p>
        </section>

        {/* State selector for design preview only */}
        <section className="mt-8 border-t border-gray-200 pt-6">
          <p className="mb-3 text-xs font-semibold uppercase text-gray-600">Design Preview States (for approval only)</p>
          <div className="flex flex-wrap gap-2">
            {(["live", "near", "reached", "offline", "empty"] as const).map((state) => (
              <button
                key={state}
                onClick={() => setDisplayState(state)}
                className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
                  displayState === state
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                {state.charAt(0).toUpperCase() + state.slice(1)}
              </button>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
