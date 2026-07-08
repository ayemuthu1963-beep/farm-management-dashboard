"use client"

import { useState } from "react"
import { ClipboardList } from "lucide-react"
import { Panel } from "@/components/farm/panel"
import { MotorTable } from "@/components/motor/motor-table"
import { motorRecordsById, type MotorId } from "@/lib/motor-data"
import { cn } from "@/lib/utils"

const tabs: MotorId[] = ["M1", "M2", "M3"]

export function MotorLogSection() {
  const [active, setActive] = useState<MotorId>("M1")

  return (
    <Panel title="Daily Runtime Log" icon={ClipboardList}>
      <div className="mb-4 inline-flex rounded-lg border border-border bg-muted p-1" role="tablist" aria-label="Select motor">
        {tabs.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active === id}
            onClick={() => setActive(id)}
            className={cn(
              "rounded-md px-4 py-1.5 text-sm font-semibold transition-colors",
              active === id
                ? "bg-card text-primary shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {id}
          </button>
        ))}
      </div>
      <MotorTable records={motorRecordsById[active]} />
    </Panel>
  )
}
