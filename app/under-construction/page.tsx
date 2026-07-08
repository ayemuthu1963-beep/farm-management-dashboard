import Link from "next/link"
import { Construction, ArrowLeft } from "lucide-react"

export default function UnderConstructionPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f3fbf4] px-4">
      <div className="flex max-w-md flex-col items-center rounded-2xl border border-[#dce9dc] bg-white/95 p-10 text-center shadow-[0_8px_22px_rgba(0,0,0,0.09)]">
        <span className="flex size-16 items-center justify-center rounded-full bg-[#e5f3e2] text-[#2f7d46]">
          <Construction className="size-8" aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-2xl font-extrabold text-[#0d3f1e]">Coming Soon</h1>
        <p className="mt-2 text-sm leading-relaxed text-[#4a5d4f]">
          This module is under construction and will be available in a future release of the Muthu Farms
          Digital Farm Management System.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#087637] px-5 py-2.5 text-sm font-extrabold text-white shadow-md transition-colors hover:bg-[#0a8641]"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to Home
        </Link>
      </div>
    </main>
  )
}
