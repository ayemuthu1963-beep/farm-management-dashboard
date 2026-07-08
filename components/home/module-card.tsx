import Image from "next/image"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import type { ModuleCardData } from "@/lib/home-data"

interface ModuleCardProps {
  data: ModuleCardData
}

export function ModuleCard({ data }: ModuleCardProps) {
  return (
    <Link
      href={data.href}
      className="flex min-h-[280px] gap-5 rounded-xl border border-[#dce9dc] bg-white/95 p-6 text-[#071f13] shadow-[0_8px_22px_rgba(0,0,0,0.09)] transition-shadow hover:shadow-[0_12px_28px_rgba(0,0,0,0.14)]"
    >
      <Image
        src={data.icon || "/placeholder.svg"}
        alt={data.title}
        width={112}
        height={112}
        className="size-20 shrink-0 rounded-2xl object-contain sm:size-24"
      />
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
