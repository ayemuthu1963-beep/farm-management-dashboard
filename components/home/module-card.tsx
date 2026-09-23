import Link from "next/link"
import { ArrowRight } from "lucide-react"
import type { ModuleCardData } from "@/lib/home-data"

interface ModuleCardProps {
  data: ModuleCardData
}

export function ModuleCard({ data }: ModuleCardProps) {
  const Icon = data.icon
  return (
    <Link
      href={data.href}
      target={data.external ? "_blank" : undefined}
      rel={data.external ? "noopener noreferrer" : undefined}
      className="flex min-h-[280px] gap-5 rounded-xl border border-[#dce9dc] bg-white/95 p-6 text-[#071f13] shadow-[0_8px_22px_rgba(0,0,0,0.09)] transition-shadow hover:shadow-[0_12px_28px_rgba(0,0,0,0.14)]"
    >
      <span className="flex size-20 shrink-0 items-center justify-center rounded-2xl bg-[#e5f3e2] text-[#0a7a37] sm:size-24">
        <Icon className="size-12" aria-hidden="true" />
      </span>
      <div className="flex flex-1 flex-col">
        <h3 className="text-xl font-extrabold uppercase leading-tight text-[#0d3f1e]">{data.title}</h3>
        <p className="mt-3 text-sm leading-relaxed text-[#4a5d4f]">{data.description}</p>
        <div className="mt-auto pt-4">
          {data.comingSoon ? (
            <span className="inline-block rounded-md bg-[#e5f3e2] px-3 py-1 text-xs font-bold uppercase tracking-wide text-[#2f7d46]">
              Coming Soon
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-sm font-extrabold text-[#0a7a37]">
              {data.ctaLabel}
              <ArrowRight className="size-4" aria-hidden="true" />
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
