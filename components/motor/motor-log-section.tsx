"use client"

import { useState } from "react"
import { ClipboardList } from "lucide-react"
import { Panel } from "@/components/farm/panel"
import { MotorTable } from "@/components/motor/motor-table"
import type { MotorDailyRecord, MotorId } from "@/lib/motor-data"
import { cn } from "@/lib/utils"

const tabs: MotorId[] = ["M1", "M2", "M3"]

export function MotorLogSection({ recordsByMotor }: { recordsByMotor: Record<MotorId, MotorDailyRecord[]> }) {
  const [active, setActive] = useState<MotorId>("M1")

  return (
    <Panel title="Runtime History" icon={ClipboardList} iconClassName="text-sky-700" className="border-sky-200/80 bg-sky-50/55">
      <div className="mb-4 grid w-full grid-cols-3 gap-1 rounded-xl border border-sky-200 bg-white/75 p-1.5 shadow-inner" role="tablist" aria-label="Select motor">
        {tabs.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active === id}
            onClick={() => setActive(id)}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-extrabold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active === id
                ? id === "M1"
                  ? "bg-sky-600 text-white shadow-sm"
                  : id === "M2"
                    ? "bg-amber-500 text-white shadow-sm"
                    : "bg-emerald-600 text-white shadow-sm"
                : "bg-white/70 text-slate-600 hover:bg-white hover:text-foreground",
            )}
          >
            {id}
          </button>
        ))}
      </div>
      <MotorTable records={recordsByMotor[active] ?? []} />
    </Panel>
  )
}
